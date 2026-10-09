import hashlib
import json
import re
import subprocess
import sys
import tempfile
import threading
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any

from agents_research.evidence.fetch import SourceError, fetch_public
from agents_research.evidence.models import Document, Page, Passage


def digest(value: str | bytes) -> str:
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()[:32]


def source_abstract(work: dict[str, Any]) -> str:
    index = work.get("abstract_inverted_index")
    if not isinstance(index, dict):
        return ""
    words: dict[int, str] = {}
    for word, positions in index.items():
        if not isinstance(word, str) or not isinstance(positions, list):
            return ""
        for position in positions:
            if type(position) is not int or not 0 <= position <= 50000 or position in words:
                return ""
            words[position] = word
    if set(words) != set(range(len(words))):
        return ""
    return " ".join(words[i] for i in range(len(words)))


def oa_pdf_urls(work: dict[str, Any]) -> list[str]:
    # Only locations explicitly marked open access by the canonical provider.
    locations = [
        work.get("best_oa_location"),
        work.get("primary_location"),
        *(work.get("locations") or []),
    ]
    urls: list[str] = []
    for location in locations:
        if isinstance(location, dict) and location.get("is_oa") is True:
            url = location.get("pdf_url")
            if isinstance(url, str) and url.startswith("https://") and url not in urls:
                urls.append(url)
    return urls[:3]


class DocumentStore:
    """Bounded process-local OA cache. No private uploads; evicted documents can be re-fetched."""

    def __init__(self, api_key: str = ""):
        self.root = tempfile.TemporaryDirectory(prefix="agents-documents-")
        self.items: OrderedDict[str, tuple[float, Document]] = OrderedDict()
        self.lock = threading.RLock()
        self.api_key = api_key

    def path(self, document_id: str, suffix: str = ".pdf") -> Path:
        if not re.fullmatch(r"[a-f0-9]{32}", document_id):
            raise SourceError("Invalid document identifier.")
        return Path(self.root.name) / (document_id + suffix)

    def process(self, mode: str, document_id: str, value: str, suffix: str) -> Path:
        target = self.path(document_id, suffix)
        try:
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "agents_research.evidence.pdf_worker",
                    mode,
                    str(self.path(document_id)),
                    str(target),
                    value,
                ],
                check=True,
                timeout=40,
                capture_output=True,
            )
            return target
        except (subprocess.SubprocessError, OSError) as exc:
            target.unlink(missing_ok=True)
            raise SourceError(
                "This PDF could not be processed within the document limits."
            ) from exc

    def get(self, work_id: str) -> Document:
        if not re.fullmatch(r"W[0-9]+", work_id):
            raise SourceError("A canonical OpenAlex work identifier is required.")
        with self.lock:
            cached = self.items.get(work_id)
            if cached and time.monotonic() - cached[0] < 3600:
                self.items.move_to_end(work_id)
                return cached[1]
            if cached:
                self.retry(work_id)
            # A caller supplies only a work ID, never a URL or fabricated source text.
            from urllib.parse import urlencode

            query = "?" + urlencode({"api_key": self.api_key}) if self.api_key else ""
            try:
                work = json.loads(fetch_public(f"https://api.openalex.org/works/{work_id}{query}"))
                if work.get("id", "").split("/")[-1] != work_id:
                    raise ValueError("Wrong record")
            except (ValueError, AttributeError) as exc:
                raise SourceError("OpenAlex returned an invalid paper record.") from exc
            abstract = source_abstract(work)
            doc_id = digest(f"{work_id}:{abstract}")
            document = Document(
                id=doc_id,
                workId=work_id,
                title=work.get("title") or "",
                sourceType="abstract" if abstract else "none",
                message="No open-access PDF was supplied by the source.",
            )
            urls = oa_pdf_urls(work)
            for url in urls:
                try:
                    data = fetch_public(url, pdf=True)
                    doc_id = digest(data)
                    self.path(doc_id).write_bytes(data)
                    parsed = json.loads(self.process("parse", doc_id, doc_id, ".json").read_text())
                    document = Document(
                        id=doc_id,
                        workId=work_id,
                        title=document.title,
                        sourceUrl=url,
                        sourceType="full_text",
                        pdfStatus="available",
                        pages=[Page.model_validate(p) for p in parsed["pages"]],
                        passages=[Passage.model_validate(p) for p in parsed["passages"]],
                    )
                    if not document.passages:
                        document.sourceType = "abstract" if abstract else "none"
                        document.message = (
                            "This PDF has no usable text layer. OCR is not connected."
                        )
                    break
                except (SourceError, ValueError, KeyError, TypeError) as exc:
                    if not any(d.id == doc_id for _, d in self.items.values()):
                        for path in Path(self.root.name).glob(doc_id + ".*"):
                            path.unlink(missing_ok=True)
                    document.pdfStatus = "failed"
                    document.message = (
                        str(exc)
                        if isinstance(exc, SourceError)
                        else "This PDF returned invalid document data."
                    )
            if document.sourceType != "full_text" and abstract:
                document.passages = [
                    Passage(id=f"{document.id}:abstract", text=abstract, sourceType="abstract")
                ]
            self.items[work_id] = (time.monotonic(), document)
            while len(self.items) > 32:
                _, (_, removed) = self.items.popitem(last=False)
                if not any(d.id == removed.id for _, d in self.items.values()):
                    for path in Path(self.root.name).glob(removed.id + ".*"):
                        path.unlink(missing_ok=True)
            return document

    def page_image(self, work_id: str, page: int, expected_id: str = "") -> bytes:
        with self.lock:
            document = self.get(work_id)
            if expected_id and document.id != expected_id:
                raise SourceError(
                    "The source document changed. Reload the document before highlighting."
                )
            if document.pdfStatus != "available" or not 1 <= page <= len(document.pages):
                raise SourceError("This PDF page is unavailable.")
            suffix = f".{page}.png"
            path = self.path(document.id, suffix)
            if not path.exists():
                self.process("render", document.id, str(page), suffix)
            return path.read_bytes()

    def retry(self, work_id: str) -> None:
        with self.lock:
            removed = self.items.pop(work_id, None)
            if removed and not any(d.id == removed[1].id for _, d in self.items.values()):
                for path in Path(self.root.name).glob(removed[1].id + ".*"):
                    path.unlink(missing_ok=True)

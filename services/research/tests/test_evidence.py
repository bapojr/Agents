import json
import socket
from pathlib import Path
from unittest.mock import patch

import pytest

from agents_research.evidence.analysis import analyse
from agents_research.evidence.documents import DocumentStore, oa_pdf_urls, source_abstract
from agents_research.evidence.fetch import SourceError, fetch_public, public_addresses
from agents_research.evidence.models import (
    AnalyseRequest,
    Candidates,
    Document,
    Passage,
    Verdicts,
    Word,
)
from agents_research.evidence.pdf_worker import parse


class Model:
    model = "test-double-not-a-live-model"

    def __init__(self, quote="A real source reports a measured association.", approved=True):
        self.quote, self.approved, self.calls = quote, approved, 0

    def generate(self, instruction, data, schema):
        self.calls += 1
        if schema is Candidates:
            return Candidates.model_validate(
                {
                    "cells": [
                        {
                            "columnId": "relevance",
                            "value": "A measured association was reported.",
                            "status": "supported",
                            "evidence": [{"passageId": "doc:p2:0", "quote": self.quote}],
                        }
                    ]
                }
            )
        return Verdicts.model_validate(
            {"verdicts": [{"columnId": "relevance", "supported": self.approved}]}
        )


def document(source="full_text"):
    return Document(
        id="doc",
        workId="W1",
        title="Test fixture",
        sourceType=source,
        passages=[
            Passage(
                id="doc:p2:0",
                text="A real source reports a measured association.",
                sourceType=source,
                pageNumber=2 if source == "full_text" else None,
                words=[Word(start=0, end=6, rect=[1, 2, 3, 4])],
            )
        ],
    )


def request():
    return AnalyseRequest(
        workId="W1",
        question="What association was measured?",
        columns=[{"id": "relevance", "label": "Relevance"}, {"id": "pathway", "label": "Pathway"}],
    )


def test_exact_quote_offsets_and_explicit_claim_links():
    result = analyse(document(), request(), Model())
    evidence = result.evidence[0]
    assert evidence.page == 2 and evidence.rects == [[1, 2, 3, 4]]
    assert document().passages[0].text[evidence.startOffset : evidence.endOffset] == evidence.text
    assert result.cells["relevance"].claimId == evidence.claimId
    assert result.cells["relevance"].evidenceIds == [evidence.id]
    assert result.cells["pathway"].status == "not_reported"
    assert result.cells["pathway"].evidenceIds == []


@pytest.mark.parametrize(
    "quote,approved",
    [
        ("Invented plausible source text.", True),
        ("A real source reports a measured association.", False),
    ],
)
def test_fabricated_quotes_and_unsupported_claims_rejected(quote, approved):
    result = analyse(document(), request(), Model(quote, approved))
    assert result.evidence == []
    assert result.cells["relevance"].value == "Not reported"


def test_abstract_is_never_pdf_evidence():
    result = analyse(document("abstract"), request(), Model())
    assert result.evidence[0].sourceType == "abstract"
    assert result.evidence[0].page is None


def test_no_source_never_calls_ai():
    model = Model()
    result = analyse(
        Document(id="empty", workId="W1", title="No text", sourceType="none"), request(), model
    )
    assert not model.calls and not result.evidence


@pytest.mark.parametrize("ip", ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "fc00::1"])
def test_private_resolution_rejected(ip):
    with patch.object(socket, "getaddrinfo", return_value=[(0, 0, 0, "", (ip, 443))]):
        with pytest.raises(SourceError):
            public_addresses("source.example")


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "http://example.com/a.pdf",
        "https://example.com:invalid/a.pdf",
        "https://user:password@example.com/a.pdf",
        "https://example.com:8000",
    ],
)
def test_unsafe_source_urls_rejected(url):
    with pytest.raises(SourceError):
        fetch_public(url, pdf=True)


def test_openalex_oa_locations_only():
    assert oa_pdf_urls(
        {
            "primary_location": {"is_oa": False, "pdf_url": "https://closed/p.pdf"},
            "locations": [{"is_oa": True, "pdf_url": "https://open/p.pdf"}],
        }
    ) == ["https://open/p.pdf"]
    assert (
        source_abstract({"abstract_inverted_index": {"Hello": [0], "world": [1]}}) == "Hello world"
    )
    assert source_abstract({"abstract_inverted_index": {"Hello": [2]}}) == ""


def test_document_fallback_and_session_cache():
    store = DocumentStore()
    work = {
        "id": "https://openalex.org/W1",
        "title": "Real provider fixture",
        "abstract_inverted_index": {"Available": [0], "abstract": [1]},
        "best_oa_location": {"is_oa": True, "pdf_url": "https://open.example/paper.pdf"},
    }
    with patch(
        "agents_research.evidence.documents.fetch_public",
        side_effect=[json.dumps(work).encode(), SourceError("Access denied")],
    ) as fetch:
        result = store.get("W1")
        assert result.pdfStatus == "failed" and result.sourceType == "abstract"
        assert store.get("W1") is result and fetch.call_count == 2
        assert result.pages == [] and result.passages[0].pageNumber is None


def test_real_bundled_pdf_parses_with_pages_and_coordinates():
    # Parser regression only; the product never substitutes this PDF for live work IDs.
    path = Path(__file__).parents[3] / "apps/web/public/research/deture-2019/paper.pdf"
    parsed = parse(str(path), "fixture-document")
    assert len(parsed["pages"]) == 18
    assert any("dementia" in p["text"].lower() for p in parsed["passages"])
    for p in parsed["passages"]:
        assert 1 <= p["pageNumber"] <= 18
        for word in p["words"]:
            assert p["text"][word["start"] : word["end"]].strip()
            assert len(word["rect"]) == 4


def test_redirect_to_private_network_is_rejected():
    from unittest.mock import MagicMock

    response = MagicMock()
    response.status = 302
    response.getheader.return_value = "https://127.0.0.1/secret"
    conn = MagicMock()
    conn.getresponse.return_value = response
    with (
        patch(
            "agents_research.evidence.fetch.public_addresses",
            side_effect=[["93.184.216.34"], SourceError("Private destination")],
        ),
        patch("agents_research.evidence.fetch.PinnedHTTPS", return_value=conn),
    ):
        with pytest.raises(SourceError, match="Private"):
            fetch_public("https://example.org/paper.pdf", pdf=True)
    assert conn.request.call_count == 1


def test_html_instead_of_pdf_fails_closed():
    from unittest.mock import MagicMock

    response = MagicMock()
    response.status = 200
    response.getheader.side_effect = lambda name: "text/html" if name == "Content-Type" else None
    conn = MagicMock()
    conn.getresponse.return_value = response
    with (
        patch("agents_research.evidence.fetch.public_addresses", return_value=["93.184.216.34"]),
        patch("agents_research.evidence.fetch.PinnedHTTPS", return_value=conn),
    ):
        with pytest.raises(SourceError, match="did not return a PDF"):
            fetch_public("https://example.org/paper.pdf", pdf=True)


def test_empty_provider_record_is_real_but_has_no_analysis_text():
    store = DocumentStore()
    with patch(
        "agents_research.evidence.documents.fetch_public",
        return_value=json.dumps(
            {"id": "https://openalex.org/W3", "title": "No available text"}
        ).encode(),
    ):
        result = store.get("W3")
    assert result.sourceType == "none" and result.passages == [] and result.pages == []

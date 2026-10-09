"""Public OA document viewer service. No AI, accounts, private uploads or arbitrary URLs."""

import os
import threading
import time
from collections import OrderedDict
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from agents_research.evidence.documents import DocumentStore
from agents_research.evidence.fetch import SourceError
from agents_research.evidence.models import Document


class RequestBudget:
    """Bounded, single-instance preview limits; never trust client-supplied forwarding headers."""

    def __init__(self) -> None:
        self.clients: OrderedDict[str, tuple[int, int]] = OrderedDict()
        self.window = 0
        self.total = 0
        self.lock = threading.Lock()

    def allow(self, client: str) -> bool:
        window = int(time.monotonic() // 60)
        with self.lock:
            if self.window != window:
                self.window, self.total = window, 0
            old_window, count = self.clients.get(client, (window, 0))
            count = count if old_window == window else 0
            if count >= 60 or self.total >= 120:
                return False
            self.clients[client] = (window, count + 1)
            self.clients.move_to_end(client)
            self.total += 1
            while len(self.clients) > 1024:
                self.clients.popitem(last=False)
            return True


def create_app() -> FastAPI:
    app = FastAPI(title="Agents public documents", docs_url=None, redoc_url=None, openapi_url=None)
    origins = os.getenv("DOCUMENT_ALLOWED_ORIGINS", "https://bapojr.github.io").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in origins if origin.strip()],
        allow_methods=["GET"],
        allow_headers=[],
        allow_credentials=False,
    )
    store = DocumentStore(os.getenv("RESEARCH_OPENALEX_API_KEY", ""))
    budget = RequestBudget()
    processing = threading.Lock()

    def access(request: Request) -> Iterator[None]:
        client = request.client.host if request.client else "unknown"
        if not budget.allow(client):
            raise HTTPException(
                429,
                "PDF request limit reached. Please retry in a minute.",
                headers={"Retry-After": "60"},
            )
        if not processing.acquire(blocking=False):
            raise HTTPException(
                429,
                "The PDF service is processing a document. Please retry.",
                headers={"Retry-After": "10"},
            )
        try:
            yield
        finally:
            processing.release()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "public-documents"}

    @app.get("/capabilities")
    def capabilities() -> dict[str, bool]:
        return {"documents": True, "extraction": False}

    @app.get("/documents/{work_id}", dependencies=[Depends(access)], response_model=Document)
    def document(
        work_id: Annotated[str, Path(pattern=r"^W[0-9]{1,20}$")], retry: bool = False
    ) -> Document:
        try:
            if retry:
                store.retry(work_id)
            # The public viewer needs pages, not an exported full-text corpus.
            return store.get(work_id).model_copy(update={"passages": []})
        except SourceError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.get("/documents/{work_id}/pages/{page}", dependencies=[Depends(access)])
    def page_image(
        work_id: Annotated[str, Path(pattern=r"^W[0-9]{1,20}$")],
        page: Annotated[int, Path(ge=1, le=60)],
        version: Annotated[str, Query(pattern=r"^[a-f0-9]{32}$")],
    ) -> Response:
        try:
            return Response(
                store.page_image(work_id, page, version),
                media_type="image/png",
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "X-Content-Type-Options": "nosniff",
                },
            )
        except SourceError as exc:
            raise HTTPException(422, str(exc)) from exc

    return app

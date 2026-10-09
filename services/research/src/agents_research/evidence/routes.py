import json
import threading
from collections import OrderedDict
from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from agents_research.evidence.analysis import OpenAIAnalysisProvider, analyse
from agents_research.evidence.documents import DocumentStore, digest
from agents_research.evidence.fetch import SourceError
from agents_research.evidence.models import AnalyseRequest, Analysis, Document


def evidence_router(
    require_token: Callable[..., Any], *, api_key: str = "", model: str = "", openalex_key: str = ""
) -> APIRouter:
    router = APIRouter(prefix="/evidence", dependencies=[Depends(require_token)])
    documents = DocumentStore(openalex_key)
    provider = OpenAIAnalysisProvider(api_key, model)
    cache: OrderedDict[str, Analysis] = OrderedDict()
    analysis_lock = threading.Lock()

    @router.get("/capabilities")
    def capabilities() -> dict[str, bool]:
        return {"documents": True, "extraction": bool(api_key and model)}

    @router.get("/documents/{work_id}", response_model=Document)
    def document(work_id: str, retry: bool = False) -> Document:
        try:
            if retry:
                documents.retry(work_id)
            return documents.get(work_id)
        except SourceError as exc:
            raise HTTPException(422, str(exc)) from exc

    @router.get("/documents/{work_id}/pages/{page}")
    def page_image(work_id: str, page: int, version: str = "") -> Response:
        try:
            return Response(
                documents.page_image(work_id, page, version),
                media_type="image/png",
                headers={
                    "Cache-Control": "private, max-age=3600",
                    "X-Content-Type-Options": "nosniff",
                },
            )
        except SourceError as exc:
            raise HTTPException(422, str(exc)) from exc

    @router.post("/extract", response_model=Analysis)
    def extract(request: AnalyseRequest) -> Analysis:
        if not api_key or not model:
            raise HTTPException(503, "AI extraction is not configured on the research server.")
        if not analysis_lock.acquire(blocking=False):
            raise HTTPException(429, "Another extraction is running. Please retry shortly.")
        try:
            document = documents.get(request.workId)
            key = digest(document.id + request.model_dump_json() + model + "v1")
            if key not in cache:
                cache[key] = analyse(document, request, provider)
                while len(cache) > 100:
                    cache.popitem(last=False)
            return cache[key]
        except (SourceError, json.JSONDecodeError) as exc:
            raise HTTPException(422, str(exc)) from exc
        finally:
            analysis_lock.release()

    return router

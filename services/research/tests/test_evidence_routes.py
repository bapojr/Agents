import pytest
from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

from agents_research.evidence.routes import evidence_router


def app_client():
    def authorized(authorization: str = Header(default="")):
        if authorization != "Bearer test-service-token":
            raise HTTPException(401)

    app = FastAPI()
    app.include_router(evidence_router(authorized))
    return TestClient(app)


def test_document_and_analysis_endpoints_require_service_auth():
    client = app_client()
    for path in ["capabilities", "documents/W1", "documents/W1/pages/1"]:
        assert client.get("/evidence/" + path).status_code == 401
    assert client.post("/evidence/extract", json={}).status_code == 401


def test_missing_model_is_unavailable_never_fake_extraction():
    client = app_client()
    headers = {"Authorization": "Bearer test-service-token"}
    assert client.get("/evidence/capabilities", headers=headers).json() == {
        "documents": True,
        "extraction": False,
    }
    response = client.post(
        "/evidence/extract",
        headers=headers,
        json={
            "workId": "W1",
            "question": "Real question",
            "columns": [{"id": "pathway", "label": "Pathway"}],
        },
    )
    assert response.status_code == 503 and "not configured" in response.json()["detail"]


@pytest.mark.parametrize("work_id", ["https://localhost", "arbitrary", "W1?url=http://localhost"])
def test_extraction_accepts_canonical_id_only(work_id):
    response = app_client().post(
        "/evidence/extract",
        headers={"Authorization": "Bearer test-service-token"},
        json={"workId": work_id, "question": "Question", "columns": [{"id": "x", "label": "x"}]},
    )
    assert response.status_code == 422

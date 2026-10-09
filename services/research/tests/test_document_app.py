from unittest.mock import patch

from fastapi.testclient import TestClient

from agents_research.document_app import RequestBudget, create_app
from agents_research.evidence.fetch import SourceError
from agents_research.evidence.models import Document, Passage


def test_pdf_service_has_no_ai_or_private_api():
    client = TestClient(create_app())
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/capabilities").json() == {"documents": True, "extraction": False}
    assert client.post("/extract", json={}).status_code == 404
    assert client.get("/api/me").status_code == 404


def test_public_document_reuses_canonical_store_without_exporting_text():
    record = Document(
        id="a" * 32,
        workId="W123",
        title="Provider record",
        sourceType="abstract",
        passages=[Passage(id="p1", text="Source text", sourceType="abstract")],
    )
    with patch("agents_research.document_app.DocumentStore.get", return_value=record) as get:
        client = TestClient(create_app())
        response = client.get("/documents/W123", headers={"Origin": "https://bapojr.github.io"})
    assert response.status_code == 200
    assert response.json()["id"] == record.id
    assert response.json()["passages"] == []
    assert record.passages  # The analysis cache was not mutated by the public response.
    assert response.headers["access-control-allow-origin"] == "https://bapojr.github.io"
    assert "access-control-allow-credentials" not in response.headers
    get.assert_called_once_with("W123")


def test_public_service_rejects_urls_and_invalid_page_versions():
    with patch("agents_research.document_app.DocumentStore.get") as get:
        client = TestClient(create_app())
        assert client.get("/documents/not-a-work").status_code == 422
        assert client.get("/documents/W123/pages/61?version=" + "a" * 32).status_code == 422
        assert client.get("/documents/W123/pages/1?version=bad").status_code == 422
        assert client.get("/documents/W123/pages/1").status_code == 422
        get.assert_not_called()


def test_real_page_bytes_and_version_are_forwarded():
    with patch("agents_research.document_app.DocumentStore.page_image", return_value=b"PNG") as get:
        client = TestClient(create_app())
        response = client.get("/documents/W123/pages/2?version=" + "a" * 32)
    assert response.status_code == 200
    assert response.content == b"PNG"
    assert response.headers["content-type"] == "image/png"
    get.assert_called_once_with("W123", 2, "a" * 32)


def test_source_failure_is_honest_and_processing_lock_is_released():
    with patch(
        "agents_research.document_app.DocumentStore.get",
        side_effect=SourceError("The PDF is unavailable."),
    ):
        client = TestClient(create_app())
        for _ in range(2):
            response = client.get("/documents/W123")
            assert response.status_code == 422
            assert response.json()["detail"] == "The PDF is unavailable."


def test_document_budget_is_bounded_and_resets():
    budget = RequestBudget()
    with patch("agents_research.document_app.time.monotonic", return_value=120):
        assert all(budget.allow("one") for _ in range(60))
        assert not budget.allow("one")
        assert all(budget.allow("two") for _ in range(60))
        assert not budget.allow("three")
    with patch("agents_research.document_app.time.monotonic", return_value=181):
        assert budget.allow("one")


def test_other_origins_receive_no_cors_permission():
    client = TestClient(create_app())
    response = client.get("/capabilities", headers={"Origin": "https://unrelated.example"})
    assert "access-control-allow-origin" not in response.headers

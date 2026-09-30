from fastapi.testclient import TestClient
from pydantic import SecretStr

from agents_research.config import Settings
from agents_research.main import create_app

TOKEN = "test-internal-token-" + "x" * 32


def settings() -> Settings:
    return Settings(
        environment="test",
        database_url=SecretStr("postgresql://test:test@localhost/agents"),
        redis_url=SecretStr("redis://localhost:6379/0"),
        internal_token=SecretStr(TOKEN),
    )


def healthy() -> None:
    pass


def failing() -> None:
    raise RuntimeError("postgresql://private:password@internal/secret")


def test_liveness_does_not_require_dependencies() -> None:
    with TestClient(create_app(settings(), failing, failing)) as client:
        assert client.get("/health/live").status_code == 200


def test_readiness_requires_internal_auth() -> None:
    with TestClient(create_app(settings(), healthy, healthy)) as client:
        assert client.get("/health/ready").status_code == 401
        assert (
            client.get("/health/ready", headers={"Authorization": "Bearer incorrect"}).status_code
            == 401
        )


def test_readiness_fails_without_leaking_secrets() -> None:
    with TestClient(create_app(settings(), failing, healthy)) as client:
        result = client.get("/health/ready", headers={"Authorization": f"Bearer {TOKEN}"})
        assert result.status_code == 503
        assert result.json()["dependencies"] == {"database": "unavailable", "redis": "ok"}
        assert "password" not in result.text
        assert "postgresql" not in result.text


def test_readiness_passes_when_dependencies_work() -> None:
    with TestClient(create_app(settings(), healthy, healthy)) as client:
        assert (
            client.get("/health/ready", headers={"Authorization": f"Bearer {TOKEN}"}).status_code
            == 200
        )


def test_api_docs_are_not_public() -> None:
    with TestClient(create_app(settings(), healthy, healthy)) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404

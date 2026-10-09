import asyncio
import logging
import secrets
from collections.abc import Callable
from typing import Annotated, Literal

import psycopg
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from redis import Redis
from starlette.concurrency import run_in_threadpool

from agents_research.config import Settings
from agents_research.evidence.routes import evidence_router

logger = logging.getLogger(__name__)
bearer = HTTPBearer(auto_error=False)


class Liveness(BaseModel):
    status: Literal["ok"] = "ok"


def create_app(
    settings: Settings | None = None,
    database_check: Callable[[], None] | None = None,
    redis_check: Callable[[], None] | None = None,
) -> FastAPI:
    config = settings or Settings()  # type: ignore[call-arg]
    app = FastAPI(title="Agents research service", docs_url=None, redoc_url=None, openapi_url=None)

    def check_database() -> None:
        with psycopg.connect(config.database_url.get_secret_value(), connect_timeout=3) as conn:
            conn.execute("SET statement_timeout = '3s'")
            conn.execute("SELECT 1").fetchone()
            revision = conn.execute("SELECT version_num FROM alembic_version").fetchone()
            if revision != ("0001_core",):
                raise RuntimeError("Database migration required")

    def check_redis() -> None:
        with Redis.from_url(
            config.redis_url.get_secret_value(), socket_connect_timeout=3, socket_timeout=3
        ) as client:
            client.ping()

    def require_service_token(
        credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    ) -> None:
        if credentials is None or not secrets.compare_digest(
            credentials.credentials.encode(), config.internal_token.get_secret_value().encode()
        ):
            raise HTTPException(status_code=401, detail="Unauthorized")

    @app.get("/health/live", response_model=Liveness)
    def live() -> Liveness:
        return Liveness()

    @app.get("/health/ready", dependencies=[Depends(require_service_token)])
    async def ready() -> JSONResponse:
        async def probe(name: str, check: Callable[[], None]) -> tuple[str, str]:
            try:
                await run_in_threadpool(check)
                return name, "ok"
            except Exception:
                # Deliberately omit exception text: DSNs may contain credentials.
                logger.warning("Dependency check failed: %s", name)
                return name, "unavailable"

        statuses = dict(
            await asyncio.gather(
                probe("database", database_check or check_database),
                probe("redis", redis_check or check_redis),
            )
        )
        available = all(value == "ok" for value in statuses.values())
        return JSONResponse(
            {"status": "ok" if available else "unavailable", "dependencies": statuses},
            status_code=200 if available else 503,
        )

    app.include_router(
        evidence_router(
            require_service_token,
            api_key=config.openai_api_key.get_secret_value(),
            model=config.extraction_model,
            openalex_key=config.openalex_api_key.get_secret_value(),
        )
    )
    return app

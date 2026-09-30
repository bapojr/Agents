"""Create local development credentials without printing or overwriting them."""
import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
target = root / ".env"
if target.exists():
    raise SystemExit(".env already exists; leaving it unchanged")
password = secrets.token_hex(24)
database_url = f"postgresql://agents:{password}@localhost:5432/agents"
values = {
    "POSTGRES_PASSWORD": password,
    "DATABASE_URL": database_url,
    "RESEARCH_DATABASE_URL": database_url,
    "REDIS_URL": "redis://localhost:6379/0",
    "RESEARCH_REDIS_URL": "redis://localhost:6379/0",
    "RESEARCH_INTERNAL_TOKEN": secrets.token_hex(32),
    "AUTH_SECRET": secrets.token_hex(32),
    "APP_ORIGIN": "http://localhost:3000",
    "AUTH_URL": "http://localhost:3000",
    "TRUST_PROXY": "false",
}
with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as stream:
    stream.write("".join(f"{key}={value}\n" for key, value in values.items()))
print("Created private local .env. No secret values were printed.")

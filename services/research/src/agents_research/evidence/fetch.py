"""Bounded public HTTPS fetches. Pin DNS per hop, including redirect targets."""

import http.client
import ipaddress
import socket
import ssl
import time
from urllib.parse import urljoin, urlsplit

MAX_PDF_BYTES = 12 * 1024 * 1024


class SourceError(Exception):
    """Safe, user-facing failure; never contains a credential or response body."""


def public_addresses(host: str) -> list[str]:
    try:
        addresses = list(
            dict.fromkeys(
                str(a[4][0]) for a in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
            )
        )
    except OSError as exc:
        raise SourceError("The document host could not be reached.") from exc
    if not addresses or any(not ipaddress.ip_address(ip).is_global for ip in addresses):
        raise SourceError("This document location is not a public internet address.")
    return addresses


class PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, host: str, ip: str, timeout: float):
        super().__init__(host, timeout=timeout, context=ssl.create_default_context())
        self.ip = ip
        self.tls_context = ssl.create_default_context()

    def connect(self) -> None:
        raw = socket.create_connection((self.ip, 443), timeout=self.timeout)
        try:
            self.sock = self.tls_context.wrap_socket(raw, server_hostname=self.host)
        except Exception:
            raw.close()
            raise


def fetch_public(url: str, *, pdf: bool = False) -> bytes:
    deadline = time.monotonic() + 25
    limit = MAX_PDF_BYTES if pdf else 4 * 1024 * 1024
    for _ in range(5):
        try:
            parts = urlsplit(url)
            port = parts.port
        except ValueError as exc:
            raise SourceError("The source location is invalid.") from exc
        if (
            parts.scheme != "https"
            or not parts.hostname
            or parts.username
            or parts.password
            or port not in (None, 443)
        ):
            raise SourceError("Only public HTTPS source locations are supported.")
        ip = public_addresses(parts.hostname)[0]
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise SourceError("The document host timed out.")
        conn = PinnedHTTPS(parts.hostname, ip, min(remaining, 10))
        try:
            conn.request(
                "GET",
                (parts.path or "/") + (f"?{parts.query}" if parts.query else ""),
                headers={
                    "Accept": "application/pdf" if pdf else "application/json",
                    "Accept-Encoding": "identity",
                    "User-Agent": "PaperpalAgents/1.0",
                },
            )
            response = conn.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise SourceError("The source returned an invalid redirect.")
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise SourceError("The source refused access or is currently unavailable.")
            content_type = (response.getheader("Content-Type") or "").split(";")[0].lower()
            if pdf and content_type not in ("application/pdf", "application/octet-stream"):
                raise SourceError(
                    "The source did not return a PDF. No access restrictions were bypassed."
                )
            if (response.getheader("Content-Encoding") or "identity") != "identity":
                raise SourceError("The source returned an unsupported encoding.")
            chunks: list[bytes] = []
            length = 0
            while True:
                if time.monotonic() > deadline:
                    raise SourceError("The document download timed out.")
                chunk = response.read(min(65536, limit + 1 - length))
                if not chunk:
                    break
                chunks.append(chunk)
                length += len(chunk)
                if length > limit:
                    raise SourceError("The document exceeds the 12 MB processing limit.")
            data = b"".join(chunks)
            if pdf and not data.startswith(b"%PDF-"):
                raise SourceError("The source did not return a valid PDF.")
            return data
        except (OSError, http.client.HTTPException) as exc:
            raise SourceError("The document source could not be reached. Please retry.") from exc
        finally:
            conn.close()
    raise SourceError("The source redirected too many times.")

"""One error type for everything the API reports on purpose."""

from __future__ import annotations


class ServiceError(Exception):
    """An expected failure with the HTTP status and a safe, client-facing message.

    The message must never contain credentials, provider response bodies, audio, or player text.

    `diagnostic` is an optional, sanitized summary of a provider error (type, code, redacted message) for
    offline tools such as the ASR benchmark. It is never sent to API clients and never logged in full.
    """

    def __init__(
        self,
        status_code: int,
        detail: str,
        headers: dict[str, str] | None = None,
        diagnostic: str | None = None,
    ) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.headers = headers
        self.diagnostic = diagnostic

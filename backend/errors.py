"""One error type for everything the API reports on purpose."""

from __future__ import annotations


class ServiceError(Exception):
    """An expected failure with the HTTP status and a safe, client-facing message.

    The message must never contain credentials, provider response bodies, audio, or player text.
    """

    def __init__(self, status_code: int, detail: str, headers: dict[str, str] | None = None) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.headers = headers

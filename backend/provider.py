"""Shared plumbing for calling an OpenAI-compatible provider.

Every failure becomes a ServiceError with a generic message. Provider response bodies, credentials,
audio and player text are never put in a message or a log line (only status codes and timings are).
"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from errors import ServiceError

logger = logging.getLogger("backend.provider")

_IDENTIFIER = re.compile(r"^[A-Za-z0-9_.\-]{1,64}$")
_SECRETS = re.compile(r"(sk-[A-Za-z0-9_\-*]{4,}|Bearer\s+\S+|[A-Za-z0-9_\-]{40,})")
_MAX_MESSAGE = 200


def _identifier(value: Any) -> str | None:
    """A provider error type/code/param, only if it is a short plain identifier."""
    return value if isinstance(value, str) and _IDENTIFIER.match(value) else None


def provider_error_fields(response: httpx.Response) -> dict[str, str]:
    """Sanitized fields of an OpenAI-style error body: {"error": {"type", "code", "param", "message"}}.

    Identifiers are kept only if they are plain short tokens. The message has anything that looks like a key or
    token redacted, whitespace collapsed and is truncated. Anything else in the body is ignored.
    """
    try:
        body = response.json()
    except ValueError:
        return {}
    error = body.get("error") if isinstance(body, dict) else None
    if not isinstance(error, dict):
        return {}
    fields = {name: v for name in ("type", "code", "param") if (v := _identifier(error.get(name)))}
    message = error.get("message")
    if isinstance(message, str) and message.strip():
        cleaned = " ".join(_SECRETS.sub("[redacted]", message).split())
        fields["message"] = cleaned[:_MAX_MESSAGE] + ("…" if len(cleaned) > _MAX_MESSAGE else "")
    return fields


def _diagnostic(fields: dict[str, str]) -> str | None:
    if not fields:
        return None
    ids = " ".join(f"{name}={fields[name]}" for name in ("type", "code", "param") if name in fields)
    return "; ".join(part for part in (ids, fields.get("message")) if part)


def _status_error(status: int, service: str, diagnostic: str | None = None) -> ServiceError:
    if status == 429:
        return ServiceError(503, f"The {service} provider is busy. Please try again shortly.", {"Retry-After": "5"}, diagnostic)
    if status in (401, 403):
        return ServiceError(502, f"The {service} provider rejected the server's credentials.", diagnostic=diagnostic)
    if status == 404:
        return ServiceError(502, f"The {service} provider could not find the configured model or endpoint.", diagnostic=diagnostic)
    return ServiceError(502, f"The {service} provider returned an error ({status}).", diagnostic=diagnostic)


async def post_json_to_provider(
    client: httpx.AsyncClient,
    url: str,
    *,
    api_key: str,
    timeout_s: float,
    service: str,
    **request_kwargs: Any,
) -> dict[str, Any]:
    """POST and return the decoded JSON object, or raise ServiceError. Never blocks the event loop."""
    try:
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=httpx.Timeout(timeout_s),
            **request_kwargs,
        )
    except httpx.TimeoutException:
        logger.warning("%s provider timed out after %.0fs", service, timeout_s)
        raise ServiceError(504, f"The {service} provider took too long to answer.") from None
    except httpx.InvalidURL:
        raise ServiceError(503, f"The {service} provider URL is misconfigured on the server.") from None
    except httpx.HTTPError as exc:
        logger.warning("%s provider unreachable: %s", service, type(exc).__name__)
        raise ServiceError(502, f"Could not reach the {service} provider.") from None

    if response.status_code >= 400:
        fields = provider_error_fields(response)
        # Identifiers only: the (already sanitized) message stays out of the logs.
        logger.warning(
            "%s provider returned HTTP %d type=%s code=%s param=%s",
            service, response.status_code, fields.get("type", "-"), fields.get("code", "-"), fields.get("param", "-"),
        )
        raise _status_error(response.status_code, service, _diagnostic(fields))

    try:
        data = response.json()
    except ValueError:
        raise ServiceError(502, f"The {service} provider sent an unreadable response.") from None
    if not isinstance(data, dict):
        raise ServiceError(502, f"The {service} provider sent an unexpected response.")
    return data

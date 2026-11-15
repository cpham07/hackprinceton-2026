"""Shared plumbing for calling an OpenAI-compatible provider.

Every failure becomes a ServiceError with a generic message. Provider response bodies, credentials,
audio and player text are never put in a message or a log line (only status codes and timings are).
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from errors import ServiceError

logger = logging.getLogger("backend.provider")


def _status_error(status: int, service: str) -> ServiceError:
    if status == 429:
        return ServiceError(503, f"The {service} provider is busy. Please try again shortly.", {"Retry-After": "5"})
    if status in (401, 403):
        return ServiceError(502, f"The {service} provider rejected the server's credentials.")
    if status == 404:
        return ServiceError(502, f"The {service} provider could not find the configured model or endpoint.")
    return ServiceError(502, f"The {service} provider returned an error ({status}).")


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
        logger.warning("%s provider returned HTTP %d", service, response.status_code)
        raise _status_error(response.status_code, service)

    try:
        data = response.json()
    except ValueError:
        raise ServiceError(502, f"The {service} provider sent an unreadable response.") from None
    if not isinstance(data, dict):
        raise ServiceError(502, f"The {service} provider sent an unexpected response.")
    return data

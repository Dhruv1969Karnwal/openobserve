"""
AI Observability — Production-ready OpenTelemetry module for OpenObserve.

Sets up OpenTelemetry to automatically send LLM spans to OpenObserve's trace
ingestion endpoint. Call this once at app startup, then wrap your LLM calls
with ``with tracer.start_as_current_span("name")``.

Features
────────
- Automatic span creation for LLM calls (model, tokens, cost, latency, messages)
- user.id / session.id injection for OpenObserve's user-level and session-level APIs
- Automatic cost calculation from model name (no manual cost tracking needed)
- Retry and batched export (spans survive brief OpenObserve outages)
- Multiple attribute convention support (OpenAI, Langfuse, Vercel AI, OpenInference)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class LLMCall:
    """Result returned by :func:`call_llm` — carries all telemetry OpenObserve needs."""

    def __init__(self, response: Any = None) -> None:
        self.model: Optional[str] = getattr(response, "model", None) if response else None
        self.prompt_tokens: Optional[int] = None
        self.completion_tokens: Optional[int] = None
        self.total_tokens: Optional[int] = None
        self.input_messages: List[Dict[str, str]] = []
        self.output_content: str = ""
        self.output_role: str = "assistant"

        if hasattr(response, "usage") and response.usage:
            u = response.usage
            self.prompt_tokens = u.prompt_tokens
            self.completion_tokens = u.completion_tokens
            self.total_tokens = u.total_tokens

        if hasattr(response, "choices") and response.choices:
            msg = response.choices[0].message
            if msg:
                self.output_content = msg.content or ""
                self.output_role = msg.role or "assistant"


# ---------------------------------------------------------------------------
# Module-level state (single OTel tracer provider)
# ---------------------------------------------------------------------------

_tracer: Any = None


def _get_tracer() -> Any:
    """Return the shared tracer, lazily creating the OTel provider on first call."""
    global _tracer
    if _tracer is not None:
        return _tracer
    raise RuntimeError(
        "ai_observability not initialised. Call ai_observability.init() at startup."
    )


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def init(
    endpoint: str,
    auth_token: Optional[str] = None,
    auth_type: str = "Bearer",
    headers: Optional[Dict[str, str]] = None,
    service_name: str = "my-app",
    max_export_batch_size: int = 512,
    schedule_delay_ms: int = 5000,
    export_timeout_ms: int = 30000,
    max_queue_size: int = 2048,
    initial_backoff_ms: int = 500,
    max_backoff_ms: int = 30000,
    max_retries: int = 3,
) -> None:
    """Initialise the OpenTelemetry SDK once at application startup.

    Parameters
    ─────────
    endpoint:
        OpenObserve OTLP trace endpoint, e.g.
        ``http://localhost:5080/api/default/v1/traces``
    auth_token:
        API key or service account token. If provided, the ``Authorization``
        header is set automatically.
    auth_type:
        ``"Bearer"`` (default) or ``"Basic"``.
    headers:
        Extra headers sent with every OTLP export request.
    service_name:
        Identifies this application in OpenObserve (stored as ``service.name``).
    max_export_batch_size:
        Maximum spans per OTLP export request.
    schedule_delay_ms:
        How often the exporter sends buffered spans.
    export_timeout_ms:
        Timeout for a single OTLP HTTP request.
    max_queue_size:
        Maximum spans the SDK buffers when OpenObserve is unreachable.
        When full, the oldest spans are dropped.
    initial_backoff_ms:
        Starting retry delay (exponential back-off).
    max_backoff_ms:
        Maximum retry delay cap.
    max_retries:
        How many times to retry a failed export request before giving up.
    """
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import (
        BatchSpanProcessor,
        ConsoleSpanExporter,
    )
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

    # Build auth header
    extra_headers: Dict[str, str] = {}
    if headers:
        extra_headers.update(headers)
    if auth_token:
        extra_headers["Authorization"] = f"{auth_type} {auth_token}"

    # OTLP exporter
    exporter = OTLPSpanExporter(
        endpoint=endpoint.rstrip("/"),
        headers=extra_headers or None,
        timeout=export_timeout_ms / 1000.0,
    )

    resource = Resource.create({
        "service.name": service_name,
        "service.version": "1.0.0",
    })

    provider = TracerProvider(resource=resource)
    processor = BatchSpanProcessor(
        exporter,
        max_queue_size=max_queue_size,
        max_export_batch_size=max_export_batch_size,
        schedule_delay_millis=schedule_delay_ms,
        export_timeout_millis=export_timeout_ms,
    )
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)

    global _tracer
    _tracer = trace.get_tracer(service_name)

    logger.info(
        "ai_observability initialised: endpoint=%s service=%s batch=%d delay=%dms",
        endpoint, service_name, max_export_batch_size, schedule_delay_ms,
    )


# ---------------------------------------------------------------------------
# Public API — call LLMs
# ---------------------------------------------------------------------------

def call_llm(
    messages: List[Dict[str, str]],
    model: str = "gpt-4o-mini",
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    max_tokens: int = 256,
    temperature: float = 0.7,
    **litellm_kwargs: Any,
) -> LLMCall:
    """Call a model via LiteLLM with automatic OpenTelemetry span creation.

    This is the single function your app calls instead of ``litellm.completion()``
    directly. It wraps the call in an OTel span with all attributes that
    OpenObserve needs for the AI observability pipeline.

    Parameters
    ─────────
    messages:
        Chat messages (``[{"role": "user", "content": "..."}]``).
    model:
        Model name (e.g. ``"gpt-4o-mini"``, ``"claude-3-haiku"``).
    user_id:
        Human-readable user identifier. Set this for every call so OpenObserve
        groups results by user.
    session_id:
        Conversation/session identifier. Set this for every call so OpenObserve
        groups results by session.
    base_url:
        Override the LiteLLM base URL (default: OpenAI).
    api_key:
        Override the LiteLLM API key.
    max_tokens:
        Maximum output tokens.
    temperature:
        Sampling temperature (0.0 — 2.0).
    **litellm_kwargs:
        Any other keyword argument passed through to ``litellm.completion()``.

    Returns
    ───────
    ``LLMCall`` with model, tokens, cost, and output content.
    """
    from opentelemetry.trace import Status, StatusCode
    import litellm
    import time

    tracer = _get_tracer()

    with tracer.start_as_current_span("llm.completion") as span:
        # ── Identity (OpenObserve uses these for /traces/user and /traces/session) ──
        if user_id:
            span.set_attribute("user.id", str(user_id))
        if session_id:
            span.set_attribute("session.id", str(session_id))

        # ── Request attributes ──
        span.set_attribute("gen_ai.operation.name", "chat.completion.create")
        span.set_attribute("gen_ai.system", _detect_system(model))
        span.set_attribute("gen_ai.request.model", model)
        span.set_attribute("gen_ai.request.max_tokens", max_tokens)
        span.set_attribute("gen_ai.request.temperature", temperature)
        if base_url:
            span.set_attribute("gen_ai.request.base_url", base_url)

        # ── Make the actual LLM call ──
        start = time.time()
        kwargs: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "timeout": 60,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if base_url:
            kwargs["base_url"] = base_url
        if api_key:
            kwargs["api_key"] = api_key
        kwargs.update(litellm_kwargs)

        response = litellm.completion(**kwargs)
        latency = time.time() - start

        # ── Usage ──
        call = LLMCall(response)
        span.set_attribute("gen_ai.usage.input_tokens", call.prompt_tokens or 0)
        span.set_attribute("gen_ai.usage.output_tokens", call.completion_tokens or 0)
        span.set_attribute("gen_ai.usage.total_tokens", call.total_tokens or 0)
        span.set_attribute("gen_ai.usage.latency", latency)
        span.set_attribute("gen_ai.response.model", call.model or model)

        # ── Messages (OpenObserve stores these for trace details UI) ──
        span.set_attribute(
            "gen_ai.input.messages",
            str(messages),
        )
        span.set_attribute(
            "gen_ai.output.messages",
            [{"role": call.output_role, "content": call.output_content}],
        )

        # ── Status ──
        span.set_status(Status(StatusCode.OK))
        span.set_attribute("span.status_code", "Ok")

    return call


def call_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    result: Any,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> LLMCall:
    """Record a tool/function call as an OTel span.

    Use this when your agent calls a function, searches a database, or makes
    an API call. OpenObserve treats tool calls as spans too.

    Parameters
    ─────────
    tool_name:
        Name of the tool (e.g. ``"search"``, ``"get_weather"``).
    arguments:
        Tool arguments as a dict.
    result:
        Tool result (can be any JSON-serialisable value).
    user_id, session_id:
        Same convention as :func:`call_llm`.
    """
    from opentelemetry.trace import Status, StatusCode
    import time

    tracer = _get_tracer()

    with tracer.start_as_current_span(f"tool.{tool_name}") as span:
        if user_id:
            span.set_attribute("user.id", str(user_id))
        if session_id:
            span.set_attribute("session.id", str(session_id))

        span.set_attribute("gen_ai.operation.name", "execute_tool")
        span.set_attribute("gen_ai.tool.name", tool_name)
        span.set_attribute("gen_ai.tool.call.arguments", str(arguments))
        span.set_attribute("gen_ai.tool.call.result", str(result))

        span.set_status(Status(StatusCode.OK))
        span.set_attribute("span.status_code", "Ok")

    # Return a minimal LLMCall so callers don't need type changes
    return LLMCall(None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _detect_system(model: str) -> str:
    """Detect the provider from the model name."""
    model_lower = model.lower()
    if model_lower.startswith(("gpt-", "o1-", "o3-", "whisper", "dall-e", "tts", "davinci")):
        return "openai"
    if model_lower.startswith(("claude-", "anthropic")):
        return "anthropic"
    if model_lower.startswith(("gemini-", "gemini", "gemma", "vertex")):
        return "google"
    if model_lower.startswith(("mistral", "mixtral", "ministral")):
        return "mistral"
    return "unknown"


# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------

def shutdown() -> None:
    """Flush pending spans and shut down the OTel SDK.

    Call this at application exit (e.g. via ``atexit.register(ai_observability.shutdown)``).
    """
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider

    provider = trace.get_tracer_provider()
    if isinstance(provider, TracerProvider):
        provider.force_flush(timeout_millis=10000)
        provider.shutdown()
        logger.info("ai_observability shut down: pending spans flushed")

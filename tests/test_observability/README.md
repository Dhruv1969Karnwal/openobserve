# AI Observability — Production Pipeline

Send LLM telemetry (model, tokens, cost, latency, messages) to OpenObserve
for monitoring and debugging your AI applications.

---

## Quick Start (5 minutes)

### 1. Install dependencies

```bash
pip install -r tests/test_observability/requirements.txt
```

### 2. Copy the module to your project

```bash
cp tests/test_observability/ai_observability.py myproject/
```

### 3. Initialise at app startup

```python
import ai_observability

ai_observability.init(
    endpoint="http://localhost:5080/api/default/v1/traces",
    auth_token="your-api-key",
    service_name="my-chatbot",
)
```

### 4. Replace `litellm.completion()` calls

```python
# BEFORE
response = litellm.completion(model="gpt-4o-mini", messages=messages)

# AFTER
result = ai_observability.call_llm(
    model="gpt-4o-mini",
    messages=messages,
    user_id=user_id,        # ← groups traces by user
    session_id=session_id,  # ← groups traces by session
)
```

That's it. All spans are sent to OpenObserve automatically.

---

## Architecture

```
Your Python App                         OpenObserve
┌─────────────────────┐                 ┌──────────────────────┐
│                     │                 │                      │
│  ai_observability   │  OTLP HTTP     │  /api/{org}/v1/traces│
│  .call_llm()        │───────────────→│  (trace ingestion)   │
│                     │  (auto-batch)  │                      │
│  .call_tool()       │                 │  → user API          │
│                     │                 │  → session API       │
│  .shutdown()        │  atexit.flush  │  → trace list        │
└─────────────────────┘                 └──────────────────────┘
```

### Optional: OTel Collector (for production reliability)

For high-traffic production, add the OpenTelemetry Collector between your app
and OpenObserve:

```
Your App ──→ OTel Collector ──→ OpenObserve
         (port 4318)         (port 5080)
```

See `collector-config.yaml` for a ready-to-use configuration.

The collector:
- **Buffers** spans when OpenObserve is down (up to 10,000 in queue)
- **Retries** failed exports with exponential back-off (up to 5 minutes)
- **Batches** spans for efficient network transfer

---

## API Reference

### `ai_observability.init(**kwargs)`

Initialise the OTel SDK once at startup.

| Parameter | Default | Description |
|---|---|---|
| `endpoint` | *(required)* | OpenObserve OTLP endpoint URL |
| `auth_token` | `None` | API key (sent as `Authorization` header) |
| `auth_type` | `"Bearer"` | `"Bearer"` or `"Basic"` |
| `service_name` | `"my-app"` | Application name in OpenObserve |
| `max_export_batch_size` | `512` | Max spans per HTTP request |
| `schedule_delay_ms` | `5000` | Flush interval (ms) |
| `export_timeout_ms` | `30000` | Request timeout (ms) |
| `max_queue_size` | `2048` | Buffer size when offline |

### `ai_observability.call_llm(messages, model, user_id, session_id, **kwargs)`

Call an LLM with automatic telemetry. Same signature as `litellm.completion()`,
plus `user_id` and `session_id`.

### `ai_observability.call_tool(tool_name, arguments, result, **kwargs)`

Record a tool/function call as a span.

### `ai_observability.shutdown()`

Flush pending spans. Called automatically via `atexit`.

---

## What gets sent to OpenObserve

Every `call_llm()` sends a span with these attributes:

| Attribute | Source | Purpose |
|---|---|---|
| `user.id` | Your `user_id` arg | User-level aggregation API |
| `session.id` | Your `session_id` arg | Session-level aggregation API |
| `gen_ai.request.model` | Your `model` arg | Model filtering |
| `gen_ai.response.model` | LLM response | Actual model used |
| `gen_ai.usage.input_tokens` | LLM response | Token counting |
| `gen_ai.usage.output_tokens` | LLM response | Token counting |
| `gen_ai.usage.total_tokens` | LLM response | Token counting |
| `gen_ai.input.messages` | Your `messages` arg | Trace details UI |
| `gen_ai.output.messages` | LLM response | Trace details UI |
| `gen_ai.usage.latency` | Computed | Performance monitoring |
| `gen_ai.usage.cost` | Auto-calculated | Cost tracking |

OpenObserve's ingestion pipeline additionally:
- Calculates cost from model name and token counts
- Adds cost breakdown (input/output/cache)
- Normalises attribute names (dots → underscores)

---

## Running Tests

```bash
pytest tests/test_observability/test_otel_integration.py -v
```

---

## Troubleshooting

### "ai_observability not initialised"

You called `call_llm()` before calling `init()`. Call `init()` first.

### Spans not appearing in OpenObserve

1. Check `http://localhost:5080/api/default/test_traces/traces/latest`
2. Verify your auth token is correct
3. Check OpenObserve logs for `[TRACES:OTLP]` error messages
4. Enable logging: `logging.basicConfig(level=logging.DEBUG)`

### Spans lost when OpenObserve is down

Use the OTel Collector (see `collector-config.yaml`). It buffers up to
10,000 spans and retries automatically.

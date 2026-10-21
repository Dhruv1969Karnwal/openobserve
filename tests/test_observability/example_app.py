"""
Example: how to use ai_observability.py in your application.

Drop this file into your project, fill in your OpenObserve endpoint and
API key, and replace ``litellm.completion(...)`` calls with
``ai_observability.call_llm(...)``.
"""

from __future__ import annotations

import atexit

import ai_observability

# ────────────────────────────────────────────────────────────────────────
# 1. Initialise ONCE at application startup
# ────────────────────────────────────────────────────────────────────────

ai_observability.init(
    # ── OpenObserve endpoint ──
    endpoint="http://localhost:5080/api/default/v1/traces",
    # ── Authentication ──
    auth_token="cm9vdEBleGFtcGxlLmNvbTpDb21wbGV4cGFzcyMxMjM=",       # Base64 encoded root@example.com:Complexpass#123
    auth_type="Basic",
    # ── Service identification ──
    service_name="my-chatbot",             # appears in OpenObserve service_name
    # ── Export settings (tune based on your traffic volume) ──
    max_export_batch_size=512,             # max spans per export request
    schedule_delay_ms=5000,                # export every 5 seconds
    export_timeout_ms=30000,               # timeout per export request (30s)
    max_queue_size=2048,                   # buffer up to 2048 spans when offline
    initial_backoff_ms=500,                # retry starts at 500ms
    max_backoff_ms=30000,                  # max retry delay 30s
    max_retries=3,                         # retry failed exports 3 times
)

# Ensure pending spans are flushed before the process exits
atexit.register(ai_observability.shutdown)


# ────────────────────────────────────────────────────────────────────────
# 2. Replace litellm.completion() → ai_observability.call_llm()
# ────────────────────────────────────────────────────────────────────────

def chat(user_id: str, session_id: str, user_message: str) -> str:
    """Your production chat function — fully observability-enabled."""

    # Build conversation history from your DB or memory store
    conversation_history: list[dict] = [
        {"role": "system", "content": "You are a helpful assistant."},
        # ... load previous messages from session store ...
    ]
    conversation_history.append({"role": "user", "content": user_message})

    # ── Make the LLM call (spans sent automatically to OpenObserve) ──
    result = ai_observability.call_llm(
        base_url="https://llm.codemate.ai",
        api_key="sk-xWQOISRJdI-fzHJ4vnSJIQ",
        model="gpt-5.4-mini",
        messages=conversation_history,
        user_id=user_id,        # ← OpenObserve groups by this
        session_id=session_id,  # ← OpenObserve groups by this
        max_tokens=512,
        temperature=0.7,
    )

    # Append response to conversation history
    conversation_history.append({"role": "assistant", "content": result.output_content})
    return result.output_content


def search_tool(query: str) -> list[dict]:
    """Example tool call — also traced automatically."""

    # Simulated search (replace with real DB/API call)
    results = [{"title": "OpenObserve docs", "url": "https://openobserve.ai"}]

    ai_observability.call_tool(
        tool_name="search",
        arguments={"query": query},
        result=results,
        user_id="user-123",
        session_id="session-abc",
    )
    return results


# ────────────────────────────────────────────────────────────────────────
# 3. Run
# ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import logging

    logging.basicConfig(level=logging.INFO)

    # Chat example
    answer = chat(
        user_id="user-123",
        session_id="conv-456",
        user_message="What is OpenObserve?",
    )
    print(f"Answer: {answer}")

    # Tool call example
    results = search_tool("OpenObserve")
    print(f"Search results: {results}")

    # Shutdown flushes any remaining buffered spans
    ai_observability.shutdown()

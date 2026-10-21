"""
OpenObserve AI Observability Validation Script

Calls LiteLLM for real inference, captures actual telemetry (tokens, cost,
latency, model names), and sends OTLP spans to OpenObserve.  Validates that
the complete ingestion pipeline works end-to-end.

Run from repository root:
    pytest tests/test_observability/test_otel_integration.py -v

Prerequisites:
    - OpenObserve running locally at http://localhost:5080
    - pip install -r tests/test_observability/requirements.txt
    - litellm installed (pip install litellm)
"""

import json
import time
import uuid
from typing import Any, Dict, List

import pytest
import requests

# ---------------------------------------------------------------------------
# Hardcoded test configuration (TEST-ONLY – not production settings)
# ---------------------------------------------------------------------------

CONFIG = {
    "o2_endpoint": "http://localhost:5080",
    "o2_org": "default",
    "stream_name": "test_traces",
    # LiteLLM
    "lite_llm_base_url": "https://api.openai.com/v1",
    "lite_llm_api_key": "sk-test-key-placeholder",
    "lite_llm_model": "gpt-4o-mini",
    "wait_timeout_sec": 30,
    "poll_interval_ms": 500,
}


# ---------------------------------------------------------------------------
# OTLP helpers
# ---------------------------------------------------------------------------

def _nanos(now: float) -> str:
    """Convert epoch seconds (float) to nanosecond string."""
    return str(int(now * 1_000_000_000))


def _hex_trace_id() -> str:
    """Return a 32-char hex trace-id (16 bytes)."""
    return uuid.uuid4().hex[:32]


def _hex_span_id() -> str:
    """Return a 16-char hex span-id (8 bytes)."""
    return uuid.uuid4().hex[:16]


def _attr_str(key: str, value: str) -> Dict[str, Any]:
    return {"key": key, "value": {"stringValue": value}}


def _attr_int(key: str, value: int) -> Dict[str, Any]:
    return {"key": key, "value": {"intValue": value}}


def _attr_float(key: str, value: float) -> Dict[str, Any]:
    return {"key": key, "value": {"doubleValue": value}}


def _attr_json(key: str, value: Any) -> Dict[str, Any]:
    return {"key": key, "value": {"stringValue": json.dumps(value)}}


def _build_payload(spans: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "resourceSpans": [{
            "resource": {"attributes": [_attr_str("service.name", "test-agent")]},
            "scopeSpans": [{"scope": {"name": "test-agent", "version": "0.1.0"}, "spans": spans}],
        }]
    }


def send_traces(payload: Dict[str, Any]) -> requests.Response:
    """Send an OTLP trace payload to OpenObserve."""
    url = f"{CONFIG['o2_endpoint']}/api/{CONFIG['o2_org']}/{CONFIG['stream_name']}/traces"
    return requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=10)


def wait_for_traces() -> Dict[str, Any]:
    """Poll the trace list API until traces appear or timeout."""
    url = f"{CONFIG['o2_endpoint']}/api/{CONFIG['o2_org']}/{CONFIG['stream_name']}/traces/latest"
    deadline = time.monotonic() + CONFIG["wait_timeout_sec"]
    while time.monotonic() < deadline:
        try:
            resp = requests.get(url, params={"size": 1}, headers={"Content-Type": "application/json"}, timeout=5)
            if resp.status_code == 200:
                hits = resp.json().get("data", {}).get("hits", [])
                if hits:
                    return resp.json()
        except (requests.ConnectionError, ValueError):
            pass
        time.sleep(CONFIG["poll_interval_ms"] / 1000.0)
    return {}


# ---------------------------------------------------------------------------
# LiteLLM call
# ---------------------------------------------------------------------------

def _call_litellm(
    messages: List[Dict[str, str]],
    model: str = CONFIG["lite_llm_model"],
) -> Dict[str, Any]:
    """Call LiteLLM and return real telemetry data.

    Returns the actual usage tokens, model name, cost estimate, and messages
    from the LLM response.  No OTel spans are emitted here — those are built
    manually in the scenario generators below, which is how you instrument
    your own application.
    """
    import litellm

    start = time.time()
    response = litellm.completion(
        model=model,
        messages=messages,
        base_url=CONFIG["lite_llm_base_url"],
        api_key=CONFIG["lite_llm_api_key"],
        timeout=30,
        max_tokens=100,
    )

    usage = response.usage
    latency = time.time() - start

    # Estimate cost from OpenAI pricing (gpt-4o-mini: $0.15/M input, $0.60/M output)
    total_cost = (usage.prompt_tokens / 1_000_000) * 0.15 + (usage.completion_tokens / 1_000_000) * 0.60

    msg = response.choices[0].message
    return {
        "model": response.model,
        "prompt_tokens": usage.prompt_tokens,
        "completion_tokens": usage.completion_tokens,
        "total_tokens": usage.total_tokens,
        "cost": total_cost,
        "input_messages": messages,
        "output_content": msg.content if msg else "",
        "output_role": msg.role if msg else "assistant",
        "latency": latency,
    }


# ---------------------------------------------------------------------------
# Scenario generators
# ---------------------------------------------------------------------------

def _make_chat_span(
    trace_id: str,
    span_id: str,
    parent_span_id: str,
    user_id: str,
    session_id: str,
    data: Dict[str, Any],
    name: str,
) -> Dict[str, Any]:
    """Build a single LLM span with real LiteLLM telemetry."""
    now = time.time()
    return {
        "traceId": trace_id,
        "spanId": span_id,
        "parentSpanId": parent_span_id,
        "name": name,
        "startTimeUnixNano": _nanos(now),
        "endTimeUnixNano": _nanos(now + data["latency"]),
        "status": {"code": 0},
        "attributes": [
            _attr_str("user.id", user_id),
            _attr_str("session.id", session_id),
            _attr_str("gen_ai.system", "openai"),
            _attr_str("gen_ai.operation.name", "chat"),
            _attr_str("gen_ai.request.model", data["model"]),
            _attr_str("gen_ai.response.model", data["model"]),
            _attr_str("gen_ai.provider.name", "openai"),
            _attr_int("gen_ai.usage.input_tokens", data["prompt_tokens"]),
            _attr_int("gen_ai.usage.output_tokens", data["completion_tokens"]),
            _attr_int("gen_ai.usage.total_tokens", data["total_tokens"]),
            _attr_float("gen_ai.usage.cost", data["cost"]),
            _attr_json("gen_ai.input.messages", data["input_messages"]),
            _attr_json("gen_ai.output.messages", [{"role": data["output_role"], "content": data["output_content"]}] ),
        ],
    }


def _gen_single_query(user_id: str, session_id: str) -> Dict[str, Any]:
    """1 trace, 1 span, 1 user, 1 session."""
    trace_id, span_id = _hex_trace_id(), _hex_span_id()
    data = _call_litellm([{"role": "user", "content": "Say hello in one sentence."}])
    return _build_payload([_make_chat_span(trace_id, span_id, "", user_id, session_id, data, data["model"])])


def _gen_multi_call(user_id: str, session_id: str) -> Dict[str, Any]:
    """1 trace, 3 spans (parent + LLM child + tool child)."""
    trace_id = _hex_trace_id()
    parent_id = _hex_span_id()
    now = time.time()

    # Parent span (agent execution, no LLM)
    parent = {
        "traceId": trace_id, "spanId": parent_id, "parentSpanId": "",
        "name": "agent_execution",
        "startTimeUnixNano": _nanos(now), "endTimeUnixNano": _nanos(now + 3.0),
        "status": {"code": 0},
        "attributes": [
            _attr_str("user.id", user_id), _attr_str("session.id", session_id),
            _attr_str("gen_ai.operation.name", "span"),
        ],
    }

    # Child 1: LLM call
    trace_id1, span_id1 = _hex_trace_id(), _hex_span_id()  # reuse trace_id for same trace
    data1 = _call_litellm([{"role": "user", "content": "What is 2+2? Give me a detailed answer."}])
    child1 = {
        "traceId": trace_id, "spanId": span_id1, "parentSpanId": parent_id,
        "name": data1["model"],
        "startTimeUnixNano": _nanos(now + 0.1), "endTimeUnixNano": _nanos(now + 0.8),
        "status": {"code": 0},
        "attributes": [
            _attr_str("user.id", user_id), _attr_str("session.id", session_id),
            _attr_str("gen_ai.system", "openai"), _attr_str("gen_ai.operation.name", "chat"),
            _attr_str("gen_ai.request.model", data1["model"]),
            _attr_str("gen_ai.response.model", data1["model"]),
            _attr_str("gen_ai.provider.name", "openai"),
            _attr_int("gen_ai.usage.input_tokens", data1["prompt_tokens"]),
            _attr_int("gen_ai.usage.output_tokens", data1["completion_tokens"]),
            _attr_int("gen_ai.usage.total_tokens", data1["total_tokens"]),
            _attr_float("gen_ai.usage.cost", data1["cost"]),
            _attr_json("gen_ai.input.messages", data1["input_messages"]),
            _attr_json("gen_ai.output.messages", [{"role": data1["output_role"], "content": data1["output_content"]}] ),
        ],
    }

    # Child 2: tool call
    data2 = _call_litellm([{"role": "user", "content": "Search for information about OpenObserve."}])
    child2 = {
        "traceId": trace_id, "spanId": _hex_span_id(), "parentSpanId": parent_id,
        "name": "search_tool",
        "startTimeUnixNano": _nanos(now + 1.5), "endTimeUnixNano": _nanos(now + 2.5),
        "status": {"code": 0},
        "attributes": [
            _attr_str("user.id", user_id), _attr_str("session.id", session_id),
            _attr_str("gen_ai.operation.name", "execute_tool"),
            _attr_str("gen_ai.tool.name", "search_tool"),
            _attr_str("gen_ai.request.model", data2["model"]),
            _attr_str("gen_ai.response.model", data2["model"]),
            _attr_int("gen_ai.usage.input_tokens", data2["prompt_tokens"]),
            _attr_int("gen_ai.usage.output_tokens", data2["completion_tokens"]),
            _attr_int("gen_ai.usage.total_tokens", data2["total_tokens"]),
            _attr_float("gen_ai.usage.cost", data2["cost"]),
            _attr_json("gen_ai.tool.call.arguments", {"query": "OpenObserve"}),
            _attr_json("gen_ai.tool.call.result", {"results": ["OpenObserve is observability"]}),
        ],
    }

    return _build_payload([parent, child1, child2])


def _gen_multi_conversation(user_id: str) -> Dict[str, Any]:
    """1 user, 3 conversations (sessions)."""
    spans = []
    for i in range(3):
        tid, sid = _hex_trace_id(), _hex_span_id()
        data = _call_litellm([{"role": "user", "content": f"What is question {i+1}? Answer briefly."}])
        spans.append(_make_chat_span(tid, sid, "", user_id, f"conv-{user_id}-{i}", data, data["model"]))
    return _build_payload(spans)


def _gen_multi_user() -> Dict[str, Any]:
    """3 users, 1 session each."""
    spans = []
    for uid in ["user-a", "user-b", "user-c"]:
        tid, sid = _hex_trace_id(), _hex_span_id()
        data = _call_litellm([{"role": "user", "content": f"Hello from {uid}!"}])
        spans.append(_make_chat_span(tid, sid, "", uid, f"conv-{uid}", data, data["model"]))
    return _build_payload(spans)


# ---------------------------------------------------------------------------
# API query helpers
# ---------------------------------------------------------------------------

def get_sessions() -> Dict[str, Any]:
    url = f"{CONFIG['o2_endpoint']}/api/{CONFIG['o2_org']}/{CONFIG['stream_name']}/traces/session"
    return requests.get(url, timeout=10).json()


def get_users() -> Dict[str, Any]:
    url = f"{CONFIG['o2_endpoint']}/api/{CONFIG['o2_org']}/{CONFIG['stream_name']}/traces/user"
    return requests.get(url, timeout=10).json()


def get_trace_list() -> Dict[str, Any]:
    url = f"{CONFIG['o2_endpoint']}/api/{CONFIG['o2_org']}/{CONFIG['stream_name']}/traces/latest"
    return requests.get(url, params={"size": 100}, timeout=10).json()


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------

def _assert_200(resp: requests.Response):
    assert resp.status_code == 200, f"Ingestion failed {resp.status_code}: {resp.text}"


def _assert_user_in_users(users: Dict[str, Any], uid: str):
    ids = [u["user_id"] for u in users.get("data", {}).get("hits", [])]
    assert uid in ids, f"User {uid!r} not found in {ids}"


def _assert_session_in_sessions(sessions: Dict[str, Any], sid: str, uid: str, expected_traces: int):
    for s in sessions.get("data", {}).get("hits", []):
        if s.get("session_id") == sid:
            assert uid in s.get("user_ids", []), f"User {uid!r} not in session {sid}"
            assert s.get("trace_count") == expected_traces, f"Expected {expected_traces} traces, got {s.get('trace_count')}"
            assert "gen_ai_usage_cost" in s
            assert "gen_ai_usage_total_tokens" in s
            return
    pytest.fail(f"Session {sid!r} not found")


def _assert_user_has_tokens(users: Dict[str, Any], uid: str, min_tokens: int):
    for u in users.get("data", {}).get("hits", []):
        if u["user_id"] == uid:
            assert u["total_events"] > 0, f"User {uid!r} has no traces"
            assert u["gen_ai_usage_total_tokens"] >= min_tokens, f"User {uid!r} tokens {u.get('gen_ai_usage_total_tokens')} < {min_tokens}"
            return
    pytest.fail(f"User {uid!r} not found")


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

class TestSingleQuery:
    """1 trace, 1 session, 1 user — validates user/session tracking."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.uid, self.sid = "user-001", "conv-001"
        resp = send_traces(_gen_single_query(self.uid, self.sid))
        _assert_200(resp)

    def test_traces_appear(self):
        assert wait_for_traces()

    def test_session_ok(self):
        _assert_session_in_sessions(get_sessions(), self.sid, self.uid, expected_traces=1)

    def test_user_ok(self):
        _assert_user_has_tokens(get_users(), self.uid, min_tokens=10)


class TestStreamingMultiCall:
    """1 trace, 3 spans, 1 session, 1 user — validates parent-child + aggregation."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.uid, self.sid = "user-002", "conv-002"
        resp = send_traces(_gen_multi_call(self.uid, self.sid))
        _assert_200(resp)

    def test_traces_appear(self):
        assert wait_for_traces()

    def test_session_ok(self):
        _assert_session_in_sessions(get_sessions(), self.sid, self.uid, expected_traces=1)

    def test_user_ok(self):
        # 2 LLM calls => real tokens
        _assert_user_has_tokens(get_users(), self.uid, min_tokens=20)


class TestMultiConversation:
    """1 user, 3 sessions — validates session separation + user totals."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.uid = "user-003"
        resp = send_traces(_gen_multi_conversation(self.uid))
        _assert_200(resp)

    def test_traces_appear(self):
        assert wait_for_traces()

    def test_session_count(self):
        hits = [s for s in get_sessions().get("data", {}).get("hits", []) if self.uid in s.get("user_ids", [])]
        assert len(hits) == 3, f"Expected 3 sessions, got {len(hits)}"

    def test_user_ok(self):
        _assert_user_has_tokens(get_users(), self.uid, min_tokens=30)


class TestMultiUser:
    """3 users, 3 sessions, 3 traces — validates user isolation."""

    @pytest.fixture(autouse=True)
    def setup(self):
        resp = send_traces(_gen_multi_user())
        _assert_200(resp)

    def test_traces_appear(self):
        assert wait_for_traces()

    def test_user_count(self):
        ids = [u["user_id"] for u in get_users().get("data", {}).get("hits", [])]
        assert set(ids) == {"user-a", "user-b", "user-c"}

    def test_isolation(self):
        for uid in ["user-a", "user-b", "user-c"]:
            _assert_user_in_users(get_users(), uid)

    def test_one_trace_each(self):
        for u in get_users().get("data", {}).get("hits", []):
            assert u["total_events"] == 1


class TestTraceListFields:
    """Validate that the trace list response has all frontend-required fields."""

    @pytest.fixture(autouse=True)
    def setup(self):
        resp = send_traces(_gen_single_query("user-test", "conv-test"))
        _assert_200(resp)

    def test_fields(self):
        wait_for_traces()
        hit = get_trace_list()["data"]["hits"][0]
        for field in ("trace_id", "start_time", "end_time", "gen_ai_usage_cost", "models",
                       "gen_ai_usage_input_tokens", "gen_ai_usage_output_tokens",
                       "gen_ai_usage_total_tokens", "gen_ai_input_messages"):
            assert field in hit, f"Missing field: {field}"


class TestEndToEnd:
    """Full pipeline: all scenarios combined into one user."""

    @pytest.fixture(autouse=True)
    def setup(self):
        uid = "e2e-user"
        for gen in [
            lambda: _gen_single_query(uid, "c1"),
            lambda: _gen_multi_call(uid, "c2"),
            lambda: _gen_multi_conversation(uid),
        ]:
            _assert_200(send_traces(gen()))

    def test_sessions_visible(self):
        hits = [s for s in get_sessions().get("data", {}).get("hits", []) if "e2e-user" in s.get("user_ids", [])]
        assert len(hits) == 4, f"Expected 4 sessions, got {len(hits)}"

    def test_user_totals(self):
        _assert_user_has_tokens(get_users(), "e2e-user", min_tokens=50)

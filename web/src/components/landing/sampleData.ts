// Copyright 2026 OpenObserve Inc.

// Example stream content for the landing-page product fragments. These are
// illustrative rows in the product's real visual language (the same columns,
// chips and syntax colours the log search view renders) - not customer data
// and not a metrics claim.
export type SampleRow = {
  time: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  highlight?: string;
  duration: string;
  traceId?: string;
  status?: number;
};

export const SAMPLE_ROWS: SampleRow[] = [
  {
    time: "14:32:08.412",
    level: "info",
    message: "GET /api/search",
    highlight: "/api/search",
    duration: "18ms",
    traceId: "4f2ad0c1",
    status: 200,
  },
  {
    time: "14:32:08.398",
    level: "debug",
    message: "cache miss key=org:default:streams",
    duration: "0ms",
    status: 200,
  },
  {
    time: "14:32:07.876",
    level: "info",
    message: "POST /api/default/app_logs/_json",
    highlight: "_json",
    duration: "21ms",
    traceId: "b10f9e42",
    status: 200,
  },
  {
    time: "14:32:07.145",
    level: "warn",
    message: "slow query took 3.2s stream=app_logs",
    highlight: "3.2s",
    duration: "3.2s",
    traceId: "9ac44d01",
    status: 200,
  },
  {
    time: "14:32:06.902",
    level: "error",
    message: "upstream timeout service=billing",
    highlight: "timeout",
    duration: "5.0s",
    traceId: "04d77ba8",
    status: 500,
  },
  {
    time: "14:32:06.640",
    level: "info",
    message: "PUT /api/default/alerts/5xx-spike",
    duration: "12ms",
    traceId: "c58e1f3b",
    status: 200,
  },
  {
    time: "14:32:05.977",
    level: "info",
    message: "GET /healthz",
    duration: "1ms",
    traceId: "e90231aa",
    status: 200,
  },
  {
    time: "14:32:05.410",
    level: "debug",
    message: "wal fsync segment=812 bytes=4194304",
    duration: "4ms",
  },
  {
    time: "14:32:04.886",
    level: "error",
    message: "connection reset host=queue-1 port=5672",
    highlight: "reset",
    duration: "2.1s",
    traceId: "77c2b609",
    status: 503,
  },
  {
    time: "14:32:04.231",
    level: "info",
    message: "compaction stream=app_logs rows=14823",
    duration: "110ms",
  },
  {
    time: "14:32:03.774",
    level: "warn",
    message: "retry 1/3 send webhook target=ops-oncall",
    duration: "340ms",
    traceId: "31b0ff7d",
    status: 200,
  },
  {
    time: "14:32:03.218",
    level: "info",
    message: "GET /web/",
    duration: "2ms",
    traceId: "a012de55",
    status: 200,
  },
  {
    time: "14:32:02.995",
    level: "info",
    message: "query mode=sql org=default scan=2.4gb",
    highlight: "sql",
    duration: "240ms",
    traceId: "5f61c990",
    status: 200,
  },
  {
    time: "14:32:02.401",
    level: "debug",
    message: "parquet flush stream=metrics_v2 files=3",
    duration: "38ms",
  },
];

export const SAMPLE_JSON_FIELDS: Array<[string, string, "key" | "string" | "number" | "bool"]> = [
  ["level", "error", "key"],
  ["service", "billing-api", "string"],
  ["trace_id", "04d77ba8f2c14a6d9e3b715c8a204ef6", "string"],
  ["duration_us", "5001422", "number"],
  ["status", "500", "number"],
  ["msg", "upstream timeout service=billing", "string"],
  ["stream", "app_logs", "string"],
  ["node", "retrace-0", "string"],
];

export const SAMPLE_METRICS = {
  kpis: [
    { label: "Events, last hour", value: "12,483" },
    { label: "p95 response", value: "21ms" },
    { label: "Ingested today", value: "0.42 GB" },
  ],
  series: [
    38, 41, 44, 40, 52, 58, 55, 61, 74, 69, 78, 82, 79, 88, 84, 91, 87, 95, 92, 97, 94, 99, 96, 100,
  ],
};

export type SampleSpan = {
  name: string;
  offset: number;
  width: number;
  ms: string;
  depth: number;
  selected?: boolean;
};

export const SAMPLE_TRACES: SampleSpan[] = [
  { name: "GET /api/search", offset: 0, width: 100, ms: "142ms", depth: 0, selected: true },
  { name: "parse query", offset: 8, width: 18, ms: "26ms", depth: 1 },
  { name: "scan app_logs", offset: 24, width: 58, ms: "83ms", depth: 1 },
  { name: "merge results", offset: 84, width: 14, ms: "20ms", depth: 1 },
  { name: "serialize json", offset: 92, width: 8, ms: "11ms", depth: 1 },
];

export const LOG_ROWS = SAMPLE_ROWS;

export const CURL = {
  url: "http://localhost:5080/api/default/app_logs/_json",
  body: '{"level":"info", "service":"billing", "msg":"charge accepted"}',
};

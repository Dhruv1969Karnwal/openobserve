import type { I18nText } from "@/types/i18n";

export enum PageType {
  LOGS = "logs",
  STREAM_EXPLORER = "stream_explorer",
  TRACE_EXPLORER = "trace_explorer",
  VISUALIZE = "visualize",
}

export interface ActivationState {
  isSearchTab: boolean;
  isStreamExplorer: boolean;
  isTraceExplorer: boolean;
  isStreamChanged: boolean;
}

export interface TimestampRange {
  from: number;
  to: number;
}

export interface SQLColumn {
  expr: any;
  as?: string;
}

export interface SQLFrom {
  table: string;
  as?: string;
}

export interface SQLOrderBy {
  expr: any;
  type: "ASC" | "DESC";
}

export interface SQLLimit {
  seperator?: string;
  value: number[];
}

export interface SQLGroupBy {
  type: string;
  value: any;
}
[];

export interface SQLWhere {
  type: string;
  left: any;
  operator: string;
  right: any;
}

export interface ParsedSQLResult {
  columns: SQLColumn[];
  from: SQLFrom[];
  orderby: SQLOrderBy[] | null;
  limit: SQLLimit | null;
  groupby: SQLGroupBy | null;
  where: SQLWhere | null;
}

export type TimePeriodUnit = "s" | "m" | "h" | "d" | "w" | "M";

export interface SearchAroundParams {
  key: string;
  size: number;
  body: any;
}

export interface StreamField {
  name: string;
  streams: string[];
}

export interface SearchAroundResponse {
  from: number;
  scan_size: number;
  took: number;
  hits: any[];
}

export interface SearchAroundError {
  response?: {
    data: {
      error: string;
      error_detail?: string;
      code?: number;
      message?: I18nText;
      trace_id?: string;
    };
    status?: number;
  };
  request?: {
    status: number;
  };
  message: I18nText;
  trace_id?: string;
}

export interface TraceContext {
  traceparent: string;
  traceId: string;
}

// The complete set of panel keys the logs route renders (grid v-shows and panel
// v-ifs match exactly these); anything else leaves every branch unmatched.
export const LOGS_VISUALIZE_TOGGLES = ["logs", "visualize", "build", "drilldown", "patterns"];

export type LogsVisualizeToggle = (typeof LOGS_VISUALIZE_TOGGLES)[number];

export const isLogsVisualizeToggle = (value: unknown): value is LogsVisualizeToggle =>
  typeof value === "string" && LOGS_VISUALIZE_TOGGLES.some((toggle) => toggle === value);

/**
 * Sanitizes a restored logs panel toggle (URL `?logs_visualize_toggle=` or a
 * saved-view snapshot): `patterns` is entitlement-gated so un-entitled builds
 * fall back to `logs`, and values outside the known set coerce to `logs` as
 * well (mirrors resolveTraceSearchMode for the traces `?tab=` deep link).
 * `patternsAllowed` comes from checkFeatureAccess("logPatterns", …).
 */
export const resolveLogsVisualizeToggle = (
  value: unknown,
  patternsAllowed: boolean,
): LogsVisualizeToggle =>
  !isLogsVisualizeToggle(value) || (value === "patterns" && !patternsAllowed)
    ? "logs"
    : (value as LogsVisualizeToggle);

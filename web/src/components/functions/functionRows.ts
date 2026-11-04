// Copyright 2026 OpenObserve Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

/**
 * The one reading of a function payload, shared by the list's cells and the
 * detail pane so the two can never disagree about the same record.
 */

export interface FunctionParamRow {
  name: string;
  value: string | null;
  /** Only a producer that declares a type gets one; absent means the UI makes no type claim. */
  type?: string;
  /** Only a producer that declares it gets one; absent means the UI makes no required claim. */
  required?: boolean;
}

export interface FunctionRowView {
  name: string;
  /** Fence language for the body: the payload's own `language`, else derived from `transType`. */
  codeLang: string;
  isJs: boolean;
  body: string;
  /** Line count of `body` as written — a one-line source is a complete source. */
  sourceLines: number;
  params: FunctionParamRow[];
  streams: string[];
  /** The server's own function count, or null when the payload carries none. */
  functionCount: number | null;
  /** `z_meta._timestamp` in microseconds — the payload's only write time. */
  updatedUs: number | null;
}

/** One stream and the functions applied to it — the list's inverse index, summed from its rows. */
export interface StreamUsage {
  stream: string;
  functions: string[];
}

const asText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const paramFromEntry = (entry: unknown): FunctionParamRow | null => {
  if (typeof entry === "string") {
    const name = entry.trim();
    return name ? { name, value: null } : null;
  }
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  const name = asText(record.name ?? record.key ?? record.arg)?.trim() ?? "";
  if (!name) return null;
  const value = asText(record.value ?? record.default);
  const type = asText(record.type)?.trim();
  const param: FunctionParamRow = { name, value: value?.trim() ? value.trim() : null };
  if (type) param.type = type;
  if (typeof record.required === "boolean") param.required = record.required;
  return param;
};

/**
 * `params` is a `{name,value}[]` on one producer and a bare argument list — a
 * JSON string or a plain `row` — on another, so both shapes arrive here.
 */
export const parseParams = (params: unknown): FunctionParamRow[] => {
  let source: unknown = params;
  if (typeof source === "string") {
    const text = source.trim();
    if (!text) return [];
    try {
      source = JSON.parse(text);
    } catch {
      return text
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((name) => ({ name, value: null }));
    }
  }
  const entries = Array.isArray(source) ? source : [source];
  return entries.map(paramFromEntry).filter(Boolean) as FunctionParamRow[];
};

/** `associated_with_streams` names streams directly; `streams` carries them as ordered nodes. */
export const parseStreams = (data: any): string[] => {
  const direct = Array.isArray(data?.associated_with_streams)
    ? data.associated_with_streams
    : Array.isArray(data?.streams)
      ? data.streams
      : [];
  return direct
    .map((entry: unknown) =>
      typeof entry === "string" ? entry : (asText((entry as any)?.stream)?.trim() ?? ""),
    )
    .filter((name: string) => name.length > 0);
};

/** Sums the rows already on screen into the stream → functions index the list closes with. */
export const streamUsage = (rows: any[]): StreamUsage[] => {
  const byStream = new Map<string, string[]>();
  (rows ?? []).forEach((row: any) => {
    const name = asText(row?.name) ?? "";
    const streams: string[] = row?.view?.streams ?? [];
    streams.forEach((stream) => {
      const applied = byStream.get(stream) ?? [];
      applied.push(name);
      byStream.set(stream, applied);
    });
  });
  return [...byStream.entries()]
    .map(([stream, functions]) => ({ stream, functions }))
    .sort((a, b) => b.functions.length - a.functions.length || a.stream.localeCompare(b.stream));
};

const countSourceLines = (body: string | null): number =>
  body ? body.replace(/\n$/, "").split("\n").length : 0;

export function functionRowView(data: any): FunctionRowView {
  const transType = String(data?.transType ?? data?.trans_type ?? "0");
  const isJs = transType === "1";
  const declared = asText(data?.language)?.trim().toLowerCase() ?? "";
  const count = Number(data?.num_of_func ?? data?.numOfFunc);
  const stamped = Number(data?.z_meta?._timestamp ?? data?.zMeta?._timestamp);
  const body = asText(data?.function) ?? "";
  return {
    name: asText(data?.name) ?? "",
    codeLang: declared || (isJs ? "javascript" : "vrl"),
    isJs,
    body,
    sourceLines: countSourceLines(body),
    params: parseParams(data?.params),
    streams: parseStreams(data),
    functionCount: Number.isFinite(count) ? count : null,
    updatedUs: Number.isFinite(stamped) && stamped > 0 ? stamped : null,
  };
}

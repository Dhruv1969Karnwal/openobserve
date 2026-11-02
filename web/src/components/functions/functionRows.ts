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
}

export interface FunctionRowView {
  name: string;
  /** Fence language for the body: the payload's own `language`, else derived from `transType`. */
  codeLang: string;
  isJs: boolean;
  body: string;
  params: FunctionParamRow[];
  streams: string[];
  /** The server's own function count, or null when the payload carries none. */
  functionCount: number | null;
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
  return { name, value: value?.trim() ? value.trim() : null };
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

export function functionRowView(data: any): FunctionRowView {
  const transType = String(data?.transType ?? data?.trans_type ?? "0");
  const isJs = transType === "1";
  const declared = asText(data?.language)?.trim().toLowerCase() ?? "";
  const count = Number(data?.num_of_func ?? data?.numOfFunc);
  return {
    name: asText(data?.name) ?? "",
    codeLang: declared || (isJs ? "javascript" : "vrl"),
    isJs,
    body: asText(data?.function) ?? "",
    params: parseParams(data?.params),
    streams: parseStreams(data),
    functionCount: Number.isFinite(count) ? count : null,
  };
}

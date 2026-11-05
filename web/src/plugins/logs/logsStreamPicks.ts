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

import { compareStreamsByLatest } from "@/utils/logs/estimateScanMb";

/** One stream offered as a one-click pick in the logs no-stream state. */
export interface LogsStreamPick {
  name: string;
  events?: number | null;
  lastUs?: number | null;
}

/** The canvas lists the org's streams in full: it is the answer, not a teaser. */
export const STREAM_PICK_LIMIT = Number.MAX_SAFE_INTEGER;

const toPick = (entry: any): LogsStreamPick => ({
  name: String(entry?.name ?? entry?.value ?? ""),
  events: entry?.stats?.doc_num ?? null,
  lastUs: entry?.stats?.doc_time_max ?? null,
});

const isLive = (pick: LogsStreamPick): boolean => pick.name !== "";

/**
 * The streams the page already holds, newest data first. Prefers the detailed
 * `/streams` list (it carries the stats the pick rows show); falls back to the
 * plain selector list, whose rows then print a dash instead of a made-up number.
 */
export const buildStreamPicks = (
  streamResults: any,
  streamLists: any[] = [],
  limit = STREAM_PICK_LIMIT,
): LogsStreamPick[] => {
  const detailed: any[] = Array.isArray(streamResults?.list) ? streamResults.list : [];
  const source = detailed.length
    ? [...detailed].sort(compareStreamsByLatest).map(toPick)
    : (streamLists ?? []).map(toPick);
  return source.filter(isLive).slice(0, limit);
};

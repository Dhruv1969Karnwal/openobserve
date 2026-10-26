//  Copyright 2026 OpenObserve Inc.

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { resolveLogsVisualizeToggle, type LogsVisualizeToggle } from "@/ts/interfaces/logs";
import type { PlainObject } from "./transientSearchKeys";

/**
 * `meta` keys whose NON-DEFAULT value opens or renders a PAID surface, and the
 * free-edition value they must land on instead. This is the enumerated answer to
 * "what can a snapshot say that costs money to hear" — grepping every watcher /
 * dialog-opener that reads `searchObj.meta.*` across the logs plugin:
 *
 *  - `showSearchScheduler` — the `immediate` watcher in logs/SearchBar.vue turns
 *    a truthy value into `searchSchedulerJob = true`, which opens the Create
 *    Scheduled Search dialog (the `scheduledSearch` feature). It is not in
 *    `TRANSIENT_SEARCH_KEYS`, so before this file existed it survived the
 *    saved-view merge and popped the paid dialog on an OSS build under the
 *    "hide" policy (F-98). Nothing in the shipped app ever writes `true` — the
 *    only way in was the payload.
 *  - `logsVisualizeToggle` — the panel toggle. It is handled by
 *    `resolveLogsVisualizeToggle` below rather than by this table, because a
 *    saved view legitimately persists four of its five values: only `patterns`
 *    is gated, so this key is COERCED, not reset. It is listed here so the set of
 *    paid-bearing meta keys has exactly one source of truth.
 *
 * Deliberately NOT in this set, with the reason:
 *  - `showTransformEditor`, `showHistogram`, `showDetailTab`, `showFields`,
 *    `showQuery`, `sqlMode`, `quickMode`, `nlpMode`, `liveMode`, `pageType`,
 *    `regions` / `clusters`, `resultGrid.*`, `scrollInfo` — free surfaces; a
 *    snapshot is entitled to restore them.
 *  - `showPatterns` — declared in `utils/logs/constants.ts` and read nowhere
 *    (the Patterns panel keys off `logsVisualizeToggle`), so coercing it would be
 *    documenting a surface that does not exist.
 *  - `jobId` / `jobRecords` — scheduled-search EXECUTION state, not an affordance:
 *    a non-empty `jobId` re-points the results pipeline at the job endpoint (which
 *    403s on OSS) and is written only by the route-gated SearchSchedulersList.
 *    Stripping it would change query semantics at this boundary; the paid door it
 *    sits behind is the one F-103 gated. Revisit here if a visible affordance ever
 *    keys off it.
 */
export const PAID_SNAPSHOT_META_KEYS = ["showSearchScheduler"] as const;

export type PaidSnapshotMetaKey = (typeof PAID_SNAPSHOT_META_KEYS)[number];

/** What each key looks like when the paid surface is closed. */
export const PAID_SNAPSHOT_META_DEFAULTS: Record<PaidSnapshotMetaKey, unknown> = {
  showSearchScheduler: false,
};

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export interface SnapshotPaidAccess {
  /** `checkFeatureAccess("logPatterns", …).allowed` at the call site. */
  patternsAllowed: boolean;
}

/**
 * Sanitizes the paid state of an untrusted search snapshot (an org-stored,
 * client-writable saved view) BEFORE it is merged into the live `searchObj`.
 * Mutates and returns the same object so the call site stays one line.
 *
 * Three guarantees, in this order:
 *  1. `meta` is a plain object. A payload carrying a scalar or array `meta` used
 *     to reach `mergeDeep`, which overwrites the live object's primitives with it,
 *     and the only thing that saved the app was an unrelated strict-mode write
 *     throwing first. The shape is now checked explicitly (F-98 / EDGE-03) —
 *     nothing legible can be stored on a non-object, so there is nothing to keep.
 *  2. The panel toggle is resolved through the same closed-set, entitlement-aware
 *     sanitizer the URL restore uses (F-43 / F-66), so `patterns` cannot be
 *     restored by payload on a build that does not sell it.
 *  3. Every key in `PAID_SNAPSHOT_META_KEYS` that could open a paid surface is
 *     coerced to its closed value. Set-driven, not per-key whack-a-mole: a new
 *     paid `meta` affordance only has to join the table above to be covered here.
 *
 * Everything else in `meta` passes through untouched — saved views legitimately
 * persist their query, fields, layout and panel.
 */
export function sanitizeSearchSnapshotMeta<T extends PlainObject>(
  snapshot: T,
  { patternsAllowed }: SnapshotPaidAccess,
): T {
  if (!isPlainObject(snapshot)) return snapshot;

  // `PlainObject` is an index signature, and a generic `T extends PlainObject`
  // only accepts the write through that record view.
  const record = snapshot as PlainObject;
  const meta = record.meta;
  if (!isPlainObject(meta)) {
    record.meta = {};
    return snapshot;
  }

  if (Object.hasOwn(meta, "logsVisualizeToggle")) {
    meta.logsVisualizeToggle = resolveLogsVisualizeToggle(
      meta.logsVisualizeToggle,
      patternsAllowed,
    ) as LogsVisualizeToggle;
  }

  for (const key of PAID_SNAPSHOT_META_KEYS) {
    if (Object.hasOwn(meta, key)) meta[key] = PAID_SNAPSHOT_META_DEFAULTS[key];
  }

  return snapshot;
}

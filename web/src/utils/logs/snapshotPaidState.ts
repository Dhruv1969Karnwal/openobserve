// Copyright 2026 OpenObserve Inc.

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

import { resolveLogsVisualizeToggle } from "@/ts/interfaces/logs";
import type { PlainObject } from "./transientSearchKeys";

/** What the call site knows about this build's entitlements, resolved once. */
export interface SnapshotPaidAccess {
  /** `checkFeatureAccess("logPatterns", …).allowed` at the call site. */
  patternsAllowed: boolean;
  /**
   * Whether the Ask-AI bar is legitimately available here: the `aiAssistant`
   * entitlement AND the `ai_enabled` runtime toggle — the exact conjunct
   * QueryEditor applies to its own AI affordances.
   */
  aiAssistantAllowed: boolean;
}

/**
 * `meta` keys whose NON-DEFAULT value opens or renders a PAID surface, plus the
 * free-edition value such a key must land on instead.
 *
 * The enumeration is over the READERS of the logs `searchObj` — every
 * `immediate` watcher, `v-if` / prop binding and `v-model:open` dialog opener in
 * `plugins/logs/**`, `components/QueryEditor.vue` and `composables/useLogs/**` —
 * crossed with the registry keys in `utils/enterpriseFeatures.ts`. A field joins
 * this table only if a PAYLOAD value can make a gated surface appear; a field
 * whose surface is additionally gated on `store.state.zoConfig` or
 * `config.isEnterprise` is not snapshot-writable, so the payload cannot open it
 * (class CONFIG-GATED).
 *
 *  PAID — in this table:
 *   `logsVisualizeToggle`  "patterns" renders the Log Patterns panel
 *                          (logs/SearchResult.vue, `v-if` on the toggle). Handled
 *                          by `resolveLogsVisualizeToggle` below, NOT by the
 *                          reset loop: a saved view legitimately persists four of
 *                          its five values, so this key is COERCED. It is named
 *                          here so the paid set has one source of truth.
 *   `showSearchScheduler`  the `immediate` watcher in logs/SearchBar.vue turns a
 *                          truthy value into `searchSchedulerJob = true`, which
 *                          opens the Create Scheduled Search dialog. No entitled
 *                          exception: it is a one-shot DIALOG TRIGGER, not
 *                          persisted state, and nothing in the shipped app
 *                          restores it — the only way in was ever the payload.
 *   `nlpMode`              logs/SearchBar.vue binds it to the query editor as its
 *                          EXTERNAL control (`:nlp-mode`), and QueryEditor's
 *                          `isAIMode` returns that prop alone under external
 *                          control — with no entitlement conjunct, unlike the
 *                          internal-control branch — so the paid Ask-AI bar
 *                          (`v-if="isAIMode"`) renders. Entitled exception: an
 *                          org that actually has the assistant may legitimately
 *                          have saved the bar open, hence `restoreWhen`.
 *
 *  EXECUTION — no affordance renders off them, so stripping would only change
 *  query semantics at this boundary:
 *   `jobId` / `jobRecords`  re-point the request at `get_scheduled_search_result`
 *                          (useLogs/usePagination.ts) and cap pagination
 *                          (logs/SearchResult.vue) + informational toasts
 *                          (SearchBar watchers); the only non-empty writer is the
 *                          route-gated logs/SearchSchedulersList.vue. Revisit here
 *                          the moment a visible affordance keys off them.
 *   `clearCache`            a `skip_cache` request flag (logs/Index.vue), free.
 *
 *  CONFIG-GATED — the surface needs a server flag the payload cannot write:
 *   `regions` / `clusters`                   super-cluster selector needs
 *                                            `config.isEnterprise` and
 *                                            `zoConfig.super_cluster_enabled`
 *   `useUserDefinedSchemas` /
 *   `hasUserDefinedSchemas`                  the toggle needs
 *                                            `zoConfig.user_defined_schemas_enabled`
 *                                            (logs/IndexList.vue); the values only
 *                                            pick which free list is shown
 *   `showDetailTab`                          the row drawer is free
 *                                            (logs/SearchResult.vue) and its paid
 *                                            members gate themselves on
 *                                            `correlation` / `ai_enabled`
 *                                            (logs/DetailTable.vue);
 *                                            `TRANSIENT_SEARCH_KEYS` resets it too
 *
 *  TRANSIENT — `TRANSIENT_SEARCH_KEYS` (transientSearchKeys.ts) deletes or resets
 *  them before the merge, so a payload cannot carry them at all: `executed`,
 *  `pendingExecution`, `lastRunAttempt`, `executedPatterns` (an auto-run bookkeeping
 *  slot, NOT the paid Patterns panel), `executedPanel`, `autoRunBlocked`,
 *  `consentedScope`, `runPending`, `runOutcome`, `runCancelled`, `editorDirty`,
 *  `liveMode`, `freeTextScan`, `showDetailTab`, `resultGrid.navigation.*`.
 *
 *  FREE — a snapshot is entitled to restore these: `showTransformEditor`,
 *  `showHistogram`, `showFields`, `showQuery`, `sqlMode` (+ `sqlModeManualTrigger`,
 *  `sqlModeEditTransition`), `quickMode`, `pageType`, `scrollInfo`, `resultGrid.*`,
 *  `savedBuildConfig`, `buildModeQueryEditorDisabled`, `refreshInterval`,
 *  `refreshIntervalLabel`, `refreshHistogram`, `searchApplied`, `toggleSourceWrap`,
 *  `histogramDirtyFlag`, `logsVisualizeDirtyFlag`, `pendingUrlQueryRestore`,
 *  `isFtsDefaultColumn`, `queryEditorPlaceholderFlag`,
 *  `functionEditorPlaceholderFlag`, `selectedTraceStream`, `resetPlotChart`,
 *  `toggleFunction` (deprecated alias of `showTransformEditor`) and `lastRunAt`
 *  (the refresh button's "last ran" label, which is not even in the default shape).
 *
 *  DEAD — `showPatterns` is declared in `utils/logs/constants.ts` and read
 *  nowhere (the panel keys off `logsVisualizeToggle`); coercing it would document
 *  a surface that does not exist.
 *
 * The same merge also carries `searchObj`-level paths, so those were walked too:
 * `data.stream.functions` / `transformType` / `selectedTransform` open the free VRL
 * editor (the transform-type menu offers only `function`), `data.patterns.*` is
 * inert content behind the coerced toggle, `data.datetime.queryRangeRestriction*`
 * is re-derived from stream settings and `zoConfig.max_query_range` on every stream
 * load (useLogs/useStreamFields.ts), `communicationMethod` / `runQuery` are request
 * and page-count branches (logs/SearchResult.vue) with no affordance on them, and
 * `data.searchAround`, `data.visualizationData`, `data.resultGrid.*` and
 * `config.splitter*` are free query/layout state. A payload may also invent keys
 * under `meta`; undeclared keys are read by nothing, which is why completeness here
 * means completeness over READERS, not over the stored shape.
 */
export const PAID_SNAPSHOT_META_KEYS = ["showSearchScheduler", "nlpMode"] as const;

export type PaidSnapshotMetaKey = (typeof PAID_SNAPSHOT_META_KEYS)[number];

/**
 * `hidden` is the free-edition value the key is forced to. `restoreWhen` marks the
 * keys whose stored value IS legitimate for an org that has the surface — those
 * pass through when it answers true, so the boundary normalises entitlement and
 * nothing else.
 */
export interface PaidSnapshotMetaRule {
  hidden: unknown;
  restoreWhen?: (access: SnapshotPaidAccess) => boolean;
}

export const PAID_SNAPSHOT_META_RULES: Record<PaidSnapshotMetaKey, PaidSnapshotMetaRule> = {
  showSearchScheduler: { hidden: false },
  nlpMode: { hidden: false, restoreWhen: ({ aiAssistantAllowed }) => aiAssistantAllowed },
};

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Sanitizes the paid state of an untrusted search snapshot (an org-stored,
 * client-writable saved view) BEFORE it is merged into the live `searchObj`.
 * Mutates and returns the same object so the call site stays one line.
 *
 * Three guarantees, in this order:
 *  1. `meta` is a plain object. A payload carrying a scalar or array `meta` used
 *     to reach `mergeDeep`, which overwrites the live object's primitives with it,
 *     and the only thing that saved the app was an unrelated strict-mode write
 *     throwing first. The shape is now checked explicitly —
 *     nothing legible can be stored on a non-object, so there is nothing to keep.
 *  2. The panel toggle is resolved through the same closed-set, entitlement-aware
 *     sanitizer the URL restore uses, so `patterns` cannot be
 *     restored by payload on a build that does not sell it.
 *  3. Every key in `PAID_SNAPSHOT_META_KEYS` that could open a paid surface is
 *     written from its `PAID_SNAPSHOT_META_RULES` entry: forced to `hidden`, or left
 *     alone when `restoreWhen` says this org legitimately has the surface.
 *     Set-driven, not per-key whack-a-mole: a new paid `meta` affordance only has to
 *     join the table above to be covered here.
 *
 * Everything else in `meta` passes through untouched — saved views legitimately
 * persist their query, fields, layout and panel.
 */
export function sanitizeSearchSnapshotMeta<T extends PlainObject>(
  snapshot: T,
  access: SnapshotPaidAccess,
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
      access.patternsAllowed,
    );
  }

  for (const key of PAID_SNAPSHOT_META_KEYS) {
    const rule = PAID_SNAPSHOT_META_RULES[key];
    if (!Object.hasOwn(meta, key) || rule.restoreWhen?.(access)) continue;
    meta[key] = rule.hidden;
  }

  return snapshot;
}

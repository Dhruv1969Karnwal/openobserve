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
import { DEFAULT_LOGS_CONFIG } from "./constants";
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
  /**
   * `checkFeatureAccess("scheduledSearch", …).allowed` at the call site — the same
   * key the scheduled-result route answers with
   * (`composables/shared/router.ts`, `withFeatureGate("scheduledSearch", routeGuard)`),
   * which is also the gate on the only legitimate writer of `meta.jobId`.
   */
  scheduledSearchAllowed: boolean;
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
 *   `jobId`                a payload value re-points the NEXT search at
 *                          `search_jobs/{id}/result` (`useLogs/usePagination.ts`,
 *                          `decideSearch`), which the OSS backend answers with
 *                          `403 "Not Supported"` (Rust:
 *                          `src/api/search/src/search/search_job.rs`, the
 *                          `not(feature = "enterprise")` arm), and two `immediate`
 *                          watchers in logs/SearchBar.vue turn it into visible UI on
 *                          a free build: "Job Context have been removed" and
 *                          "Histogram is not available for scheduled search", the
 *                          latter also forcing the free histogram panel shut
 *                          (`meta.showHistogram = false`). Entitled exception, hence
 *                          `restoreWhen`: the org's own scheduled results.
 *   `jobRecords`           only load-bearing while `jobId` is EMPTY — it becomes
 *                          the free search's page size (`composables/useLogs.ts`,
 *                          `queryReq.query.size = parseInt(…)`). It is in the table
 *                          because of that coupling: resetting `jobId` alone would
 *                          promote a payload-carried `jobRecords` into the size of
 *                          the free request, so the two keys move together.
 *
 *  EXECUTION — no affordance renders off them and no entitled endpoint is
 *  reachable off them either, so stripping would only change query semantics at
 *  this boundary (`jobId` / `jobRecords` were here until the payload path above
 *  was traced; they are not execution-neutral):
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
 *  TRANSIENT — `TRANSIENT_SEARCH_KEYS` (transientSearchKeys.ts) strips or resets
 *  them around the merge — the strip-only entries are deleted from the payload
 *  before it, the reset entries are overwritten after it — so no payload value
 *  survives: `executed`,
 *  `pendingExecution`, `lastRunAttempt`, `executedPatterns` (an auto-run bookkeeping
 *  slot, NOT the paid Patterns panel), `executedPanel`, `autoRunBlocked`,
 *  `consentedScope`, `runPending`, `runOutcome`, `runCancelled`, `editorDirty`,
 *  `liveMode`, `freeTextScan`, `showDetailTab`, `resultGrid.navigation.*`.
 *  One honesty caveat: `meta.freeTextScan` is `mode: "replace"`, which is
 *  deliberately fed FROM the payload after the merge (payload value lands and
 *  wins), so it is inert by construction, not by stripping — no registry key
 *  names free-text scan and its visibility reads `zoConfig`, so no paid surface
 *  is reachable off it.
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
 *  `savedVisualizationConfig` is FREE too and is called out because it is the one
 *  key this table had to learn about the hard way: it is declared nowhere in the
 *  default shape, yet logs/Index.vue consumes it — the config+chart-type hand-off
 *  written on unmount (`:1115`) and read back in the visualize-toggle watcher
 *  (`:2585-2587`). The read side is free on every branch: the chart type must be in
 *  `validLogsChartTypes` (area/bar/h-bar/line/scatter/table) to be taken at all, and
 *  the merged object is `dashboardPanelData.data.config`, which no entitlement is
 *  read from (the visualize tab itself is inside `resolveLogsVisualizeToggle`'s
 *  always-allowed set — only `patterns` is checked there, and no registry key names
 *  saved visualizations).
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
 * `config.splitter*` are free query/layout state.
 *
 * WHAT THIS TABLE IS, stated honestly because an earlier revision of this comment
 * claimed something stronger and false: it is an ENUMERATION, produced by sweeping
 * the READERS — every `searchObj.meta.<key>` reference under `plugins/logs/**`,
 * `composables/useLogs/**`, `composables/useLogs.ts` and `components/QueryEditor.vue`
 * (49 distinct keys at this head — the count basis is DECLARED keys that have a
 * reader; total readers are 51, the delta being the three undeclared keys named
 * below; the sweep also has to exclude the unrelated
 * `dashboardPanelData.meta.*` object, whose `dateTime`/`streamFields` a naive
 * `.meta.` grep folds in). Keys are classified below; the table is not derived from
 * the stored shape and cannot be completed by reasoning about the stored shape. It
 * used to argue "an undeclared `meta` key is read by nothing", which the sweep
 * disproves: `meta.savedVisualizationConfig` is not in `DEFAULT_LOGS_CONFIG.meta` and
 * is still consumed. Three keys are read without being declared
 * (`savedVisualizationConfig`, `lastRunAt`, `runCancelled` — the last written only by
 * the auto-run plumbing, read at `plugins/logs/Index.vue`, and safe because it is
 * TRANSIENT with `mode: "reset"`, which overwrites whatever a payload carried) and
 * all three are classified above by
 * name, so a payload-inventable key is inert only because the sweep found no reader
 * for it — a claim a NEW key cannot inherit, which is why adding the affordance means
 * adding a row here.
 */
export const PAID_SNAPSHOT_META_KEYS = [
  "showSearchScheduler",
  "nlpMode",
  "jobId",
  "jobRecords",
] as const;

export type PaidSnapshotMetaKey = (typeof PAID_SNAPSHOT_META_KEYS)[number];

/**
 * `hidden` is the free-edition value the key is forced to. `restoreWhen` marks the
 * keys whose stored value IS legitimate for an org that has the surface — those
 * pass through when it answers true, so the boundary normalises entitlement and
 * nothing else. `restore` is what "pass through" means for a value a client wrote:
 * the payload is JSON, so a key typed `boolean` in the prop it feeds can arrive as
 * `"false"` or `[]`, and those shapes must not be what the reader sees. The default
 * rejects anything that is not a boolean rather than truthiness-coercing it, because
 * a stored `"false"` means OFF and `Boolean("false")` says ON.
 */
export interface PaidSnapshotMetaRule {
  hidden: unknown;
  restoreWhen?: (access: SnapshotPaidAccess) => boolean;
  restore?: (value: unknown, hidden: unknown) => unknown;
}

/** Non-boolean payload shapes land on `hidden`, so `"false"` / `[]` / `{}` stay OFF. */
const strictBoolean = (value: unknown, hidden: unknown): unknown =>
  typeof value === "boolean" ? value : hidden;

/** A job id is an opaque string; anything else is treated as "no job context". */
const asJobId = (value: unknown, hidden: unknown): unknown =>
  typeof value === "string" && value.trim() !== "" ? value : hidden;

/** The reader is `parseInt(jobRecords)`, and the app itself rejects 0 (`SearchBar.vue`). */
const asJobRecords = (value: unknown, hidden: unknown): unknown =>
  (typeof value === "string" && /^\d+$/.test(value) && parseInt(value, 10) > 0) ||
  (typeof value === "number" && Number.isInteger(value) && value > 0)
    ? value
    : hidden;

export const PAID_SNAPSHOT_META_RULES: Record<PaidSnapshotMetaKey, PaidSnapshotMetaRule> = {
  showSearchScheduler: { hidden: false },
  nlpMode: { hidden: false, restoreWhen: ({ aiAssistantAllowed }) => aiAssistantAllowed },
  jobId: {
    hidden: DEFAULT_LOGS_CONFIG.meta.jobId,
    restore: asJobId,
    restoreWhen: ({ scheduledSearchAllowed }) => scheduledSearchAllowed,
  },
  jobRecords: {
    hidden: DEFAULT_LOGS_CONFIG.meta.jobRecords,
    restore: asJobRecords,
    restoreWhen: ({ scheduledSearchAllowed }) => scheduledSearchAllowed,
  },
};

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Sanitizes the paid state of an untrusted search snapshot (an org-stored,
 * client-writable saved view) BEFORE it is merged into the live `searchObj`, and
 * RETURNS A SANITIZED COPY — the argument is never written to, so the call site has
 * to use the return value.
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
 *     written from its `PAID_SNAPSHOT_META_RULES` entry: forced to `hidden`, or
 *     normalised through `restore` when `restoreWhen` says this org legitimately has
 *     the surface. Set-driven, not per-key whack-a-mole: a new paid `meta` affordance
 *     only has to join the table above to be covered here.
 *
 * The copy is why the boundary cannot be talked out of its own result: mutating the
 * payload in place depended on the key being writable, while the merge that follows
 * (`applySearchSnapshot`) JSON-clones it, and a JSON clone READS getters. A payload
 * with an accessor-shaped `meta` therefore survived the check and reappeared in the
 * live object. `{ ...meta }` reads every getter once into a data property and the paid
 * keys are then overwritten, so a frozen, accessor- or Proxy-shaped `meta` is
 * normalised like any other. `meta` is copied one level deep, which is where every
 * classified key lives; `data`/`config` are layout the table says the view owns.
 *
 * Everything else in `meta` passes through untouched — saved views legitimately
 * persist their query, fields, layout and panel.
 */
export function sanitizeSearchSnapshotMeta<T extends PlainObject>(
  snapshot: T,
  access: SnapshotPaidAccess,
): T {
  if (!isPlainObject(snapshot)) return snapshot;

  const meta: PlainObject = isPlainObject(snapshot.meta) ? { ...snapshot.meta } : {};

  if (Object.hasOwn(meta, "logsVisualizeToggle")) {
    meta.logsVisualizeToggle = resolveLogsVisualizeToggle(
      meta.logsVisualizeToggle,
      access.patternsAllowed,
    );
  }

  for (const key of PAID_SNAPSHOT_META_KEYS) {
    if (!Object.hasOwn(meta, key)) continue;
    const rule = PAID_SNAPSHOT_META_RULES[key];
    meta[key] = rule.restoreWhen?.(access)
      ? (rule.restore ?? strictBoolean)(meta[key], rule.hidden)
      : rule.hidden;
  }

  return { ...snapshot, meta } as T;
}

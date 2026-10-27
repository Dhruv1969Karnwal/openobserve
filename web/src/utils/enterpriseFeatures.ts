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

import config from "@/aws-exports";
import { gt, raw, type I18nKey, type I18nText } from "@/types/i18n";

/**
 * The ONE registry of enterprise/cloud-only features in the app — every
 * surface calls {@link checkFeatureAccess} with a key from here instead of
 * re-deriving its own `config.isEnterprise == "true"` check. A future backend
 * flag endpoint only has to change a predicate's body here.
 */
export type FeatureKey =
  | "enterprise"
  | "rbac"
  | "cipherKeys"
  | "aiToolsets"
  | "regexPatterns"
  | "domainManagement"
  | "passwordPolicy"
  | "pipelineDestinations"
  | "pipelineBackfill"
  | "storageSettings"
  | "queryManagement"
  | "nodes"
  | "license"
  | "correlationSettings"
  | "modelPricing"
  | "llmProviders"
  | "genAiAgentMapping"
  | "incidents"
  | "workflows"
  | "oncall"
  | "logPatterns"
  | "correlation"
  | "aiAssistant"
  | "alertInsights"
  | "agentGraph"
  | "agentBehavior"
  | "discovery"
  | "queues"
  | "datasets"
  | "prompts"
  | "playground"
  | "experiments"
  | "remoteTasks"
  | "evaluations"
  | "scheduledSearch"
  | "searchJobInspector"
  | "customBranding"
  | "slack";

/**
 * The flags every predicate below reads — EDITION-only, plus RBAC's own
 * backend toggle. Meta-org restrictions and other runtime `*_enabled` flags
 * are a separate, orthogonal `visible`/hide condition callers apply on top —
 * only the edition (+ RBAC toggle) check lives here.
 */
export interface FeatureGateContext {
  isEnterprise: boolean;
  isCloud: boolean;
  /**
   * Two-tier on purpose. A LOADED config defaults OPEN (`!== false`, not `!!`) so
   * a cold load with `zoConfig` still `{}` doesn't lock out a real Enterprise/Cloud
   * user with RBAC on — same `=== false` convention the other runtime-flag route
   * guards in this codebase already use (see useEnterpriseRoutes.ts). A caller that
   * passes no config at all gets CLOSED: that is a gate that never said where its
   * state came from, not a cold load.
   */
  rbac: boolean;
}

/**
 * Builds the context from `config` (build-time) plus whatever
 * `zoConfig`-shaped object the caller has — their own `store.state.zoConfig`
 * or the route table's store singleton. Not importing the store singleton
 * here directly keeps this module `@/stores`-free for callers whose tests
 * mock that neighbor.
 */
export function buildFeatureGateContext(
  zoConfig?: { rbac_enabled?: boolean } | null,
): FeatureGateContext {
  return {
    isEnterprise: config.isEnterprise == "true",
    isCloud: config.isCloud == "true",
    rbac: zoConfig == null ? false : zoConfig.rbac_enabled !== false,
  };
}

interface FeatureGateDefinition {
  predicate: (ctx: FeatureGateContext) => boolean;
  /** An EXISTING menu/settings label key, interpolated into the generic locked message. */
  labelKey: I18nKey;
  /** A full-sentence, benefit-led message that replaces the generic one — for features discovered by browsing the nav. */
  pitchKey?: I18nKey;
  /**
   * False for a feature Cloud never offers at all (self-hosted-only, e.g.
   * cipher keys). A pure-Cloud build then reports `visible: false` instead of
   * locked, so callers hide it rather than showing a false upsell. Omit for a
   * predicate that already includes `isCloud` — nothing extra to hide there.
   */
  cloudOffers?: false;
}

const FEATURE_GATES: Record<FeatureKey, FeatureGateDefinition> = {
  // DOCUMENTED ASSUMPTION, not a verified fact: every Cloud build of this product is
  // also built with `isEnterprise=true` (see `aiAssistant` below and
  // `searchJobInspectorGateContext` in composables/shared/router.ts). Nothing in this
  // repository pins it — no `.env*` is tracked and `build-cloud-prod` is
  // `--mode=production` — so the predicate shapes that lean on it are pinned at the
  // level that IS testable: a pure-Cloud context (isCloud&&!isEnterprise) may only ever
  // LOSE affordances, never gain one (enterpriseFeatures.spec.ts, "the unpinnable Cloud
  // premise"). Consequence if the premise ever breaks: the 18 keys whose predicate is the
  // bare `isEnterprise` bit stop answering to a Cloud build and disappear from its UI — a
  // lost affordance, not a paid leak.
  // Generic "this needs Enterprise" gate — e.g. the Traces Service Graph tab,
  // which has no settings/IAM label of its own to borrow. Self-hosted only,
  // same as the Settings batch below — Cloud doesn't offer it either.
  enterprise: {
    predicate: (c) => c.isEnterprise,
    labelKey: "menu.serviceGraph",
    pitchKey: "enterpriseFeature.pitch.serviceGraph",
    cloudOffers: false,
  },
  // Used for groups/roles AND quota — quota additionally requires meta-org,
  // applied as a separate `visible` hide at the call site (see the doc
  // comment on FeatureGateContext). Cloud DOES offer RBAC, so no
  // `cloudOffers: false` here — that flag force-hides on pure Cloud under ANY
  // policy, which would be wrong for a feature Cloud actually sells.
  rbac: {
    predicate: (c) => (c.isEnterprise || c.isCloud) && c.rbac,
    labelKey: "iam.sectionPermissions",
    pitchKey: "enterpriseFeature.pitch.rbac",
  },
  // This whole batch is self-hosted-only: no self-serve "upgrade" story on
  // Cloud exists for managing your own nodes, cipher keys, or license.
  cipherKeys: {
    predicate: (c) => c.isEnterprise,
    labelKey: "settings.cipherKeys",
    cloudOffers: false,
  },
  aiToolsets: {
    predicate: (c) => c.isEnterprise,
    labelKey: "aiToolset.header",
    cloudOffers: false,
  },
  regexPatterns: {
    predicate: (c) => c.isEnterprise,
    labelKey: "regex_patterns.title",
    cloudOffers: false,
  },
  domainManagement: {
    predicate: (c) => c.isEnterprise,
    labelKey: "settings.ssoDomainRestrictions",
    cloudOffers: false,
  },
  passwordPolicy: {
    predicate: (c) => c.isEnterprise,
    labelKey: "settings.passwordPolicy",
    cloudOffers: false,
  },
  pipelineDestinations: {
    predicate: (c) => c.isEnterprise,
    labelKey: "pipeline_destinations.header",
    cloudOffers: false,
  },
  // Pipeline backfill jobs — the Pipelines page's Backfill entry and its
  // route; same self-hosted-only edition predicate.
  pipelineBackfill: {
    predicate: (c) => c.isEnterprise,
    labelKey: "pipeline.backfill",
    cloudOffers: false,
  },
  storageSettings: {
    predicate: (c) => c.isEnterprise,
    labelKey: "storage_settings.tabLabel",
    cloudOffers: false,
  },
  queryManagement: {
    predicate: (c) => c.isEnterprise,
    labelKey: "settings.queryManagement",
    cloudOffers: false,
  },
  nodes: { predicate: (c) => c.isEnterprise, labelKey: "settings.nodes", cloudOffers: false },
  license: { predicate: (c) => c.isEnterprise, labelKey: "settings.license", cloudOffers: false },
  correlationSettings: {
    predicate: (c) => c.isEnterprise,
    labelKey: "settings.correlationSettings",
    cloudOffers: false,
  },
  modelPricing: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "settings.llmModelPricing",
  },
  llmProviders: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "llmProviders.tabLabel",
  },
  // Also gates the LLM Insights/Sessions Agent-mode toggle and the LLM
  // Insights version-compare entry — both call the same agent-mapping API
  // this Settings tab configures, so they share this one gate rather than
  // each re-deriving their own edition check (see AiScopeBar.vue,
  // LLMInsightsDashboard.vue, SessionsList.vue).
  genAiAgentMapping: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "settings.genAiAgentMapping.tabLabel",
    pitchKey: "enterpriseFeature.pitch.genAiAgentMapping",
  },
  incidents: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "menu.incidents",
    pitchKey: "enterpriseFeature.pitch.incidents",
  },
  workflows: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "menu.workflows",
    pitchKey: "enterpriseFeature.pitch.workflows",
  },
  oncall: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "menu.onCall",
    pitchKey: "enterpriseFeature.pitch.oncall",
  },
  // Log-pattern mining — the Logs search "Patterns" toggle. This key gates that
  // panel ONLY: the stream Schema page's per-field pattern-association picker (and
  // its SDR column/dialog) reads the separate `regexPatterns` key, which happens to
  // carry the same predicate today. Two keys, two surfaces — renaming a predicate
  // here does not move the Schema page, and vice versa.
  logPatterns: {
    predicate: (c) => c.isEnterprise,
    labelKey: "search.showPatternsLabel",
    pitchKey: "enterpriseFeature.pitch.logPatterns",
    cloudOffers: false,
  },
  // Service-stream correlation — the Logs row drawer's View Related button
  // and its Logs/Metrics/Traces tabs.
  correlation: {
    predicate: (c) => c.isEnterprise,
    labelKey: "search.viewRelated",
    pitchKey: "enterpriseFeature.pitch.correlation",
    cloudOffers: false,
  },
  // The AI assistant family (header chat panel, query-editor "Ask AI" bar).
  // Cloud is always built with isEnterprise=true too, so `isEnterprise ||
  // isCloud` matches today's real-world behavior while following the same
  // dual-predicate convention as rbac/workflows/oncall above.
  aiAssistant: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "menu.aiAssistant",
    pitchKey: "enterpriseFeature.pitch.aiAssistant",
  },
  alertInsights: {
    predicate: (c) => c.isEnterprise,
    labelKey: "alerts.insights.title",
    pitchKey: "enterpriseFeature.pitch.alertInsights",
    cloudOffers: false,
  },
  // The AI Observability rail's Monitor/Annotate/Experiment/Evaluate sections
  // beyond LLM Insights + Sessions — same dual predicate as workflows/oncall
  // since Cloud offers the whole module, not just the OSS-shipped half (see
  // `sectionItems` in enterprise/views/AIObservability/Index.vue).
  agentGraph: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "aiObservability.nav.agentGraph",
    pitchKey: "enterpriseFeature.pitch.agentGraph",
  },
  agentBehavior: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "aiObservability.nav.agentBehavior",
    pitchKey: "enterpriseFeature.pitch.agentBehavior",
  },
  discovery: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "aiObservability.nav.discovery",
    pitchKey: "enterpriseFeature.pitch.discovery",
  },
  queues: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "aiObservability.nav.queues",
    pitchKey: "enterpriseFeature.pitch.queues",
  },
  datasets: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "aiObservability.nav.datasets",
    pitchKey: "enterpriseFeature.pitch.datasets",
  },
  prompts: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "aiObservability.nav.prompts",
    pitchKey: "enterpriseFeature.pitch.prompts",
  },
  playground: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "aiObservability.nav.playground",
    pitchKey: "enterpriseFeature.pitch.playground",
  },
  experiments: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "aiObservability.nav.experiments",
    pitchKey: "enterpriseFeature.pitch.experiments",
  },
  remoteTasks: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "aiObservability.nav.remoteTasks",
    pitchKey: "enterpriseFeature.pitch.remoteTasks",
  },
  evaluations: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "aiObservability.sections.evaluate",
    pitchKey: "enterpriseFeature.pitch.evaluations",
  },
  // The Logs search bar's "Scheduled Search" menu (create/list queries that
  // re-run on a schedule) — same dual predicate as workflows/oncall, no
  // existing label of its own to borrow so it carries its own pitch.
  scheduledSearch: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "search.createScheduledSearch",
    pitchKey: "enterpriseFeature.pitch.scheduledSearch",
  },
  // The Search Job Inspector (`/logs/inspector`). Self-hosted-only: unlike the
  // batch above, whose `isEnterprise` predicate accepts a Cloud build (Cloud
  // ships `isEnterprise=true` as well — see `aiAssistant`), this feature's three
  // entry points each refuse Cloud outright (`config.isCloud == 'false'`), so the
  // predicate does too — the route gate and the affordances have to answer the
  // same question. The backend `search_inspector_enabled` flag is the runtime
  // conjunct the registry leaves to callers (see the FeatureGateContext note);
  // the route guard applies it on top of this edition answer.
  searchJobInspector: {
    predicate: (c) => c.isEnterprise && !c.isCloud,
    labelKey: "logs.searchJobInspector.title",
    cloudOffers: false,
  },
  // Settings → General's white-label logo/text section. Self-hosted-only —
  // re-skinning a managed Cloud deployment per-org isn't offered there either.
  customBranding: {
    predicate: (c) => c.isEnterprise,
    labelKey: "settings.customLogoText",
    pitchKey: "enterpriseFeature.pitch.customBranding",
    cloudOffers: false,
  },
  // The edition gate only: whether this org has Slack turned on is the org config's `slack_enabled`.
  slack: {
    predicate: (c) => c.isEnterprise || c.isCloud,
    labelKey: "settings.slackApp",
  },
};

/** True when `key` names a registered feature gate (vs. some other `gate`/flag string a caller is checking). */
export function isFeatureKey(key: string): key is FeatureKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_GATES, key);
}

/** Every registered key — `FeatureKey` is a type, erased at runtime, so
    tooling that has to iterate "all of them" (the completeness test, any
    future lint rule) reads this instead of hand-maintaining its own copy. */
export const ALL_FEATURE_KEYS: FeatureKey[] = Object.keys(FEATURE_GATES) as FeatureKey[];

/** How the app presents a feature this build does not unlock. */
export type PaidFeaturePolicy = "hide" | "lock";

/**
 * Retrace.ai ships one edition, so an entitlement-gated feature is not sold in
 * the UI: `"hide"` renders nothing at all instead of a locked affordance.
 * `"lock"` restores visibility and behavior — but NOT uniformly, and the
 * difference is per CLASS OF SURFACE, not per policy. Every surface that refuses
 * a feature belongs to exactly one of these; "what does `"lock"` do?" is only
 * answerable together with "to which surface?":
 *
 * | class | where it is decided | `"lock"` outcome | `"hide"` outcome |
 * |---|---|---|---|
 * | in-page affordance wrapped in {@link useLockedAffordance} / {@link checkFeatureAccess} | the component's own `v-if` + click branch | visible-but-locked; the click opens the upsell dialog | omitted entirely |
 * | route wrapped in {@link withFeatureGate} with no bounce target of its own | {@link withFeatureGate} | lands on the shared `enterpriseFeatureLocked` PAGE (with `feature` + `redirect`) | org home |
 * | route with a composed section guard: DBM tabs (`dbmEnterpriseGuard`), the alert surfaces / Downtimes / Alert calibration, Settings › Slack | that guard, which has NO policy branch | section home instead of the refused page: `dbmDatabases`, `alertList`, `general` — never the lock page | the same bounce |
 * | route whose guard ALSO reads a runtime `/config` flag (Workflows, Synthetics, private locations, Profiles, service accounts) | the flag half, after the edition half | home (`users` for service accounts) whenever the flag says off, in EITHER policy | same |
 * | surface registered only when the build says enterprise/cloud (AutoObserve, Fleet, Announcements, org management) | `config.isEnterprise` / `isCloud` at registration time | 404 — the route does not exist, so no gate ever runs | same |
 * | left-rail / menu tile carrying `locked` (`ONavGroup`, `MenuLink`) | the tile's click handler | `router.push({name:"enterpriseFeatures"})` — the COMPARISON page, not the lock page and not the dialog | tile is dropped (`visible` false) |
 * | `AiScopeBar`'s Stream/Agent toggle | the callers: `visible && allowed` as `show-agent-toggle`, and the pitch behind `.visible` as `agentToggleLockedMessage` | the Agent item stays in the bar carrying a lock suffix and its click opens the upsell dialog | the toggle group is omitted (`visible` false ⇒ no message passed either) |
 * | route entered while the ORGANIZATION's trial has lapsed (`shouldPaywallRoute` / `isPaywalledDestination` → `routeGuard`, `utils/auth.ts:109-142`) | the org's `free_trial_expiry`, never this policy | `next({ name: "plans" })` + `notifyTrialBlocked`; `ONavGroup` paints its own `lock` glyphs on paywalled tiles while this policy is `"hide"` (`ONavGroup.vue:316-327` for the flags, glyphs at `:736,787,897,953`) | the same — this guard has no policy branch |
 *
 * So the shared lock page is ONE of five refusal destinations (lock page, section
 * home, comparison page, 404, and the trial paywall's `plans`) and each guard/entry's
 * own comment is normative for its class; {@link withFeatureGate} alone does not
 * promise a lock-page landing.
 * Both upsell surfaces are themselves policy-gated (`hideUpsellPage`), which is what
 * keeps `"hide"` free of any path back to a paid page. The paywall class is the odd
 * one out: `shouldPaywallRoute` requires `config.isCloud === "true"` AND an org
 * `free_trial_expiry`, so it is inert in the edition this branch ships and live in a
 * Cloud build of it — which is why it belongs in the table even though no policy
 * branch of ours reaches it.
 *
 * LIMITATION, restated so the table above is not read as verified behaviour: the
 * `"lock"` half of every row is UNEXECUTABLE and therefore UNTESTED in this tree.
 * {@link checkFeatureAccess} and {@link withFeatureGate} read the module-scope
 * `hidesPaidFeatures` constant, so the test seam
 * (`web/src/test/unit/helpers/paidFeaturePolicy.ts`, which overrides only the exported
 * getters) cannot reach them — see that file's own LIMITATION note, and
 * `composables/shared/useEnterpriseRoutes.spec.ts`, which declines to write a
 * lock-mode guard case for exactly this reason. No test in the repository executes the
 * class-2 lock-page landing; the table is a reading of the code, not a green suite.
 *
 * This does NOT restore the lock-icon GLYPHS deleted during the hide rollout (10
 * icons across Header, QueryEditor, ServiceAccountsList, PipelineEditor, JsonPreview,
 * logs/SearchBar and traces/TraceDetails): a `"lock"` build shows those affordances
 * unlocked-looking while still routing their clicks to the dialog.
 *
 * Known `"lock"`-only wart, kept visible on purpose: the Search Job Inspector route
 * folds its runtime flag into the EDITION bit (see `searchJobInspectorGateContext` in
 * composables/shared/router.ts), so a `"lock"` build of an entitled self-hosted deploy
 * with the flag off lands on the upsell page — an "upgrade" CTA for a feature the
 * edition already includes, i.e. the false CTA the `rbac` branch of
 * {@link checkFeatureAccess} exists to suppress. Unreachable while the policy is
 * `"hide"`; fix it by giving that key a runtime half of its own if `"lock"` ships.
 */
export const PAID_FEATURE_POLICY: PaidFeaturePolicy = "hide";

/** True when unavailable features must be removed from the UI rather than locked. */
export const hidesPaidFeatures: boolean = PAID_FEATURE_POLICY === "hide";

// Locally-gated surfaces render lock icons whose dialog the policy refuses; under "hide" they omit.
export const showsLockedAffordances: boolean = !hidesPaidFeatures;

export interface FeatureAccess {
  allowed: boolean;
  /** False means hide this feature ENTIRELY — not locked, not shown at all. Always true when `allowed` is true. */
  visible: boolean;
  /** Empty when `allowed` (or not `visible`) — nothing to tell the user. */
  message: I18nText;
  /**
   * False only for the one case where upgrading wouldn't help: an edition
   * that already supports the feature, but an admin-configured flag (RBAC)
   * is off. Callers that render an "Upgrade" CTA next to `message` should
   * suppress it when this is false. Always true otherwise.
   */
  ctaRelevant: boolean;
}

/**
 * The one function every surface calls with a feature key to find out
 * whether it's available in this build, and what to tell the user if not.
 * `context` is required (not defaulted) so every call site is explicit about
 * where its state comes from — see {@link buildFeatureGateContext}.
 */
export function checkFeatureAccess(key: FeatureKey, context: FeatureGateContext): FeatureAccess {
  const gate = FEATURE_GATES[key];
  const allowed = gate.predicate(context);
  if (allowed) return { allowed: true, visible: true, message: raw(""), ctaRelevant: true };
  const pureCloud = context.isCloud && !context.isEnterprise;
  if (gate.cloudOffers === false && pureCloud) {
    return { allowed: false, visible: false, message: raw(""), ctaRelevant: true };
  }
  const hidden = hidesPaidFeatures;
  // RBAC alone depends on an admin toggle, not just edition — an edition
  // that already supports it just needs the toggle on, so "upgrade" is a
  // false, confusing CTA here. Accepted consequence under the shipped "hide"
  // policy: this explanation becomes unreachable by design — the gated
  // surfaces vanish silently instead of telling the admin to flip the toggle.
  if (key === "rbac" && (context.isEnterprise || context.isCloud) && !context.rbac) {
    return {
      allowed: false,
      visible: !hidden,
      message: hidden ? raw("") : gt("enterpriseFeature.rbacDisabled"),
      ctaRelevant: false,
    };
  }
  const message = gate.pitchKey
    ? gt(gate.pitchKey)
    : gt("enterpriseFeature.locked", { feature: gt(gate.labelKey) });
  return {
    allowed: false,
    visible: !hidden,
    message: hidden ? raw("") : message,
    ctaRelevant: !hidden,
  };
}

/**
 * Wraps a route guard so navigation cannot reach an entitlement-gated page:
 * under `PAID_FEATURE_POLICY = "hide"` it bounces to the org home, otherwise to
 * the shared locked-feature page. Must be a GUARD, not
 * a choice of `component:` — vue-router permanently caches a route's first-
 * resolved lazy component (`extractComponentsGuards`:
 * `record.components[name] = resolvedComponent`), so picking between two
 * components would freeze at whichever resolved first. A guard re-runs every
 * navigation, so it can safely depend on state that's still loading.
 *
 * `getContext` defaults to a context whose `rbac` is false, so it serves the
 * edition-only keys only; a route whose key reads RBAC must pass one that
 * reads `store.state.zoConfig` (see the shim in useEnterpriseRoutes.ts).
 */
export function withFeatureGate(
  key: FeatureKey,
  guard: (to: any, from: any, next: any) => void,
  getContext: () => FeatureGateContext = () => buildFeatureGateContext(),
) {
  return (to: any, from: any, next: any) => {
    if (!checkFeatureAccess(key, getContext()).allowed) {
      if (hidesPaidFeatures) {
        // Intentionally drops the `redirect: to.fullPath` the lock page
        // preserves: a hidden feature has no in-app unlock path to return from.
        next({ name: "home", query: { org_identifier: to.query?.org_identifier } });
        return;
      }
      next({
        name: "enterpriseFeatureLocked",
        query: { feature: key, org_identifier: to.query?.org_identifier, redirect: to.fullPath },
      });
      return;
    }
    guard(to, from, next);
  };
}

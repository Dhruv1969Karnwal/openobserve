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
 * The contrast gate's RUNTIME coverage: the pairs `contrast.spec.ts` cannot see.
 *
 * That suite resolves the token sheets — but utils/theme.ts re-derives the whole
 * `--color-primary-*` ramp from the selected theme's `themeColor` and writes it
 * as INLINE styles on `<html>`, which beats every stylesheet declaration. Under
 * the default dark theme (O2 Signature, themeColor #E6E6E6) the injected ramp is
 * #fefefe…#2e2e2e, so any surface declared as `var(--color-primary-800/900)`
 * paints as a mid-grey at runtime no matter what the teal sheet says: a live
 * capture measured secondary/label text on the hovered and selected table washes
 * at 2.24–2.65:1 and white on the active select/tab fill at 3.25–3.45:1 while
 * contrast.spec stayed green on the sheet values.
 *
 * So this file closes the seam statically (the theme registry is plain TS): it
 * replays `generatePrimaryPalette` for EVERY predefined theme, injects the
 * result — plus the inks `libraryForegroundTokens` computes and, where the
 * registry carries them, the theme's `semanticColors` overlay, exactly as
 * `applyThemeColors` writes them — over BOTH parsed sheets, and measures the
 * pairs against what the browser would actually paint. Six invariants, one
 * matrix run over all twelve scopes, and one consumer scan per mode:
 *
 *  1. THEME-INVARIANT WASHES. The dark state surfaces that carry grey-tier text
 *     are ladder literals in dark.css — the same hex under every theme's
 *     injected ramp and the bare sheet. If anyone re-points one at
 *     `--color-primary-*`, the resolved value moves per theme and this test goes
 *     red — which is the bidirectional tripwire, not a formality.
 *  2. LADDER ORDER. hover steps off the canvas below the panel elevation step,
 *     selected sits above hover and below the well, the accent wash/active sit
 *     above the overlay tier in order — subtle, monotonic, never bright.
 *  3. THE PAIR MATRIX, BOTH MODES. Every text role an enumerated consumer
 *     paints on these surfaces clears 4.5:1 under every injected ramp — dark AND
 *     light. The measurement pass proved the light mirror of the original seam
 *     (white on the runtime primary-600 fills at 3.60, the active-tab accent ink
 *     at 3.03, the wash roles at 3.49–4.45); the fills' inks and the accent-text
 *     roles are now picked per theme by utils/theme.ts and the wash roles name
 *     AA-dark sheet tiers, so nothing here is exempted by NAME any more. The
 *     only skips are the two explicit ledgers below (booked debt + SC 1.4.3
 *     inactive roles), each entry carrying its measured number and pinned by an
 *     equality assertion in both directions — a skip that stops being needed
 *     fails the suite, and a new failure cannot hide behind a pattern.
 *  4. THE CONSUMER SCAN: the components' own class bindings are
 *     measured on the surfaces they actually paint — fill inks on their fills
 *     (FILL_INK_HOSTS), everything else on the popup/trigger tiers — so a fill
 *     token used as text, or a role dropping under AA on any predefined ramp,
 *     goes red naming the file.
 *  5. THE RUNTIME-GROUND SWEEP. A ground whose paint is injected
 *     (`--color-primary-*` tints and fills, the runtime washes under table rows,
 *     the accent chip/selection tiers) moves every text utility drawn on it, so
 *     each enumerated pair is measured under all twelve scopes, translucent
 *     grounds are composited before the ratio is taken, and the accent-as-text
 *     roles whose sheet step is a ramp shade are locked twice over: the injected
 *     ink must clear AA on its real ground, and the sheet shade must still be
 *     the failure that justifies the pick (ACCENT_TINT_PICKS). What cannot be
 *     fixed without a palette-owner decision is booked number-locked in
 *     RUNTIME_GROUND_RESIDUALS, next to the button-label ledger.
 *  6. THE ACCENT FILL. `bg-theme-accent` is not a ramp token — the runtime
 *     writes the raw theme colour into --color-theme-accent at alpha 1 in both modes,
 *     so it is the same painted pixel as the button's rest fill. That ground is now in
 *     the injected map, its two ground/ink invariants are locked, and a template scan
 *     keeps any static white/near-black label off it (the two gradient heroes excepted
 *     by documented decision).
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PREDEFINED_THEMES } from "@/constants/themes";
import { generatePrimaryPalette, libraryForegroundTokens } from "@/utils/theme";

import {
  composite,
  contrastRatio,
  parseColor,
  relativeLuminance,
  resolveColor,
  resolveTokens,
} from "./colorMath";
import { createRuntimeModel, runRuntimeCensus } from "./runtimeContrast";
import { scanSources } from "./runtimeContrastScan";

const here = dirname(fileURLToPath(import.meta.url));

/** Same cascade as contrast.spec.ts — the dark scope was the seam; so was the light one. */
const TOKEN_FILES = ["base.css", "semantic.css", "component.css", "dark.css"];
const SHEETS = TOKEN_FILES.map((file) => readFileSync(join(here, file), "utf8"));
const SHEET_DARK = resolveTokens(SHEETS).dark;
const SHEET_LIGHT = resolveTokens(SHEETS).light;

/**
 * The twelve injected scopes come from tokens/runtimeContrast — the SAME model
 * scripts/check-runtime-contrast.mjs measures the template census with. A second implementation of
 * "what applyThemeColors writes" is exactly the drift this program has been chasing, so this file
 * no longer builds scopes, it consumes the shared ones.
 */
const RUNTIME = createRuntimeModel(SHEETS);

/** One entry per predefined theme: the dark scope, injected as syncO2LibraryTokens writes it. */
const RUNTIME_SCOPES = RUNTIME.darkScopes.map((scope) => ({
  name: scope.theme,
  themeColor: scope.themeColor,
  scope: scope.tokens,
}));

/** The LIGHT mirror: the light sheet under each theme's light ramp. */
const LIGHT_RUNTIME_SCOPES = RUNTIME.lightScopes.map((scope) => ({
  name: scope.theme,
  themeColor: scope.themeColor,
  scope: scope.tokens,
}));

/** Bare-var()-alias chain a role token folds through in `scope` (self first). */
const aliasChain = (name: string, scope: Map<string, string>): string[] => {
  const chain = [name];
  let current = name;
  for (;;) {
    const match = /^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/.exec((scope.get(current) ?? "").trim());
    if (!match || chain.includes(match[1])) return chain;
    current = match[1];
    chain.push(current);
  }
};

const hexOf = (name: string, scope: Map<string, string>): string => {
  const color = resolveColor(name, scope);
  if (!color) throw new Error(`${name} does not resolve`);
  return `#${[color.r, color.g, color.b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
};

/** What a translucent ground is composited over before it is measured. */
const PAIR_UNDER: Record<string, string> = {
  "--color-icon-chip-primary-bg": "--color-surface-base",
};

/** A token name, or a literal hex the gate computes itself (a sheet shade). */
const side = (value: string, scope: Map<string, string>) =>
  resolveColor(value, scope) ?? parseColor(value);

const ratio = (fg: string, bg: string, scope: Map<string, string>): number => {
  let fgColor = side(fg, scope);
  let bgColor = side(bg, scope);
  if (!fgColor || !bgColor) throw new Error(`unresolved pair ${fg} on ${bg}`);
  // WCAG needs composited pixels: a translucent ground (the dark icon-chip
  // tints) is measured over the surface the component actually paints it on.
  if (fgColor.a < 1 || bgColor.a < 1) {
    const under = resolveColor(PAIR_UNDER[bg] ?? "--color-surface-base", scope);
    if (!under) throw new Error(`no ground-under for ${bg}`);
    if (bgColor.a < 1) bgColor = composite(bgColor, under);
    if (fgColor.a < 1) fgColor = composite(fgColor, bgColor);
  }
  return contrastRatio(fgColor, bgColor);
};

/** Surfaces that must be literal in dark.css: no themeColor may move them. */
const THEME_INVARIANT_SURFACES = [
  "--d-hover",
  "--d-selected",
  "--color-surface-accent-hover",
  "--color-surface-accent-active",
  "--color-table-row-hover-bg",
  "--color-table-row-selected-bg",
  "--color-tabs-hover-bg",
  "--color-field-list-row-hover-bg",
  "--color-collapsible-trigger-hover-bg",
  "--color-collapsible-trigger-open-bg",
  "--color-button-outline-hover-bg",
  "--color-pagination-item-active-bg",
  "--color-datepicker-day-selected-bg",
  "--color-datepicker-clock-header-bg",
  "--color-datepicker-clock-selected-bg",
  "--color-datepicker-selected-fg",
];

/**
 * The measured matrix, run under BOTH modes (six dark + six light scopes).
 * Every entry names the consumer that paints the pair — text roles are what
 * ACTUALLY lands on the surface, per grep of the class bindings (tables:
 * OTableBodyCell.vue default `text-text-body` + per-cell roles; menus:
 * component.css dropdown/select item text; active pills: MenuLink `text-
 * tabs-active-text`, OSelect `select-item-selected-text`, fills consumed via
 * *-hover-bg/*-active-bg; the checked tick: OCheckbox/OSelect
 * `text-checkbox-checked-fg`; status chips/diff tables: `text-status-*-text`).
 */
const TEXT_PAIRS: { fg: string; bg: string; where: string }[] = [
  // Row washes (OTableBodyCell's hover/selected cells, AutoObserveActivityTab,
  // DiscoveredServices, UsageTrends, Quota).
  ...(
    [
      "--color-text-heading",
      "--color-text-body",
      "--color-text-secondary",
      "--color-text-label",
      "--color-text-muted",
    ] as const
  ).flatMap((fg) => [
    { fg, bg: "--color-table-row-hover-bg", where: "cell text on a hovered row" },
    { fg, bg: "--color-table-row-selected-bg", where: "cell text on a selected row" },
  ]),
  {
    fg: "--color-table-highlight-text",
    bg: "--color-table-row-selected-bg",
    where: "the edited-row label (Quota.vue)",
  },
  {
    fg: "--color-text-placeholder",
    bg: "--color-table-row-hover-bg",
    where: "empty-cell placeholder grain on a hovered row",
  },
  // Menu/list hover wash (dropdown/select/datepicker/collapsible/ghost).
  {
    fg: "--color-dropdown-item-text",
    bg: "--color-surface-accent-hover",
    where: "context-menu row",
  },
  {
    fg: "--color-select-item-text",
    bg: "--color-surface-accent-hover",
    where: "select option row",
  },
  {
    fg: "--color-tabs-inactive-text",
    bg: "--color-tabs-hover-bg",
    where: "nav rail label on hover (MenuLink.vue)",
  },
  {
    fg: "--color-datepicker-day-text",
    bg: "--color-datepicker-day-hover-bg",
    where: "calendar day",
  },
  {
    fg: "--color-collapsible-caption",
    bg: "--color-collapsible-trigger-hover-bg",
    where: "trigger caption",
  },
  {
    fg: "--color-button-ghost-text",
    bg: "--color-button-ghost-hover-bg",
    where: "ghost button label",
  },
  {
    fg: "--color-button-secondary-foreground",
    bg: "--color-button-secondary-hover",
    where: "secondary button label while hovered (Crimson Ink injects this pair)",
  },
  {
    fg: "--color-button-outline-text",
    bg: "--color-button-outline-hover-bg",
    where: "outline button label (Crimson Ink injects this pair)",
  },
  {
    fg: "--color-button-ghost-muted-hover-text",
    bg: "--color-button-ghost-muted-hover-bg",
    where: "the accent label the muted ghost reveals on hover",
  },
  {
    fg: "--color-text-secondary",
    bg: "--color-surface-accent-hover",
    where: "hover-wash ceiling role",
  },
  // Active chat row (HomeChatHistory.vue): the title rides the body tier and
  // the preview the heading tier (NOT secondary — grey-400 measured 4.15 on the
  // theme-invariant dark #39404a active host). Both clear AA on every ramp.
  {
    fg: "--color-text-heading",
    bg: "--color-surface-accent-active",
    where: "active chat preview (HomeChatHistory.vue)",
  },
  {
    fg: "--color-text-body",
    bg: "--color-surface-accent-active",
    where: "active chat title (HomeChatHistory.vue)",
  },
  // Applied insight chip (DbmInsightStrip.vue): the same held accent-active host,
  // reached by a different route — grey-400 secondary measures 4.15 on the
  // theme-invariant dark #39404a (the light twin was already 5.76+ since
  // grey-600), so the evidence sentence binds the heading tier while the filter
  // applies: 8.31 dark, 11.15–12.75 across the six injected light ramps.
  {
    fg: "--color-text-heading",
    bg: "--color-surface-accent-active",
    where: "applied-insight evidence sentence (DbmInsightStrip.vue)",
  },
  // ── The rest of the runtime-accent-ground sweep. Every text/utility
  // class binding that lands on an accent wash, a selected fill or a runtime
  // tint, read out of the consumer source (see fixer notes for the matrix).
  // The reported pair was `text-text-link` here (3.03 light O2 Lens / 3.77 dark
  // O2 Pulse); the affordance now binds the per-theme accent label instead.
  {
    fg: "--color-button-ghost-primary-text",
    bg: "--color-surface-accent-active",
    where:
      "applied-insight affordance + copied-org flash (DbmInsightStrip.vue, OrganizationSelector.vue)",
  },
  {
    fg: "--color-button-ghost-primary-text",
    bg: "--color-tabs-hover-bg",
    where: "filters chip label while a filter count is live (QueryConfig.vue)",
  },
  {
    fg: "--color-button-ghost-primary-text",
    bg: "--color-button-ghost-primary-hover-bg",
    where: "confirm-dialog action labels over the accent wash (O2AIConfirmDialog.vue)",
  },
  {
    fg: "--color-text-secondary",
    bg: "--color-surface-tint-accent",
    where: "service-card metrics on the selected card wash (OverviewTab.vue)",
  },
  {
    fg: "--color-text-heading",
    bg: "--color-surface-tint-accent",
    where: "service-card title on the selected card wash (OverviewTab.vue)",
  },
  {
    fg: "--color-status-error-text",
    bg: "--color-table-row-hover-bg",
    where: "routed error-rate cell on a hovered row (OverviewTab.vue)",
  },
  {
    fg: "--color-collapsible-icon-open",
    bg: "--color-collapsible-trigger-hover-bg",
    where: "open section label + icons under the cursor (OCollapsible.vue)",
  },
  {
    fg: "--color-collapsible-icon-open",
    bg: "--color-collapsible-trigger-open-bg",
    where: "open section label, unhovered (OCollapsible.vue)",
  },
  {
    fg: "--color-icon-chip-primary-text",
    bg: "--color-icon-chip-primary-bg",
    where:
      "primary icon chip glyph, step numbers, logo-fallback initials (UsageTab.vue, HowItWorksDrawer.vue, AIIntegrations.vue)",
  },
  {
    fg: "--color-badge-primary-soft-text",
    bg: "--color-badge-primary-soft-bg",
    where:
      "OBadge primary tone + the field-count pill (utils/dbm/tones.ts, alert_calibration/format.ts, EnrichmentSchema.vue)",
  },
  {
    fg: "--color-file-chip-text",
    bg: "--color-file-chip-bg",
    where: "chosen-file chip name (OFile.vue)",
  },
  {
    fg: "--color-file-chip-remove",
    bg: "--color-file-chip-bg",
    where: "remove affordance inside the same chip (OFile.vue)",
  },
  {
    fg: "--color-datepicker-day-range-text",
    bg: "--color-datepicker-day-range-bg",
    where: "day inside the dragged range band (ODateRangeCalendar.vue, ODateTimeRange.vue)",
  },
  {
    fg: "--color-toggle-item-active-text",
    bg: "--color-toggle-item-active-bg",
    where: "on-state item label (OToggleGroupItem.vue)",
  },
  {
    fg: "--color-datepicker-day-outside-text",
    bg: "--color-datepicker-day-hover-bg",
    where:
      "outside-month day under the cursor (ODate.vue, ODateRangeCalendar.vue, ODateTimeRange.vue)",
  },
  {
    fg: "--color-text-secondary",
    bg: "--color-surface-accent-hover",
    where: "locked-step body copy on the active checklist card (OnCallSetupChecklist.vue)",
  },
  {
    fg: "--color-text-body",
    bg: "--color-badge-primary-soft-bg",
    where: "progress line inside the running-replay banner (BrowserJourney.vue)",
  },
  // Active / selected fills.
  {
    fg: "--color-checkbox-checked-fg",
    bg: "--color-checkbox-checked-bg",
    where: "checked tick inside the fill (OCheckbox.vue / OSelect.vue ticks)",
  },
  {
    fg: "--color-tabs-active-text",
    bg: "--color-tabs-active-bg",
    where: "active nav pill (MenuLink/ONavbar) and the dashboard tab row",
  },
  {
    fg: "--color-select-item-selected-text",
    bg: "--color-select-item-selected-bg",
    where:
      "the highlighted option in an open list + the selected chart-type row (CustomChartTypeSelector.vue)",
  },
  {
    fg: "--color-button-ghost-primary-text",
    bg: "--color-button-ghost-primary-active-bg",
    where: "accent ghost label while pressed",
  },
  {
    fg: "--color-pagination-item-active-text",
    bg: "--color-pagination-item-active-bg",
    where: "current page number",
  },
  {
    fg: "--color-pagination-item-text",
    bg: "--color-pagination-item-hover-bg",
    where: "page number under the cursor",
  },
  {
    fg: "--color-datepicker-day-selected-text",
    bg: "--color-datepicker-day-selected-bg",
    where: "selected calendar day",
  },
  {
    fg: "--color-datepicker-relative-btn-selected-text",
    bg: "--color-datepicker-relative-btn-selected-bg",
    where: "selected relative-time preset",
  },
  {
    fg: "--color-datepicker-segment-focus-text",
    bg: "--color-datepicker-segment-focus-bg",
    where: "focused date segment digits",
  },
  {
    fg: "--color-datepicker-clock-header-text",
    bg: "--color-datepicker-clock-header-bg",
    where: "clock header",
  },
  {
    fg: "--color-datepicker-clock-selected-text",
    bg: "--color-datepicker-clock-selected-bg",
    where: "selected clock number (dark inverts: ink on the light disc)",
  },
  // The selected/tab ink the time-range controls actually paint, and
  // the one-text-token ghost labels in their PRESSED (accent-active) state.
  {
    fg: "--color-datepicker-selected-fg",
    bg: "--color-datepicker-popup-bg",
    where: "selected time segment + active Relative/Absolute tab (OTime.vue, ODateTimeRange.vue)",
  },
  {
    fg: "--color-button-ghost-subtle-text",
    bg: "--color-button-ghost-subtle-active-bg",
    where: "subtle ghost label while held (one text token across rest/hover/active)",
  },
  {
    fg: "--color-button-ghost-muted-text",
    bg: "--color-button-ghost-muted-active-bg",
    where: "muted ghost label while held, before the hover-text swap applies",
  },
  {
    fg: "--color-button-ghost-muted-hover-text",
    bg: "--color-button-ghost-muted-active-bg",
    where: "muted ghost accent label when pressed while hovered",
  },
  // The stable status inks — routed at every text consumer because
  // status-positive/-negative are the slots a theme's semantics repaint
  // (O2 Crimson Ink light put 2.80:1 orange under status-negative as text).
  {
    fg: "--color-status-success-text",
    bg: "--color-status-success-bg",
    where: "success label inside the success wash (diff tables, checklists)",
  },
  {
    fg: "--color-status-error-text",
    bg: "--color-status-error-bg",
    where: "error label inside the error wash (import results, RCA)",
  },
  {
    fg: "--color-status-success-text",
    bg: "--color-surface-base",
    where: "success label on the page (routed status-positive text sites)",
  },
  {
    fg: "--color-status-error-text",
    bg: "--color-surface-base",
    where: "error label on the page (routed status-negative text sites)",
  },
];

const NON_TEXT_PAIRS: { fg: string; bg: string; where: string }[] = [
  {
    fg: "--color-border-strong",
    bg: "--color-table-row-hover-bg",
    where: "checkbox edge on a hovered row",
  },
  {
    fg: "--color-border-strong",
    bg: "--color-table-row-selected-bg",
    where: "checkbox edge on a selected row",
  },
  {
    fg: "--color-accent",
    bg: "--color-tabs-active-bg",
    where: "the accent edge of the active nav pill (MenuLink border-accent)",
  },
  {
    fg: "--color-datepicker-clock-selected-bg",
    bg: "--color-datepicker-clock-face-bg",
    where: "the selected clock disc IS the state marker (OTime.vue SVG fill)",
  },
  {
    fg: "--color-datepicker-selected-fg",
    bg: "--color-datepicker-popup-bg",
    where: "the active step-dot pill and segment underline drawn with it (OTime.vue)",
  },
  // Icons carry a state, so they ride the 3:1 (SC 1.4.11) bar rather than the
  // text bar — measured here so a runtime ground can never move them silently.
  {
    fg: "--color-text-secondary",
    bg: "--color-select-item-selected-bg",
    where: "paywall/copy glyph inside a selected row (ONavGroup.vue, OrganizationSelector.vue)",
  },
  {
    fg: "--color-status-warning-text",
    bg: "--color-select-item-selected-bg",
    where: "lock glyph on a selected nav item (ONavGroup.vue)",
  },
  {
    fg: "--color-status-warning-text",
    bg: "--color-tabs-active-bg",
    where: "lock glyph on the active rail item (MenuLink.vue, OTab.vue)",
  },
  {
    fg: "--color-collapsible-open-accent",
    bg: "--color-collapsible-trigger-hover-bg",
    where: "the leading edge an open section paints (OCollapsible.vue)",
  },
  {
    fg: "--color-accent",
    bg: "--color-tabs-hover-bg",
    where:
      "hovered section-hub tile glyph and card chevrons (SectionHub.vue, QuickStartCard.vue, OverviewTab.vue)",
  },
  {
    fg: "--color-accent",
    bg: "--color-tabs-active-bg",
    where: "chevron over an active empty-state tile (EmptyStateActionCard.vue)",
  },
  {
    fg: "--color-accent",
    bg: "--color-badge-primary-soft-bg",
    where: "spinner inside the running-replay banner (BrowserJourney.vue)",
  },
];

const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3;

/**
 * The ONLY pairs the light matrix defers, each with its measured number. Not
 * name patterns — an exact pair list, pinned by the equality check below: a
 * pair that stops failing must be deleted from this ledger (or the debt it
 * describes is still open), and no unbooked pair may fail. The booked text
 * tiers (--color-text-label/-muted/-placeholder on light — grey-400/300
 * booked PENDING rows of contrast-manifest, "WCAG-AA colour remediation
 * (follow-up PR)") ride surfaces this wave did not re-ink; the numbers below
 * are the live measurements under the six injected light ramps.
 */
const LIGHT_PAIR_DEFERRALS: Record<string, string> = {
  "--color-text-label on --color-table-row-hover-bg":
    "grey-400: 2.29 on the runtime primary-50 wash, 2.52 on the page — booked light-pending text-label row in contrast-manifest",
  "--color-text-label on --color-table-row-selected-bg":
    "grey-400: 1.86 on the runtime primary-100 wash — same booked row",
  "--color-text-muted on --color-table-row-hover-bg":
    "grey-300: 1.35 on the runtime wash — booked light-pending text-muted row",
  "--color-text-muted on --color-table-row-selected-bg":
    "grey-300: 1.09 on the runtime wash — booked light-pending text-muted row",
  "--color-text-placeholder on --color-table-row-hover-bg":
    "grey-400: 2.29 on the runtime wash — booked light-pending text-placeholder row (the DATEPICKER placeholder role was fixed to grey-600; the global role still folds here)",
};

/**
 * The primary button label's booked residuals: every scope whose picked ink
 * cannot reach AA 4.5:1 in at least one state, pinned to its measured number
 * and the fill behind it. These pairs are NOT skipped by the floor test below
 * — they ride the documented 3:1 minimum — but they are shown here, equal-locked:
 * an improvement that would retire an entry, a worsening, and a new sub-AA scope
 * all fail the suite. The fix is out of this gate's hands: darker 600 steps for
 * these brand colors restore white at rest, and per-state ink flips were
 * rejected by design — both are the palette owner's call, not the picker's.
 */
const BUTTON_LABEL_RESIDUALS: Record<string, { at: number; note: string }> = {
  "dark O2 Horizon rest": {
    at: 3.25,
    note: "white on #588CF3: the light fill caps white at rest while the ramp's 800 step caps grey-900/black at active (2.42/2.83) — no single ink serves all three states — palette-decision: see PR decision record",
  },
  "dark O2 Lens rest": {
    at: 3.22,
    note: "white on #E56D17: same two-sided squeeze (grey-900 2.41 / black 2.83 on active #89410e) — palette-decision: see PR decision record",
  },
  "light O2 Lens rest": {
    at: 3.6,
    note: "white on #4682FA: grey-900 reaches rest (4.98) but fails hover/active (3.40/2.24), black fails 3.98/2.63 — palette-decision: see PR decision record",
  },
  "dark O2 Beacon active": {
    at: 3.55,
    note: "black on #426598: white caps at rest (2.42 < the 3:1 floor), grey-900 caps at active at 3.03; black before grey at the floor lifts the worst state to 3.55 — still under AA — palette-decision: see PR decision record",
  },
  "dark O2 Crimson Ink active": {
    at: 3.26,
    note: "black on #974450: white fails rest at 2.69 and grey-900 active at 2.78 — both under the 3:1 floor; black's active is the highest single-ink worst state this ramp allows — palette-decision: see PR decision record",
  },
};

const BUTTON_STATE_NAMES = ["rest", "hover", "active"] as const;

/**
 * The accent-as-text roles whose SHEET value is a primary-ramp step and
 * whose ground is a runtime accent tint. Each entry names the ground the consumer
 * really paints it on and the themes where the sheet step is under AA there:
 * the pick (`libraryForegroundTokens`) is only justified while those numbers
 * hold, so this ledger is bidirectional like the others — a theme that stops
 * failing must be deleted from `booked`, a new one must be added, and a role
 * whose sheet step no longer names a primary shade fails the lookup outright.
 */
const ACCENT_TINT_PICKS: {
  fg: string;
  host: string;
  where: string;
  booked: Record<string, string>;
}[] = [
  {
    fg: "--color-collapsible-icon-open",
    host: "--color-collapsible-trigger-hover-bg",
    where: "open section label + icons under the cursor (OCollapsible.vue)",
    booked: {
      "O2 Pulse": "3.97",
      "O2 Horizon": "4.17",
      "O2 Beacon": "4.16",
      "O2 Lens": "3.03",
      "O2 Crimson Ink": "3.71",
    },
  },
  {
    fg: "--color-icon-chip-primary-text",
    host: "--color-icon-chip-primary-bg",
    where: "primary icon chip glyph / step numbers (UsageTab.vue, HowItWorksDrawer.vue)",
    booked: { "O2 Lens": "3.41", "O2 Crimson Ink": "4.36" },
  },
  {
    fg: "--color-badge-primary-soft-text",
    host: "--color-badge-primary-soft-bg",
    where: "OBadge primary tone (utils/dbm/tones.ts, alert_calibration/format.ts)",
    booked: { "O2 Lens": "4.44" },
  },
  {
    fg: "--color-file-chip-text",
    host: "--color-file-chip-bg",
    where: "chosen-file chip name (OFile.vue)",
    booked: { "O2 Lens": "4.44" },
  },
  {
    fg: "--color-file-chip-remove",
    host: "--color-file-chip-bg",
    where: "remove affordance inside the same chip (OFile.vue)",
    booked: { "O2 Lens": "4.44" },
  },
  {
    fg: "--color-datepicker-day-range-text",
    host: "--color-datepicker-day-range-bg",
    where: "day inside the dragged range band (ODateRangeCalendar.vue)",
    booked: { "O2 Lens": "4.44" },
  },
  {
    fg: "--color-toggle-item-active-text",
    host: "--color-toggle-item-active-bg",
    where: "on-state item label (OToggleGroupItem.vue)",
    booked: { "O2 Lens": "4.44" },
  },
];

/** The ramp step a light-sheet role names for itself (`var(--color-primary-700)`). */
const sheetShade = (token: string): string => {
  const match = /--color-primary-(\d+)/.exec((SHEET_LIGHT.get(token) ?? "").trim());
  if (!match) throw new Error(`${token} is not an accent shade in the light sheet`);
  return match[1];
};

/**
 * Real pairs on a runtime ground that CANNOT be fixed without a palette-owner
 * decision, booked exactly like BUTTON_LABEL_RESIDUALS: the set of scopes below
 * AA and their measured numbers are equality-locked, and the gate still holds
 * the 3:1 floor on every one of them. `--color-text-link` itself is not here —
 * the reported failure was the ink on an accent GROUND, which is now carried by
 * the per-theme accent label; what remains open is the global light link tier
 * (3.60 on the plain page under O2 Lens), a palette question named in the
 * constants/themes.ts DECISION RECORD.
 */
const BOOKED_GROUND_PAIRS: { fg: string; bg: string; where: string }[] = [
  {
    fg: "--color-status-warning-text",
    bg: "--color-table-row-hover-bg",
    where: "routed warning cell on a hovered row (OverviewTab.vue)",
  },
  {
    // bg-theme-accent is the raw theme colour at alpha 1 (utils/theme.ts
    // hexToRgba(themeColor, 10)), i.e. the same painted pixel as --color-button-primary,
    // so this row also governs the accent-fill consumers named below.
    fg: "--color-button-primary-foreground",
    bg: "--color-theme-accent",
    where:
      "label/glyph of a control filled with the raw accent (O2AIConfirmDialog.vue focused branch, CorrelatedLogsTable.vue + SearchHistory.vue wrap toggles)",
  },
];

const RUNTIME_GROUND_RESIDUALS: Record<string, { at: number; note: string }> = {
  "light O2 Signature --color-status-warning-text on --color-table-row-hover-bg": {
    at: 4.1,
    note: "warning ink #be5a13 on the runtime primary-50 wash: the raw palette step it replaced measured 4.48 but 3.44 in dark, so the routed tier trades a dark AA miss for a light one — palette-decision: see PR decision record",
  },
  "light O2 Pulse --color-status-warning-text on --color-table-row-hover-bg": {
    at: 4.22,
    note: "same tier on the Pulse wash (#f5f8fa) — palette-decision: see PR decision record",
  },
  "light O2 Horizon --color-status-warning-text on --color-table-row-hover-bg": {
    at: 4.21,
    note: "same tier on the Horizon wash (#f3f8f9) — palette-decision: see PR decision record",
  },
  "light O2 Beacon --color-status-warning-text on --color-table-row-hover-bg": {
    at: 4.23,
    note: "same tier on the Beacon wash (#f5f8fd) — palette-decision: see PR decision record",
  },
  "light O2 Lens --color-status-warning-text on --color-table-row-hover-bg": {
    at: 4.27,
    note: "same tier on the Lens wash (#f6f9ff), the lightest of the six — palette-decision: see PR decision record",
  },
  "light O2 Crimson Ink --color-status-warning-text on --color-table-row-hover-bg": {
    at: 4.18,
    note: "same tier on the Crimson wash (#fef4f6); dark measures 10.40 on #1a1d21 — palette-decision: see PR decision record",
  },
  // The accent FILL ground. bg-theme-accent is the raw theme colour at alpha 1
  // in both modes, so the ink on it is the button label and the three failing scopes
  // are numerically the booked `rest` states of BUTTON_LABEL_RESIDUALS (same ink, same
  // painted pixel — the tripwire test below asserts the two grounds resolve identically).
  "dark O2 Horizon --color-button-primary-foreground on --color-theme-accent": {
    at: 3.25,
    note: "white on #588CF3 = --color-button-primary rest 3.25: the accent fill IS the ramp's 600 step, so no ink of this family reaches AA here (grey-900 5.52 on this ground alone, but it caps at 2.42 on the button's active step) — palette-decision: see PR decision record",
  },
  "dark O2 Lens --color-button-primary-foreground on --color-theme-accent": {
    at: 3.22,
    note: "white on #E56D17 = --color-button-primary rest 3.22: the same two-sided squeeze as the booked dark Lens rest row — palette-decision: see PR decision record",
  },
  "light O2 Lens --color-button-primary-foreground on --color-theme-accent": {
    at: 3.6,
    note: "white on #4682FA = --color-button-primary rest 3.60: grey-900 would read 4.98 on this fill but fails the button's hover/active states (3.40/2.24), and one label token cannot carry two inks — palette-decision: see PR decision record",
  },
};

const runtimeGroundFailures = (): Map<string, string> => {
  const failing = new Map<string, string>();
  for (const [mode, scopes] of [
    ["dark", RUNTIME_SCOPES],
    ["light", LIGHT_RUNTIME_SCOPES],
  ] as const) {
    for (const { name, scope } of scopes) {
      for (const pair of BOOKED_GROUND_PAIRS) {
        const value = ratio(pair.fg, pair.bg, scope);
        if (value < TEXT_MIN)
          failing.set(`${mode} ${name} ${pair.fg} on ${pair.bg}`, value.toFixed(2));
      }
    }
  }
  return failing;
};

const buttonLabelFailures = (): Map<string, string> => {
  const failing = new Map<string, string>();
  for (const [mode, scopes] of [
    ["dark", RUNTIME_SCOPES],
    ["light", LIGHT_RUNTIME_SCOPES],
  ] as const) {
    for (const { name, scope } of scopes) {
      for (const [state, bg] of [
        "--color-button-primary",
        "--color-button-primary-hover",
        "--color-button-primary-active",
      ].entries()) {
        const value = ratio("--color-button-primary-foreground", bg, scope);
        if (value < TEXT_MIN)
          failing.set(`${mode} ${name} ${BUTTON_STATE_NAMES[state]}`, value.toFixed(2));
      }
    }
  }
  return failing;
};

const pairKey = (pair: { fg: string; bg: string }): string => `${pair.fg} on ${pair.bg}`;

const failingLightPairs = (pairs: { fg: string; bg: string }[]): Set<string> =>
  new Set(
    pairs
      .filter((pair) =>
        LIGHT_RUNTIME_SCOPES.some((theme) => ratio(pair.fg, pair.bg, theme.scope) < TEXT_MIN),
      )
      .map(pairKey),
  );

/**
 * Tripwire: the state fills this file governs are BACKGROUNDS, and the
 * components were caught painting `--color-datepicker-day-selected-bg` (a fill)
 * through `text-`/`border-` utilities — 1.34:1 the moment the fill re-anchored
 * dark. Rather than transcribing pairs, this scans the actual consumer sources
 * and measures what they reference: no `text-`/`border-` utility may name a
 * `-bg` token, and every text utility the time-range controls paint must clear
 * 4.5:1 on the surface it is really drawn on — FILL_INK_ROLES maps the five
 * selected/focus glyph tokens onto their own runtime fill (measuring a
 * picked-on-white ink against the white popup would be vacuous, which is why
 * the first version of this scan wrongly skipped them by NAME); everything else
 * calendar popup (overlay tier) and the trigger/field (panel tier), plus
 * --color-surface-subtle for chains on the placeholder tier.
 * Nothing is skipped by name pattern. The only roles not measured are the
 * explicit CONSUMER_LEDGERS below — each an inactive (SC 1.4.3) or already
 * booked-pending role with its measured number — pinned by an equality
 * assertion: stale entries fail, and a new offender cannot hide.
 */
const CONSUMER_COMPONENTS: { file: string; path: string }[] = [
  { file: "OTime.vue", path: "../../forms/Time/OTime.vue" },
  { file: "ODateTimeRange.vue", path: "../../forms/DateTimeRange/ODateTimeRange.vue" },
  { file: "ODate.vue", path: "../../forms/Date/ODate.vue" },
  { file: "ODateRangeCalendar.vue", path: "../../forms/DateTimeRange/ODateRangeCalendar.vue" },
  { file: "OColor.vue", path: "../../forms/Color/OColor.vue" },
  { file: "OPagination.vue", path: "../../navigation/Pagination/OPagination.vue" },
];

const UTILITY_RE =
  /(?:^|[\s'"`])((?:[a-z-]+:)*)(text|border|fill|bg)-((?:datepicker|pagination|surface)-[a-z0-9-]+)(?=$|[\s'"`])/g;

const CONSUMER_UTILITIES = CONSUMER_COMPONENTS.map(({ file, path }) => {
  const source = readFileSync(join(here, path), "utf8");
  return {
    file,
    utilities: [...source.matchAll(UTILITY_RE)].map(([, state, prefix, name]) => ({
      state,
      prefix,
      token: `--color-${name}`,
    })),
  };
});

/** Scanned text utilities that are drawn on their own runtime fill, not on the
 *  popup/trigger hosts (the picker inks and their dark twins). */
const FILL_INK_ROLES: Record<string, string> = {
  "--color-datepicker-day-selected-text": "--color-datepicker-day-selected-bg",
  "--color-datepicker-segment-focus-text": "--color-datepicker-segment-focus-bg",
  "--color-datepicker-clock-selected-text": "--color-datepicker-clock-selected-bg",
  "--color-datepicker-relative-btn-selected-text": "--color-datepicker-relative-btn-selected-bg",
  "--color-pagination-item-active-text": "--color-pagination-item-active-bg",
};

const CONSUMER_LEDGERS: Record<"dark" | "light", Record<string, string>> = {
  dark: {
    "--color-datepicker-day-disabled-text":
      "SC 1.4.3 inactive day cells (data-disabled/unavailable render cursor:not-allowed / pointer-events:none): grey-600 measures 2.07 on the popup, 1.79–2.07 across hosts — the disabled step the manifest books as an exempt role",
  },
  light: {
    "--color-datepicker-day-disabled-text":
      "SC 1.4.3 inactive day cells: grey-400 measures 2.52 on both light hosts — same exempt disabled step as dark",
    "--color-datepicker-label":
      "folds to --color-text-label (grey-400, booked light-PENDING row of contrast-manifest): 2.52 on popup and trigger — the remediation PR owns the tier, not this gate",
  },
};

/**
 * The accent FILL ground, which the runtime ramp injection does not reach.
 * `bg-theme-accent` is neither a ramp tint nor a ladder wash: applyThemeColors writes
 * the raw theme colour into --color-theme-accent (hexToRgba(themeColor, 10) = alpha 1)
 * in BOTH modes, so the ground is theme-variant and no static ink survives it —
 * --color-text-inverse measures 3.73 (O2 Pulse dark) and 3.60 (O2 Lens light), and the
 * `text-white` variant these sites also carried drops to 1.25 under the shipped dark
 * default (#E6E6E6). Every enumerated label now binds either the picked accent-fill
 * label (--color-button-primary-foreground, booked below) or a per-theme accent pair
 * this file already gates; only the two brand heroes keep white labels, by design.
 */
const ACCENT_FILL_WHITE_BY_DESIGN: Record<string, string> = {
  "components/EnterpriseUpgradeDialog.vue":
    "the hero fill is a two-stop gradient (theme-accent → color-mix(theme-accent 85%, black)) and the panel hardcodes white on three nested elements plus rgba(255,255,255,.1-.2) plates that assume a dark ground: white caps at 1.25–3.60 at the light stop in 6 of 12 scopes, while the near-black inversion to 1.03–1.21 is O2 Signature light alone (its accent is #1C1F23; the five chromatic light ramps hold their dark inks at 2.74–4.43) — the fill (or a per-stop ink) is the owner's call, not a class swap — palette-decision: see web/src/constants/themes.ts DECISION RECORD",
  "views/EnterpriseFeatures.vue":
    "same two-stop hero gradient and white label as EnterpriseUpgradeDialog.vue — palette-decision: see PR decision record",
};

const SRC_ROOT = join(here, "../../..");

/** Every .vue file under dir (the census input). */
const walkFiles = (dir: string, ext: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, ext, found);
    else if (entry.name.endsWith(ext) && !entry.name.endsWith(".spec.ts")) found.push(path);
  }
  return found;
};

const walkVue = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkVue(path, found);
    else if (entry.name.endsWith(".vue")) found.push(path);
  }
  return found;
};

const CLS_ATTR_RE = /(?::?class)\s*=\s*"([^"]*)"/g;
const SOLID_ACCENT_RE = /(?<![\w-])bg-theme-accent!?(?![\w/-])/;
const GRADIENT_ACCENT_RE = /(?<![\w-])bg-\[[^\]]*--color-theme-accent[^\]]*\]/;
const INK_UTILITY_RE = /(?<![\w-])((?:[\w-]+:)*text-([a-z0-9-]+))(?:\/\d+)?!?(?![\w-])/g;

/** `text-<name>` utilities whose name is an actual colour token (text-sm, text-bold
 *  and friends resolve to nothing in the token sheets and are skipped). */
const inkTokensIn = (value: string): string[] =>
  [...new Set([...value.matchAll(INK_UTILITY_RE)].map((ink) => `--color-${ink[2]}`))].filter(
    (token) =>
      resolveColor(token, SHEET_LIGHT) !== null || resolveColor(token, SHEET_DARK) !== null,
  );

type AccentFillSite = {
  file: string;
  line: number;
  ground: "solid" | "gradient";
  inks: string[];
};

/** Every class binding that paints a label on the raw theme accent, read from source. */
const accentFillSites = (): AccentFillSite[] =>
  walkVue(SRC_ROOT).flatMap((path) => {
    const source = readFileSync(path, "utf8");
    const file = path.slice(SRC_ROOT.length + 1);
    return [...source.matchAll(CLS_ATTR_RE)].flatMap((match) => {
      const value = (match[1] ?? "").replace(/\s+/g, " ");
      const solid = SOLID_ACCENT_RE.test(value);
      const gradient = GRADIENT_ACCENT_RE.test(value);
      if (!solid && !gradient) return [];
      const inks = inkTokensIn(value);
      if (inks.length === 0) return [];
      const line = source.slice(0, match.index ?? 0).split("\n").length;
      return [{ file, line, ground: solid ? ("solid" as const) : ("gradient" as const), inks }];
    });
  });

describe("runtime theme contrast (the seam contrast.spec cannot see)", () => {
  it("measures at least the shipped default theme plus its five siblings, both modes", () => {
    // Guard against the matrix silently passing over an empty theme registry.
    expect(RUNTIME_SCOPES.length).toBe(PREDEFINED_THEMES.length);
    expect(RUNTIME_SCOPES.length).toBeGreaterThanOrEqual(6);
    expect(LIGHT_RUNTIME_SCOPES.length).toBe(PREDEFINED_THEMES.length);
    // The Crimson Ink semantics overlay must ride the scopes, or the
    // status pairs below re-join the sheet-fiction this file exists to kill.
    const crimson = LIGHT_RUNTIME_SCOPES.find((theme) => theme.name.includes("Crimson"))!;
    expect(hexOf("--color-status-negative", crimson.scope).toLowerCase()).toBe("#f97316");
    expect(hexOf("--color-status-success-text", crimson.scope).toLowerCase()).toBe("#3730a3");
  });

  it("keeps the grey-text-bearing state surfaces theme-invariant literals", () => {
    // The seam proper: every surface listed here resolves to the SAME hex under
    // the bare sheet and under every theme's injected ramp. Route one back
    // through --color-primary-* (e.g. --d-hover: var(--color-primary-900)) and
    // the value moves with themeColor — this fails, loudly, naming the token.
    const offenders: string[] = [];
    for (const surface of THEME_INVARIANT_SURFACES) {
      const seen = new Map<string, string[]>();
      const sheet = hexOf(surface, SHEET_DARK);
      for (const theme of RUNTIME_SCOPES) {
        const value = hexOf(surface, theme.scope);
        if (!seen.has(value)) seen.set(value, []);
        seen.get(value)!.push(theme.name);
      }
      if (seen.size !== 1 || !seen.has(sheet)) {
        offenders.push(
          `${surface}: sheet=${sheet} ${[...seen]
            .map(([hex, names]) => `${hex} (${names.join(", ")})`)
            .join(" ")}`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the dark state washes monotonic within the neutral ladder", () => {
    // Order: base < hover < selected < well < overlay < accent-hover <
    // accent-active. The steps that CARRY a state (canvas→hover, hover→
    // selected, overlay→wash, wash→active) must land inside the 1.04–1.20
    // visibility band the static tier steps live in (1.045–1.152) — subtle,
    // never a bright slab. selected→well and well→overlay only order; they are
    // different roles' surfaces, not a designed step pair.
    const l = (name: string) => relativeLuminance(resolveColor(name, SHEET_DARK)!);
    const ladder = [
      "--color-surface-base",
      "--d-hover",
      "--d-selected",
      "--color-surface-subtle",
      "--color-surface-overlay",
      "--color-surface-accent-hover",
      "--color-surface-accent-active",
    ].map(l);
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i], `ladder position ${i} must sit above ${i - 1}`).toBeGreaterThan(
        ladder[i - 1],
      );
    }
    const step = (upper: number, lower: number) => (upper + 0.05) / (lower + 0.05);
    const signalSteps: [string, number][] = [
      ["base → hover", step(ladder[1], ladder[0])],
      ["hover → selected", step(ladder[2], ladder[1])],
      ["overlay → accent-hover", step(ladder[5], ladder[4])],
      ["accent-hover → accent-active", step(ladder[6], ladder[5])],
    ];
    for (const [name, value] of signalSteps) {
      expect(
        value,
        `${name} step ${value.toFixed(3)} outside the 1.04–1.20 band`,
      ).toBeGreaterThanOrEqual(1.04);
      expect(
        value,
        `${name} step ${value.toFixed(3)} outside the 1.04–1.20 band`,
      ).toBeLessThanOrEqual(1.2);
    }
  });

  it("defers exactly the booked light-debt pairs, nothing more", () => {
    // Bidirectional lock on the deferral ledger: every deferral must describe
    // a pair that genuinely fails under some light ramp (a fixed debt must
    // delete its entry), and no failing pair may be absent from the ledger
    // (a new offender cannot hide).
    const failing = failingLightPairs(TEXT_PAIRS);
    const deferred = new Set(Object.keys(LIGHT_PAIR_DEFERRALS));
    expect([...failing].sort()).toEqual([...deferred].sort());
  });

  it("keeps the accent-active heading re-ink on a measured reason, both modes", () => {
    // The active chat row (HomeChatHistory.vue) and the applied insight chip
    // (DbmInsightStrip.vue) bind the heading tier on --color-surface-accent-active
    // because the secondary tier cannot clear AA on its dark host. Bidirectional
    // like the other ledgers: move the secondary tier above the bar and this goes
    // red, and the re-ink plus its TEXT_PAIRS bookings must be revisited.
    const dark = [
      ...new Set(
        RUNTIME_SCOPES.map(({ scope }) =>
          ratio("--color-text-secondary", "--color-surface-accent-active", scope).toFixed(2),
        ),
      ),
    ];
    expect(dark, "the dark host is the theme-invariant #39404a under every ramp").toEqual(["4.15"]);
    const light = LIGHT_RUNTIME_SCOPES.map(({ scope }) =>
      ratio("--color-text-secondary", "--color-surface-accent-active", scope),
    );
    expect(
      Math.min(...light),
      "the light twin (grey-600 on primary-100, 5.76) was never the defect",
    ).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  describe.each<[string, Map<string, string>]>([
    ...RUNTIME_SCOPES.map(({ name, themeColor, scope }): [string, Map<string, string>] => [
      `dark ${name} (${themeColor})`,
      scope,
    ]),
    ...LIGHT_RUNTIME_SCOPES.map(({ name, themeColor, scope }): [string, Map<string, string>] => [
      `light ${name} (${themeColor})`,
      scope,
    ]),
  ])("%s ramp injected", (label, scope) => {
    const light = label.startsWith("light");
    it("clears 4.5:1 on every enumerated text pair painted on a state surface", () => {
      const offenders = TEXT_PAIRS.filter(
        (pair) => !(light && pairKey(pair) in LIGHT_PAIR_DEFERRALS),
      )
        .map((pair) => {
          const value = ratio(pair.fg, pair.bg, scope as Map<string, string>);
          return { ...pair, value };
        })
        .filter((pair) => pair.value < TEXT_MIN)
        .map((pair) => `${pair.fg} on ${pair.bg} (${pair.where}): ${pair.value.toFixed(2)}:1`);
      expect(offenders).toEqual([]);
    });

    it("clears 3:1 on the state edges that carry a control boundary", () => {
      const offenders = NON_TEXT_PAIRS.map((pair) => {
        const value = ratio(pair.fg, pair.bg, scope as Map<string, string>);
        return { ...pair, value };
      })
        .filter((pair) => pair.value < NON_TEXT_MIN)
        .map((pair) => `${pair.fg} on ${pair.bg} (${pair.where}): ${pair.value.toFixed(2)}:1`);
      expect(offenders).toEqual([]);
    });
  });

  it("keeps the primary button label on its documented floor across all three fills", () => {
    // OButton's primary variant paints ONE label token over rest/hover/active
    // (primary-600/700/800 of the injected ramp). pickButtonForeground must
    // survive the worst of the three states — checking the resting shade alone
    // shipped a 2.78:1 pressed label under O2 Crimson Ink dark. The
    // floor is the 3:1 compromise documented on that function (white on a
    // saturated brand color at rest: O2 Lens light lands at 3.60); after the
    // worst-of-states pick the measured minimum across the twelve scopes is
    // 3.22 (dark O2 Lens rest, white). Nine scopes keep white, Signature dark
    // keeps grey-900 (5.19), and black carries the two mid-tone pastels
    // (Beacon dark 3.55, Crimson dark 3.26) — every sub-AA state is booked,
    // number-locked and SHOWN by the ledger test below.
    const states = [
      "--color-button-primary",
      "--color-button-primary-hover",
      "--color-button-primary-active",
    ];
    const offenders: string[] = [];
    for (const [mode, scopes] of [
      ["dark", RUNTIME_SCOPES],
      ["light", LIGHT_RUNTIME_SCOPES],
    ] as const) {
      for (const { name, scope } of scopes) {
        for (const bg of states) {
          const value = ratio("--color-button-primary-foreground", bg, scope);
          if (value < NON_TEXT_MIN) {
            offenders.push(`${mode} ${name} on ${bg}: ${value.toFixed(2)}:1`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("books every sub-AA button-label state pair at its measured number (palette-decision ledger)", () => {
    // Bidirectional lock, same shape as the light deferral and consumer ledgers:
    // the set of scopes below AA 4.5 must equal the booked set, and every booked
    // number must still measure exactly as written. Nothing here exempts a pair
    // from the 3:1 floor test above — this ledger SHOWS the accepted residuals.
    const failing = buttonLabelFailures();
    expect([...failing.keys()].sort()).toEqual(Object.keys(BUTTON_LABEL_RESIDUALS).sort());
    for (const [key, measured] of failing) {
      const booking = BUTTON_LABEL_RESIDUALS[key];
      expect(
        measured,
        `${key} measures ${measured}:1, booked at ${booking.at.toFixed(2)}:1 — ${booking.note}`,
      ).toBe(booking.at.toFixed(2));
    }
  });

  it("picks every accent ink that paints on a runtime accent tint, for the booked reason only", () => {
    // Two directions: the injected ink must clear AA on the ground the consumer
    // really paints it on (all twelve scopes), AND the sheet shade the role names
    // must still be the failure that justifies the pick — the booked set and each
    // of its numbers are equality-locked, so a tier that heals must shed its entry.
    for (const pick of ACCENT_TINT_PICKS) {
      const shade = sheetShade(pick.fg);
      const offenders: string[] = [];
      const booked = new Map<string, string>();
      for (const [mode, scopes] of [
        ["dark", RUNTIME_SCOPES],
        ["light", LIGHT_RUNTIME_SCOPES],
      ] as const) {
        for (const { name, scope, themeColor } of scopes) {
          const injected = ratio(pick.fg, pick.host, scope);
          if (injected < TEXT_MIN) {
            offenders.push(
              `${mode} ${name}: ${pick.fg} = ${hexOf(pick.fg, scope)} on ${hexOf(pick.host, scope)} = ${injected.toFixed(2)}:1`,
            );
          }
          if (mode !== "light") continue;
          // The value the sheet would paint without libraryForegroundTokens.
          const sheetInk = generatePrimaryPalette(themeColor)[shade];
          const unpicked = ratio(sheetInk, pick.host, scope);
          if (unpicked < TEXT_MIN) booked.set(name, unpicked.toFixed(2));
        }
      }
      expect(offenders, `${pick.fg} on ${pick.host} (${pick.where})`).toEqual([]);
      expect(
        Object.fromEntries(booked),
        `${pick.fg} sheet shade primary-${shade} on ${pick.host} (${pick.where})`,
      ).toEqual(pick.booked);
    }
  });

  it("books every sub-AA runtime-ground pair at its measured number (palette-decision ledger)", () => {
    // Same shape as the button-label ledger: an improvement that retires an entry,
    // a worsening, and a new sub-AA scope all fail here. Nothing booked is exempt
    // from the 3:1 floor either — the pairs below ride the TEXT_PAIRS bar only
    // because this ledger is what makes the shortfall explicit.
    const failing = runtimeGroundFailures();
    expect([...failing.keys()].sort()).toEqual(Object.keys(RUNTIME_GROUND_RESIDUALS).sort());
    for (const [key, measured] of failing) {
      const booking = RUNTIME_GROUND_RESIDUALS[key];
      expect(
        measured,
        `${key} measures ${measured}:1, booked at ${booking.at.toFixed(2)}:1 — ${booking.note}`,
      ).toBe(booking.at.toFixed(2));
    }
    for (const booking of Object.values(RUNTIME_GROUND_RESIDUALS)) {
      expect(booking.note, "a booked runtime-ground pair has no palette-decision marker").toContain(
        "palette-decision",
      );
    }
    // The sweep above runs at the text bar; the 3:1 floor underneath it is asserted
    // here, so no booked pair — the accent fill's glyph labels included — can sink.
    const underFloor: string[] = [];
    for (const [mode, scopes] of [
      ["dark", RUNTIME_SCOPES],
      ["light", LIGHT_RUNTIME_SCOPES],
    ] as const) {
      for (const { name, scope } of scopes) {
        for (const pair of BOOKED_GROUND_PAIRS) {
          const value = ratio(pair.fg, pair.bg, scope);
          if (value < NON_TEXT_MIN) {
            underFloor.push(`${mode} ${name} ${pair.fg} on ${pair.bg}: ${value.toFixed(2)}:1`);
          }
        }
      }
    }
    expect(underFloor).toEqual([]);
  });

  // ── The accent FILL ground (bg-theme-accent), which the ramp injection
  // above does not reach because it is written straight into --color-theme-accent.
  it("measures the raw accent fill as the primary button's rest state, both modes", () => {
    const offenders: string[] = [];
    for (const [mode, scopes] of [
      ["dark", RUNTIME_SCOPES],
      ["light", LIGHT_RUNTIME_SCOPES],
    ] as const) {
      for (const { name, themeColor, scope } of scopes) {
        const accent = hexOf("--color-theme-accent", scope);
        // applyThemeColors paints hexToRgba(themeColor, 10) → the raw theme colour,
        // which is what utils/theme.ts anchors --color-primary-600 (and therefore
        // --color-button-primary) to. Re-point the fill at another step, or stop
        // painting the theme colour into it, and this names the scope.
        if (accent !== themeColor.toLowerCase()) {
          offenders.push(
            `${mode} ${name}: accent fill ${accent} ≠ themeColor ${themeColor.toLowerCase()}`,
          );
        }
        if (hexOf("--color-button-primary", scope) !== accent) {
          offenders.push(`${mode} ${name}: --color-button-primary is not the accent fill`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("locks the static inks that moved off the accent fill at their measured failures", () => {
    // Bidirectional like ACCENT_TINT_PICKS: the picked label must clear the floor in
    // every scope, and the inks the enumerated sites used to carry must STILL be the
    // failures that justify the move — a healed palette sheds its numbers here.
    for (const [mode, scopes] of [
      ["dark", RUNTIME_SCOPES],
      ["light", LIGHT_RUNTIME_SCOPES],
    ] as const) {
      for (const { name, scope } of scopes) {
        const picked = ratio("--color-button-primary-foreground", "--color-theme-accent", scope);
        if (picked < NON_TEXT_MIN) {
          throw new Error(
            `${mode} ${name}: picked accent-fill label measures ${picked.toFixed(2)}:1`,
          );
        }
      }
    }
    const textInverse: Record<string, string> = {};
    const white: Record<string, string> = {};
    for (const [mode, scopes] of [
      ["dark", RUNTIME_SCOPES],
      ["light", LIGHT_RUNTIME_SCOPES],
    ] as const) {
      for (const { name, scope } of scopes) {
        const inverse = ratio("--color-text-inverse", "--color-theme-accent", scope);
        if (inverse < TEXT_MIN) textInverse[`${mode} ${name}`] = inverse.toFixed(2);
        const plain = ratio("#FFFFFF", "--color-theme-accent", scope);
        if (plain < TEXT_MIN) white[`${mode} ${name}`] = plain.toFixed(2);
      }
    }
    expect(textInverse).toEqual({ "dark O2 Pulse": "3.73", "light O2 Lens": "3.60" });
    expect(white).toEqual({
      "dark O2 Signature": "1.25",
      "dark O2 Beacon": "2.42",
      "dark O2 Crimson Ink": "2.69",
      "dark O2 Horizon": "3.25",
      "dark O2 Lens": "3.22",
      "light O2 Lens": "3.60",
    });
  });

  it("measures every template label painted on the raw accent fill, both modes", () => {
    const sites = accentFillSites();
    // Anti-vacuity, and this time on the SHAPE of the matrix, not its size. The old
    // `>= 7` was satisfiable by any 7 matches, so a scan that had silently lost every
    // solid accent-filled label and kept the two gradient heroes plus five unrelated
    // tints still passed. Three floors that a degenerate matrix cannot clear:
    //   1. both ground families are still found (5 solid + 2 gradient at this head),
    //   2. every foreground the LEDGER books on this ground is still seen by the scan,
    //      so the ledger cannot drift into booking pairs nothing renders,
    //   3. the count itself.
    expect(sites.length, `only ${sites.length} accent-fill labels scanned`).toBeGreaterThanOrEqual(
      7,
    );
    const solidSites = sites.filter((site) => site.ground === "solid");
    const gradientSites = sites.filter((site) => site.ground === "gradient");
    expect(solidSites.length, "no solid bg-theme-accent label scanned").toBeGreaterThanOrEqual(5);
    expect(gradientSites.length, "no gradient accent hero scanned").toBeGreaterThanOrEqual(2);
    const booked = new Set(
      BOOKED_GROUND_PAIRS.filter((pair) => pair.bg === "--color-theme-accent").map((p) => p.fg),
    );
    const scannedInks = new Set(sites.flatMap((site) => site.inks));
    for (const token of booked) {
      expect(
        scannedInks.has(token),
        `the ledger books ${token} on the accent fill but the scan no longer finds it`,
      ).toBe(true);
    }
    expect(booked.size).toBeGreaterThanOrEqual(1);
    expect(scannedInks.size).toBeGreaterThanOrEqual(booked.size);
    const offenders: string[] = [];
    for (const site of sites) {
      // The two gradient heroes are the only exemption, and only because their fill has
      // two stops that sit on opposite sides of any single ink (see the ledger notes).
      // Every other accent label — solid fill or gradient — is measured at the accent's
      // light stop, which is the worst of the two for a light ink.
      if (site.ground === "gradient" && site.file in ACCENT_FILL_WHITE_BY_DESIGN) continue;
      for (const [mode, scopes] of [
        ["dark", RUNTIME_SCOPES],
        ["light", LIGHT_RUNTIME_SCOPES],
      ] as const) {
        for (const { name, scope } of scopes) {
          for (const token of site.inks) {
            const bar = booked.has(token) ? NON_TEXT_MIN : TEXT_MIN;
            const value = ratio(token, "--color-theme-accent", scope);
            if (value < bar) {
              offenders.push(
                `${site.file}:${site.line} ${token} = ${value.toFixed(2)}:1 on the accent fill (${mode} ${name})`,
              );
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
    const unbooked = sites
      .filter((site) => site.ground === "solid")
      .flatMap((site) => site.inks)
      .filter((token) => !booked.has(token));
    expect(
      [...new Set(unbooked)],
      "a solid accent fill carries an ink the booked ledger does not name",
    ).toEqual([]);
    const misplaced = Object.keys(ACCENT_FILL_WHITE_BY_DESIGN).filter(
      (file) => !sites.some((site) => site.file === file && site.ground === "gradient"),
    );
    expect(misplaced, "a white-by-design entry no longer paints a gradient accent").toEqual([]);
    const stale = Object.keys(ACCENT_FILL_WHITE_BY_DESIGN).filter(
      (file) => !sites.some((site) => site.file === file),
    );
    expect(stale, "the accent-fill white-by-design ledger has a dead entry").toEqual([]);
  });

  it("measures the live-captured row-wash and ink regressions at their fixed values (O2 Signature)", () => {
    // Browser capture of the shipped themes: secondary/label on the row washes were 2.24–2.65,
    // white-on-active 3.25–3.45, the checked tick 1.20. Pinned as floors here.
    const signature = RUNTIME_SCOPES.find((theme) => theme.name === "O2 Signature")!;
    const floor = (fg: string, bg: string) => ratio(fg, bg, signature.scope);
    expect(floor("--color-text-secondary", "--color-table-row-hover-bg")).toBeGreaterThanOrEqual(
      TEXT_MIN,
    );
    expect(floor("--color-text-label", "--color-table-row-hover-bg")).toBeGreaterThanOrEqual(
      TEXT_MIN,
    );
    expect(floor("--color-text-label", "--color-table-row-selected-bg")).toBeGreaterThanOrEqual(
      TEXT_MIN,
    );
    expect(floor("--color-tabs-active-text", "--color-tabs-active-bg")).toBeGreaterThanOrEqual(
      TEXT_MIN,
    );
    expect(
      floor("--color-select-item-selected-text", "--color-select-item-selected-bg"),
    ).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(
      floor("--color-checkbox-checked-fg", "--color-checkbox-checked-bg"),
    ).toBeGreaterThanOrEqual(TEXT_MIN);
    // The mid-grey the injected ramp used to paint through, now unreachable.
    expect(hexOf("--d-hover", signature.scope)).not.toBe("#5c5c5c");
    expect(hexOf("--color-surface-accent-active", signature.scope)).not.toBe("#8a8a8a");
  });

  it("keeps the light selected fills off the white-on-themeColor failure (O2 Lens)", () => {
    // White on O2 Lens light primary-600 is 3.60:1. The
    // picker must flip the ink for exactly the themes where white cannot clear
    // AA — every other light theme keeps white (the shipped look).
    const lens = LIGHT_RUNTIME_SCOPES.find((theme) => theme.name === "O2 Lens")!;
    const pulse = LIGHT_RUNTIME_SCOPES.find((theme) => theme.name === "O2 Pulse")!;
    const pairs = [
      ["--color-datepicker-day-selected-text", "--color-datepicker-day-selected-bg"],
      ["--color-datepicker-segment-focus-text", "--color-datepicker-segment-focus-bg"],
      ["--color-datepicker-clock-selected-text", "--color-datepicker-clock-selected-bg"],
      [
        "--color-datepicker-relative-btn-selected-text",
        "--color-datepicker-relative-btn-selected-bg",
      ],
      ["--color-pagination-item-active-text", "--color-pagination-item-active-bg"],
      ["--color-checkbox-checked-fg", "--color-checkbox-checked-bg"],
    ];
    for (const [fg, bg] of pairs) {
      expect(ratio(fg, bg, lens.scope), `lens ${fg}`).toBeGreaterThanOrEqual(TEXT_MIN);
      expect(hexOf(fg, lens.scope), `lens ${fg} must not stay white`).not.toBe("#ffffff");
      expect(hexOf(fg, pulse.scope), `pulse ${fg} keeps white`).toBe("#ffffff");
    }
  });

  it("never paints a governed fill token as component foreground", () => {
    const offenders = CONSUMER_UTILITIES.flatMap(({ file, utilities }) =>
      utilities
        .filter(
          ({ prefix, token }) =>
            (prefix === "text" || prefix === "border") && token.endsWith("-bg"),
        )
        .map(
          ({ state, prefix, token }) =>
            `${file}: ${state}${prefix}-${token.slice("--color-".length)} — a -bg fill painted as a foreground`,
        ),
    );
    expect(offenders).toEqual([]);
  });

  it("clears 4.5:1 on every text utility the time-range controls paint, both modes", () => {
    const offenders: string[] = [];
    const failing: Record<"dark" | "light", Set<string>> = {
      dark: new Set(),
      light: new Set(),
    };
    for (const file of [
      "OTime.vue",
      "ODateTimeRange.vue",
      "ODate.vue",
      "ODateRangeCalendar.vue",
      "OColor.vue",
    ]) {
      const { utilities } = CONSUMER_UTILITIES.find((entry) => entry.file === file)!;
      const seen = new Set<string>();
      for (const { prefix, token } of utilities) {
        if (prefix !== "text" || seen.has(token)) continue;
        seen.add(token);
        const hosts = FILL_INK_ROLES[token]
          ? [FILL_INK_ROLES[token]]
          : ["--color-datepicker-popup-bg", "--color-datepicker-bg"];
        for (const [mode, scopes] of [
          ["dark", RUNTIME_SCOPES],
          ["light", LIGHT_RUNTIME_SCOPES],
        ] as const) {
          for (const theme of scopes) {
            const scope = theme.scope as Map<string, string>;
            const extraHosts =
              mode === "light" &&
              aliasChain(token, SHEET_LIGHT).includes("--color-datepicker-placeholder")
                ? ["--color-surface-subtle"] // the worst light panel the placeholder tier lands on (7.17)
                : [];
            for (const bg of [...hosts, ...extraHosts]) {
              const value = ratio(token, bg, scope);
              if (value < TEXT_MIN) {
                failing[mode].add(token);
                if (!CONSUMER_LEDGERS[mode][token]) {
                  offenders.push(
                    `${file}: ${token} on ${bg} = ${value.toFixed(2)}:1 (${mode} ${theme.name})`,
                  );
                }
              }
            }
          }
        }
      }
      // Anti-vacuity: a moved/renamed class vocabulary must not silent-pass the scan.
      expect(seen.size, `${file} parsed only ${seen.size} text utilities`).toBeGreaterThan(4);
    }
    // Bidirectional lock on the consumer ledgers: stale entries (roles fixed
    // since) and unbooked offenders both fail.
    for (const mode of ["dark", "light"] as const) {
      expect(
        [...failing[mode]].sort(),
        `${mode} consumer ledger is stale: ledger=[${Object.keys(CONSUMER_LEDGERS[mode]).join(", ")}]`,
      ).toEqual([...Object.keys(CONSUMER_LEDGERS[mode])].sort());
    }
    expect(offenders).toEqual([]);
  });

  // ── The TEMPLATE census (F-142/F-143/F-145): the SAME scan and pixel model the CLI gate runs.
  // scripts/check-runtime-contrast.mjs measures these numbers from the command line and prints
  // tallies; this file is the enforcer that refuses a booking whose numbers moved, a booked site
  // that stopped existing, an unexplained dynamic class binding, or a new unbooked failure. The
  // booking file is shared, so the two gates cannot describe different realities.
  const censusSources = () => [
    ...walkVue(SRC_ROOT).map((path) => ({
      path: path
        .slice(SRC_ROOT.length + 1)
        .split("\\")
        .join("/"),
      source: readFileSync(path, "utf8"),
    })),
    ...walkFiles(SRC_ROOT, ".ts").map((path) => ({
      path: path
        .slice(SRC_ROOT.length + 1)
        .split("\\")
        .join("/"),
      source: readFileSync(path, "utf8"),
    })),
  ];

  it("measures the whole template census in the shared model, with nothing unexplained", () => {
    const ledger = JSON.parse(readFileSync(join(here, "runtime-contrast-ledger.json"), "utf8"));
    const report = runRuntimeCensus(RUNTIME, ledger, censusSources());
    // Anti-vacuity: the scan must really have enumerated the app, not silently found nothing.
    expect(report.files).toBeGreaterThan(1000);
    expect(report.pairs).toBeGreaterThan(1000);
    expect(report.measuredPass).toBeGreaterThan(500);
    expect(report.unbooked, "a new sub-AA runtime pair appeared").toBe(ledger.maxUnbooked);
    expect(report.dynamicCount).toBe(ledger.maxDynamic);
    expect(report.driftRows, "a booked pair no longer measures what the ledger says").toEqual([]);
    expect(
      report.staleRows.map((row) => row.id),
      "a booking names a site that is gone",
    ).toEqual([]);
    expect(
      report.staleDelegations.map((row) => row.id),
      "a delegation matches no measured pair any more",
    ).toEqual([]);
    // Every unattributed runtime class literal is equality-locked by count above; the residue is
    // driven to zero (and each remaining binding individually justified in ledger.dynamicBindings)
    // as the census bookings land, at which point this list is the assertion.
    expect(
      ledger.maxDynamic === 0
        ? report.unbookedDynamic.map((row) => row.file + ":" + row.literal)
        : [],
      "a runtime class literal in script paints a colour no measured pair cites",
    ).toEqual([]);
    expect(report.exitCode).toBe(0);
  });

  it("keeps every booked census pair justified, and every non-text booking an actual glyph", () => {
    const ledger = JSON.parse(readFileSync(join(here, "runtime-contrast-ledger.json"), "utf8"));
    const report = runRuntimeCensus(RUNTIME, ledger, censusSources());
    const byId = new Map(report.rows.map((row) => [row.id, row]));
    for (const booking of ledger.bookings) {
      const row = byId.get(booking.id);
      expect(
        row,
        "the ledger books a pair the scanner no longer sees: " + booking.id,
      ).toBeDefined();
      expect(booking.reason ?? "", "a booked pair has no reason: " + booking.id).toContain(
        "palette-decision",
      );
      expect(
        Object.keys(booking.at).length,
        "a booking must state all twelve scopes: " + booking.id,
      ).toBe(12);
      if (row!.pair.bar === "non-text") {
        expect(booking.kind, "an icon-only booking must say so: " + booking.id).toBe("non-text");
      }
    }
  });
});

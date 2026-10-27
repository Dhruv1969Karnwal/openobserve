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
 * pairs against what the browser would actually paint. Four invariants, one
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
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PREDEFINED_THEMES } from "@/constants/themes";
import { generatePrimaryPalette, libraryForegroundTokens } from "@/utils/theme";

import { contrastRatio, relativeLuminance, resolveColor, resolveTokens } from "./colorMath";

const here = dirname(fileURLToPath(import.meta.url));

/** Same cascade as contrast.spec.ts — the dark scope was the seam; so was the light one. */
const TOKEN_FILES = ["base.css", "semantic.css", "component.css", "dark.css"];
const SHEETS = TOKEN_FILES.map((file) => readFileSync(join(here, file), "utf8"));
const SHEET_DARK = resolveTokens(SHEETS).dark;
const SHEET_LIGHT = resolveTokens(SHEETS).light;

const PALETTE_SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

/** The `semanticColors` overlay, keyed as applyThemeColors() writes it. */
const SEMANTIC_TOKEN_MAP: Record<string, string> = {
  error: "--color-status-negative",
  errorText: "--color-status-error-text",
  errorBg: "--color-status-error-bg",
  success: "--color-status-positive",
  successText: "--color-status-success-text",
  successBg: "--color-status-success-bg",
  secondaryBtnBg: "--color-button-secondary",
  secondaryBtnText: "--color-button-secondary-foreground",
  secondaryBtnBorder: "--color-button-secondary-border",
  outlineText: "--color-button-outline-text",
  outlineBorder: "--color-button-outline-border",
  ghostText: "--color-button-ghost-text",
};

const runtimeScope = (
  sheet: Map<string, string>,
  mode: "light" | "dark",
  themeColor: string,
  semanticColors?: Record<string, string>,
): Map<string, string> => {
  const scope = new Map(sheet);
  const palette = generatePrimaryPalette(themeColor);
  for (const shade of PALETTE_SHADES) {
    scope.set(`--color-primary-${shade}`, palette[shade]);
  }
  // The gate measures production's own injected map, not a transcription of it.
  for (const [token, hex] of Object.entries(libraryForegroundTokens(mode, palette))) {
    scope.set(token, hex);
  }
  for (const [key, hex] of Object.entries(semanticColors ?? {})) {
    const token = SEMANTIC_TOKEN_MAP[key];
    if (token) scope.set(token, hex);
  }
  return scope;
};

/** One entry per predefined theme: the dark scope, injected as syncO2LibraryTokens writes it. */
const RUNTIME_SCOPES = PREDEFINED_THEMES.map((theme) => ({
  name: String(theme.name),
  themeColor: theme.dark.themeColor,
  scope: runtimeScope(
    SHEET_DARK,
    "dark",
    theme.dark.themeColor,
    theme.dark.semanticColors as unknown as Record<string, string> | undefined,
  ),
}));

/** The LIGHT mirror: the light sheet under each theme's light ramp. */
const LIGHT_RUNTIME_SCOPES = PREDEFINED_THEMES.map((theme) => ({
  name: String(theme.name),
  themeColor: theme.light.themeColor,
  scope: runtimeScope(
    SHEET_LIGHT,
    "light",
    theme.light.themeColor,
    theme.light.semanticColors as unknown as Record<string, string> | undefined,
  ),
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

const ratio = (fg: string, bg: string, scope: Map<string, string>): number => {
  const fgColor = resolveColor(fg, scope);
  const bgColor = resolveColor(bg, scope);
  if (!fgColor || !bgColor) throw new Error(`unresolved pair ${fg} on ${bg}`);
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
    where: "the highlighted option in an open list",
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

  describe.each<[string, Map<string, string>]>([
    ...RUNTIME_SCOPES.map(
      ({ name, themeColor, scope }): [string, Map<string, string>] => [
        `dark ${name} (${themeColor})`,
        scope,
      ],
    ),
    ...LIGHT_RUNTIME_SCOPES.map(
      ({ name, themeColor, scope }): [string, Map<string, string>] => [
        `light ${name} (${themeColor})`,
        scope,
      ],
    ),
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
});

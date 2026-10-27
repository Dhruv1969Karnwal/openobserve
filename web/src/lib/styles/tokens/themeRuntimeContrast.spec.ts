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
 * result over the parsed dark sheet the same way `syncO2LibraryTokens` does, and
 * measures the same fg×bg pairs against what the browser would actually paint.
 * Two invariants, one matrix, and one consumer scan (F-107: a fill token used
 * as component text — measured from the components' own class bindings):
 *
 *  1. THEME-INVARIANT WASHES. The state surfaces that carry grey-tier text are
 *     ladder literals in dark.css — the same hex under every theme's injected
 *     ramp and the bare sheet. If anyone re-points one at `--color-primary-*`,
 *     the resolved value moves per theme and this test goes red — which is the
 *     bidirectional tripwire, not a formality.
 *  2. LADDER ORDER. hover steps off the canvas below the panel elevation step,
 *     selected sits above hover and below the well, the accent wash/active sit
 *     above the overlay tier in order — subtle, monotonic, never bright.
 *  3. THE PAIR MATRIX. Every text role an enumerated consumer paints on these
 *     surfaces clears 4.5:1 under every injected ramp (the reviewer-cited pairs
 *     plus the ones found by grepping `hover:bg-*`/selected-state consumers);
 *     edges that carry a control state clear 3:1.
 *
 * Light is deliberately out of scope: the finding measured dark (the light ramp
 * mixes the other way and its washes are near-white on near-white by intent),
 * and light text-on-wash pairs stay judged by contrast.spec's sheet.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PREDEFINED_THEMES } from "@/constants/themes";
import { generatePrimaryPalette } from "@/utils/theme";

import { contrastRatio, relativeLuminance, resolveColor, resolveTokens } from "./colorMath";

const here = dirname(fileURLToPath(import.meta.url));

/** Same cascade as contrast.spec.ts — the dark scope is the one with the seam. */
const TOKEN_FILES = ["base.css", "semantic.css", "component.css", "dark.css"];
const SHEETS = TOKEN_FILES.map((file) => readFileSync(join(here, file), "utf8"));
const SHEET_DARK = resolveTokens(SHEETS).dark;

const PALETTE_SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

/**
 * One entry per predefined theme: the dark scope with that theme's runtime ramp
 * injected exactly as syncO2LibraryTokens() writes it (`--color-primary-<shade>`
 * on the root element, overriding the sheet).
 */
const RUNTIME_SCOPES = PREDEFINED_THEMES.map((theme) => {
  const scope = new Map(SHEET_DARK);
  const palette = generatePrimaryPalette(theme.dark.themeColor);
  for (const shade of PALETTE_SHADES) {
    scope.set(`--color-primary-${shade}`, palette[shade]);
  }
  return { name: String(theme.name), themeColor: theme.dark.themeColor, scope };
});

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
 * The measured matrix. Every entry names the consumer that paints the pair —
 * text roles are what ACTUALLY lands on the surface, per grep of the class
 * bindings (tables: OTableBodyCell.vue default `text-text-body` + per-cell
 * roles; menus: component.css dropdown/select item text; active pills:
 * MenuLink/ONavbar `text-tabs-active-text`, OSelect
 * `select-item-selected-text`, fills consumed via *-hover-bg/*-active-bg).
 */
const TEXT_PAIRS: { fg: string; bg: string; where: string }[] = [
  // Row washes (OTableBodyCell.vue:462/511, AutoObserveActivityTab.vue:121,
  // DiscoveredServices.vue:209, UsageTrends.vue:748, Quota.vue:176).
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
    where: "secondary button label while hovered",
  },
  {
    fg: "--color-button-outline-text",
    bg: "--color-button-outline-hover-bg",
    where: "outline button label",
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
    fg: "--color-tabs-active-text",
    bg: "--color-tabs-active-bg",
    where: "active nav pill (MenuLink/ONavbar)",
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
    where: "page number under the cursor (F-94 pair, dark side)",
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
  // F-107: the selected/tab ink the time-range controls actually paint, and
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
 * F-107 tripwire: the state fills this file governs are BACKGROUNDS, and the
 * components were caught painting `--color-datepicker-day-selected-bg` (a fill)
 * through `text-`/`border-` utilities — 1.34:1 the moment the fill re-anchored
 * dark. Rather than transcribing pairs, this scans the actual consumer sources
 * and measures what they reference: no `text-`/`border-` utility may name a
 * `-bg` token, and every text utility the time-range controls paint must clear
 * 4.5:1 on the calendar popup — the brightest surface in those files, so the
 * darker panel/base follow. Reverting a component class or re-darkening the
 * fg token turns this red on its own.
 * `disabled` / `outside` roles are exempt by name (WCAG 1.4.3 excludes inactive
 * text). `placeholder` is exempt as a RECORDED pre-existing debt, not a pass:
 * `--color-datepicker-placeholder` folds to the disabled step in dark and is
 * filed as a new observation in fixer-notes-14, deliberately not widened here.
 */
const CONSUMER_COMPONENTS: { file: string; path: string }[] = [
  { file: "OTime.vue", path: "../../forms/Time/OTime.vue" },
  { file: "ODateTimeRange.vue", path: "../../forms/DateTimeRange/ODateTimeRange.vue" },
  { file: "ODate.vue", path: "../../forms/Date/ODate.vue" },
  { file: "ODateRangeCalendar.vue", path: "../../forms/DateTimeRange/ODateRangeCalendar.vue" },
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

describe("runtime theme contrast (the seam contrast.spec cannot see)", () => {
  it("measures at least the shipped default theme plus its five siblings", () => {
    // Guard against the matrix silently passing over an empty theme registry.
    expect(RUNTIME_SCOPES.length).toBe(PREDEFINED_THEMES.length);
    expect(RUNTIME_SCOPES.length).toBeGreaterThanOrEqual(6);
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

  describe.each(
    RUNTIME_SCOPES.map(({ name, themeColor, scope }) => [`${name} (${themeColor})`, scope]),
  )("%s dark ramp injected", (_label, scope) => {
    it("clears 4.5:1 on every enumerated text pair painted on a state surface", () => {
      const offenders = TEXT_PAIRS.map((pair) => {
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

  it("measures the reviewer-cited regressions at their fixed values (O2 Signature)", () => {
    // F-A11Y-01 live capture: secondary/label on the row washes were 2.24–2.65,
    // white-on-active 3.25–3.45. Pinned here as the floor, to the sheet truth.
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
    // The mid-grey the injected ramp used to paint through, now unreachable.
    expect(hexOf("--d-hover", signature.scope)).not.toBe("#5c5c5c");
    expect(hexOf("--color-surface-accent-active", signature.scope)).not.toBe("#8a8a8a");
  });

  it("never paints a governed fill token as component foreground (F-107)", () => {
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

  it("clears 4.5:1 on every text utility the time-range controls paint", () => {
    const offenders: string[] = [];
    for (const file of ["OTime.vue", "ODateTimeRange.vue"]) {
      const { utilities } = CONSUMER_UTILITIES.find((entry) => entry.file === file)!;
      const seen = new Set<string>();
      for (const { prefix, token } of utilities) {
        if (prefix !== "text" || seen.has(token)) continue;
        seen.add(token);
        if (/disabled|outside|placeholder/.test(token)) continue; // see the F-107 note
        for (const theme of RUNTIME_SCOPES) {
          const value = ratio(
            token,
            "--color-datepicker-popup-bg",
            theme.scope as Map<string, string>,
          );
          if (value < TEXT_MIN) {
            offenders.push(`${file}: ${token} on popup = ${value.toFixed(2)}:1 (${theme.name})`);
          }
        }
      }
      // Anti-vacuity: a moved/renamed class vocabulary must not silent-pass the scan.
      expect(seen.size, `${file} parsed only ${seen.size} text utilities`).toBeGreaterThan(4);
    }
    expect(offenders).toEqual([]);
  });
});

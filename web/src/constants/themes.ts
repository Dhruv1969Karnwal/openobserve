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

import { PREDEFINED_THEME_COLORS } from "@/constants/themeRegistry";
import { raw } from "@/types/i18n";
import type { PredefinedThemeColors } from "@/constants/themeRegistry";
import type { SemanticColors } from "@/utils/theme";

/**
 * Theme registry — single source of truth for predefined themes.
 *
 * Theme SELECTION is persisted by NAME (not by color), so when a theme's
 * color codes change in a future release, every user who selected that theme
 * by name automatically picks up the new colors on next load.
 *
 * - Predefined theme  → persisted by `name` (e.g. "O2 Signature").
 * - Custom theme      → persisted by `CUSTOM_THEME_NAME` + the chosen hex color.
 * - Default/fallback  → resolves to `DEFAULT_THEME_NAME` ("O2 Signature") by name,
 *                       so editing O2 Signature's colors also changes the default.
 */

export type { PredefinedThemeColors, ThemeModeColors } from "@/constants/themeRegistry";

/** A predefined theme: registry colours plus the i18n-wrapped display name. */
export interface PredefinedTheme extends PredefinedThemeColors {}

/** Marker stored in `appliedXThemeName` when the user picked a custom color. */
export const CUSTOM_THEME_NAME = "__custom__";

/** The theme used as the default/fallback when nothing else is selected. */
export const DEFAULT_THEME_NAME = "O2 Signature";

/** localStorage keys, grouped per mode. */
export const THEME_STORAGE_KEYS = {
  light: {
    appliedName: "appliedLightThemeName",
    color: "customLightColor",
    semantic: "lightSemanticColors",
    legacyApplied: "appliedLightTheme",
  },
  dark: {
    appliedName: "appliedDarkThemeName",
    color: "customDarkColor",
    semantic: "darkSemanticColors",
    legacyApplied: "appliedDarkTheme",
  },
} as const;

/**
 * ── DECISION RECORD: single-ink button labels vs the 4.5:1 AA bar ──
 * OButton's default md label is `text-sm font-medium` = 14px normal-weight
 * text — below WCAG's large-text cut-offs (≥24px, or ≥18.66px bold) — so SC
 * 1.4.3 demands 4.5:1 in every state the one label token rides (primary-600/
 * 700/800 of the injected ramp). For these predefined palettes a single ink
 * provably cannot deliver that. Two-sided constraint, dark O2 Horizon as the
 * worked example (600 #588CF3, L 0.273; 800 #355492, L 0.092): a light ink on
 * the rest fill is capped by white itself at 3.25, and clearing AA there
 * needs L ≤ 0.022 — a dark ink — which on the active step tops out at black's
 * (0.092+0.05)/0.05 = 2.83. Both luminance directions fail at opposite ends
 * of the ramp, so no ink works; the full 12-scope table is in
 * utils/theme.ts's picker, the five residual pairs are booked number-locked in
 * tokens/themeRuntimeContrast.spec.ts (BUTTON_LABEL_RESIDUALS).
 * Flagship defaults are clean in ALL states: light #1C1F23 16.54/17.65/18.62,
 * dark #E6E6E6 (grey-900 ink) 14.36/9.04/5.19. The residual worst-of-states
 * floor ships documented at 3.22–3.60 on predefined themes (3.07 for legacy
 * stored custom pastels, e.g. #8B8DF0), gated at ≥3.00. Closing the gap needs
 * a brand/palette-owner decision — darker saturated 600 steps (Horizon dark,
 * both Lens) or a formal deviation record; per-state ink flips were rejected
 * by design. This is an OPEN DECISION SURFACE, not hidden debt.
 *
 * ── LINK / ACCENT-ON-TINT RESIDUALS ──
 * The same two-sided problem exists one tier lighter: an accent shade used AS
 * TEXT on the runtime accent tints. `--color-text-link` (light = themeColor,
 * dark = primary-400) measured 3.03:1 on `--color-surface-accent-active` under
 * O2 Lens light and 3.77:1 under O2 Pulse dark; the primary-ramp label roles
 * that fold onto the same steps (open-collapsible ink, primary icon chips, the
 * primary soft badge, file chips, the range-band day, the on-state toggle) sat
 * at 4.44:1 under O2 Lens light. Those pairs are FIXED by the machinery, not by
 * a palette move: utils/theme.ts re-picks each ink against the tint it actually
 * paints on and tokens/themeRuntimeContrast.spec.ts locks the pick twice over —
 * AA under all twelve scopes, plus the sheet shade that justifies the pick
 * (ACCENT_TINT_PICKS). What is BOOKED, number-locked and still open: the routed
 * `--color-status-warning-text` tier on the runtime row wash (4.10–4.27 in the
 * six light ramps, 10.40 in dark) — darkening the warning ink is a decision for
 * every warning label in the product, not for this gate — and the global link
 * tier itself, which remains the themeColor on the PLAIN page. Measured by the template
 * census (tokens/runtime-contrast-ledger.json, twelve scopes, every booking number-locked):
 * --color-text-link on the page tint runs 3.41 (O2 Lens light) to 4.40, on the plain plate
 * 3.60 (O2 Lens light), and accent-as-text on the same grounds 3.41–4.35. A global link move
 * repaints every `<a>` in the app, so the accent-ground consumers were routed to the picked
 * accent label instead and the page tier stays the palette owner's call.
 *
 * ── THE MEASURED SURFACE (what this record may claim) ──
 * Every figure quoted in this file is generated by the template census, not remembered: run
 * `node scripts/check-runtime-contrast.mjs --list` (web/) to re-derive it and see
 * tokens/runtime-contrast-ledger.json for the bookings. That script scans all 1517 components,
 * builds the (ground, ink) pair each element really paints — including ink on a descendant, ink
 * inherited from an ancestor or falling back to --color-text-body, `/NN` alpha fills, gradient
 * stops, classes read from <script>, scoped-style paint, and element-opacity composite states —
 * and measures it across the same twelve injected scopes this file's pickers run against.
 *
 * At this head: 5137 runtime pairs in 2462 booking groups — 1876 groups measured-pass, 586 groups
 * (997 individual sites) booked with all twelve numbers each, of which 164 groups are delegated to
 * the tier rows tokens/contrast-manifest.ts already books as pending, 82 are icon-only sites riding
 * SC 1.4.11's 3:1 bar with a per-entry justification, and 340 are text riding 4.5. 41 script/style
 * class literals are registered as runtime grounds with no co-bound label. MAX-UNBOOKED = 0 and
 * MAX-DYNAMIC = 0, both equality locks: the residue growing OR healing without the lock moving is
 * a build failure.
 *
 * Honest limits of that claim, all restated in the ledger's reason fields: the census models class
 * bindings, not content conditionals, so 7 booked rows (the checkbox tick, the selected datepicker
 * day and weekday, the active page number) describe a pair that does not co-occur on screen — the
 * guard renders the ink only while a different fill token paints, and those fills are gated at
 * 4.7+ by tokens/themeRuntimeContrast.spec.ts. Translucent grounds are composited over the plate
 * the ledger names (--color-surface-base by default), which is the page plate, not necessarily the
 * card a component actually sits on. Cascade inheritance is walked one level for page-default text.
 *
 * What this record may NO LONGER claim: that any pair "clears" a bar in all twelve scopes merely
 * because its resting state does. Element opacity (opacity-NN / hover:opacity-NN) fades ink AND
 * ground toward the plate behind the control, so a booked number for the rest state says nothing
 * about the shipped hover state; that is the specific defect F-142 found at the wrap toggles below,
 * and every element-opacity state the census can still find (69 booking groups over 154 sites, from
 * a 30 % disabled glyph to the 1.03:1 active pagination number) is now booked BY NUMBER instead.
 *
 * ── THE ACCENT FILL ITSELF ──
 * One tier heavier sits the raw brand fill: applyThemeColors paints
 * `--color-theme-accent` with the theme colour at alpha 1 in BOTH modes, so
 * `bg-theme-accent` is the same pixel as the ramp's 600 step (asserted) and every
 * label on it rides the button ground with none of the button's ink. A static ink
 * cannot hold that ground: `--color-text-inverse` measures 3.73:1 (O2 Pulse dark)
 * and 3.60:1 (O2 Lens light), and the plain-white variant the toggle buttons carried
 * falls to 1.25:1 on the shipped dark default #E6E6E6 — an invisible glyph. No site of
 * the enumerated seven keeps a static ink: the four real-text ones (AI integration
 * initials, the field-count pill, the selected chart-type row) moved onto the accent
 * TINT pairs the picker already re-inks per theme (4.50–15.04 across the twelve
 * scopes), and the five filled-control ones bind the picked
 * `--color-button-primary-foreground`, whose three sub-AA scopes are the booked
 * `rest` states above — two of them are the confirm dialog's own branch. The three wrap toggles
 * that remain are glyph-sized, so SC 1.4.11's 3:1 bar is the one they ride, and their RESTING state
 * does clear it in all twelve scopes (3.22–3.60). That is deliberately NOT a claim about the shipped
 * control: two of them also carried `hover:opacity-85`/`-80`, and element opacity fades ink AND
 * ground toward the plate behind the button, which dropped the same label to 2.73–2.99:1 — below the
 * 3.00 floor the booking promised to hold; the opacity treatment was removed at both sites.
 * Two options were measured and rejected: routing every accent-fill label through the worst-of-states
 * button pick alone would have dropped the dark Horizon/Lens labels from 5.52/5.58 to
 * 3.25/3.22, and an AA-everywhere single ink (white-if-AA else readable, 4.70 worst)
 * needs a label token computed in both modes — the existing selected-fill picks are
 * light-only because their dark grounds are ladder literals. That token is a second
 * answer to "what ink goes on the brand fill" and moves the pinned sheet counts, so
 * it is the palette owner's call, not a micro-fix's. Still white-by-design: the two
 * enterprise hero panels, whose fill is a gradient whose stops sit on opposite sides
 * of any one ink. Measured per scope (white on stop 0, then the dark inks on stop 1 =
 * color-mix(accent 85%, black)): white caps at 1.25–3.60 in six of the twelve scopes
 * (Signature dark 1.25, Beacon dark 2.42, Crimson dark 2.69, Lens dark 3.22, Horizon dark
 * 3.25, Lens light 3.60) and clears AA in the other six (Pulse 4.80 both modes, Crimson
 * light 4.70, Beacon light 5.08, Horizon light 5.12, Signature light 16.54).
 * The near-black half of the squeeze is NOT a six-theme range — it is O2 Signature
 * light, whose accent (#1C1F23) is itself near-black: grey-900 measures 1.08 at stop 0
 * and 1.03 at stop 1 there, black 1.27/1.21. On the five chromatic light ramps the same
 * inks sit 2.74–3.78 (grey-900) and 3.20–4.43 (black), i.e. comfortably above the white
 * figure. The conclusion is unchanged — no single static ink holds 4.5 across both stops
 * in all twelve scopes — but it holds for the shipped default because of its near-black
 * accent, and for the other eleven because white cannot carry the dark scopes' stops.
 * Both panels also hardcode white on three nested elements plus translucent-white plates,
 * which assume a dark ground — that is a repaint decision, booked in the same ledger.
 */
/** Predefined themes with both light and dark mode colors, names wrapped for i18n. */
export const PREDEFINED_THEMES: PredefinedTheme[] = PREDEFINED_THEME_COLORS.map((theme) => ({
  ...theme,
  name: raw(theme.name),
}));

/** A light/dark background pair an announcement banner can be painted with. */
export interface BannerColorPreset {
  key: string;
  light: string;
  dark: string;
}

/** Stored as the resolved hex pair, so a banner keeps its colours if a preset changes. */
export const BANNER_COLOR_PRESETS: BannerColorPreset[] = [
  { key: "blue", light: "#DBEAFE", dark: "#1E3A8A" },
  { key: "indigo", light: "#E0E7FF", dark: "#312E81" },
  { key: "teal", light: "#CCFBF1", dark: "#134E4A" },
  { key: "green", light: "#DCFCE7", dark: "#14532D" },
  { key: "amber", light: "#FEF3C7", dark: "#78350F" },
  { key: "red", light: "#FEE2E2", dark: "#7F1D1D" },
  { key: "purple", light: "#F3E8FF", dark: "#581C87" },
  { key: "slate", light: "#1E293B", dark: "#E2E8F0" },
  { key: "brand", light: "#2563EB", dark: "#3B82F6" },
];

/** Find a predefined theme by its stable name. */
export const getThemeByName = (name: string | null | undefined): PredefinedTheme | undefined =>
  name ? PREDEFINED_THEMES.find((t) => t.name === name) : undefined;

/** Find a predefined theme by its legacy numeric id. */
export const getThemeById = (id: number | null | undefined): PredefinedTheme | undefined =>
  id == null ? undefined : PREDEFINED_THEMES.find((t) => t.id === id);

/** The default/fallback theme (O2 Signature), with a safe fallback to the first theme. */
export const getDefaultTheme = (): PredefinedTheme =>
  getThemeByName(DEFAULT_THEME_NAME) ?? PREDEFINED_THEMES[0];

/** Slugify a theme name into kebab-case for data-test attributes ("O2 Pulse" -> "o2-pulse"). */
export const themeNameSlug = (name: string): string => name.toLowerCase().replace(/\s+/g, "-");

/**
 * User-facing label for a theme. The stored `name` is the persisted selection key
 * and must never change; the "O2 " prefix is dropped for display, and the
 * signature theme is remapped below to carry this product's name instead.
 */
// Stored names stay historical so saved preferences keep resolving; only the display name carries the product.
export const THEME_DISPLAY_NAMES: Record<string, string> = {
  [DEFAULT_THEME_NAME]: "Retrace Signature",
};

export const themeDisplayName = (name: string): string =>
  THEME_DISPLAY_NAMES[name] ?? (name === DEFAULT_THEME_NAME ? name : name.replace(/^O2\s+/, ""));

export type ThemeSource = "preview" | "predefined" | "custom" | "default";

export interface ResolveThemeInput {
  mode: "light" | "dark";
  /** Live preview color from Vuex `tempThemeColors[mode]` (highest priority). */
  tempColor?: string | null;
  /** Persisted selection: a predefined theme name or `CUSTOM_THEME_NAME`. */
  appliedThemeName?: string | null;
  /** Persisted hex color (source of truth for custom; render-cache for predefined). */
  customColor?: string | null;
  /** Persisted semantic colors for a custom theme, if any. */
  customSemanticColors?: SemanticColors | null;
}

export interface ResolvedTheme {
  themeColor: string;
  semanticColors?: SemanticColors;
  /**
   * Always false: we always apply real colors (the default is O2 Signature's
   * colors), so the inline primary palette is always synced rather than cleared.
   */
  isDefault: boolean;
  source: ThemeSource;
}

/**
 * Resolve the effective theme colors for a mode, by priority:
 *   1. Live preview (tempColor)
 *   2. Selected predefined theme — resolved by NAME from the registry
 *   3. Selected custom theme — the persisted hex color
 *   4. Default theme (O2 Signature) — resolved by NAME from the registry
 *
 * The named default is authoritative: when no theme is explicitly selected it
 * always wins, so changing the default theme's colors in the registry takes
 * effect immediately. (Org-level theme colors are not part of this resolution.)
 */
export const resolveThemeForMode = (input: ResolveThemeInput): ResolvedTheme => {
  const mode = input.mode;

  // 1. Live preview from General Settings color picker
  if (input.tempColor) {
    return { themeColor: input.tempColor, isDefault: false, source: "preview" };
  }

  const name = input.appliedThemeName;

  // 2. Predefined theme selected by name — always read the CURRENT registry color
  if (name && name !== CUSTOM_THEME_NAME) {
    const theme = getThemeByName(name);
    if (theme) {
      const m = theme[mode];
      return {
        themeColor: m.themeColor,
        semanticColors: m.semanticColors,
        isDefault: false,
        source: "predefined",
      };
    }
    // Unknown name (theme removed in a release) → fall through to default.
  }

  // 3. Custom theme — use the persisted hex color
  if (name === CUSTOM_THEME_NAME && input.customColor) {
    return {
      themeColor: input.customColor,
      semanticColors: input.customSemanticColors ?? undefined,
      isDefault: false,
      source: "custom",
    };
  }

  // 4. Default theme (O2 Signature), resolved by name
  const def = getDefaultTheme();
  const m = def[mode];
  return {
    themeColor: m.themeColor,
    semanticColors: m.semanticColors,
    isDefault: false,
    source: "default",
  };
};

/**
 * One-time migration of the legacy id-based selection to the name-based model.
 *   - legacy `appliedLightTheme` / `appliedDarkTheme` held a numeric id, or "-1" for custom.
 *   - new `appliedLightThemeName` / `appliedDarkThemeName` hold a theme name or CUSTOM_THEME_NAME.
 * Safe to call repeatedly; it only acts when a legacy key is present and the new key is absent.
 */
export const migrateLegacyThemeStorage = (storage: Storage = localStorage): void => {
  (["light", "dark"] as const).forEach((mode) => {
    const keys = THEME_STORAGE_KEYS[mode];
    const legacy = storage.getItem(keys.legacyApplied);
    if (legacy === null) return;

    // Only set the new key if it hasn't been written already.
    if (storage.getItem(keys.appliedName) === null) {
      if (legacy === "-1") {
        storage.setItem(keys.appliedName, CUSTOM_THEME_NAME);
      } else {
        const theme = getThemeById(parseInt(legacy, 10));
        if (theme) storage.setItem(keys.appliedName, theme.name);
      }
    }

    storage.removeItem(keys.legacyApplied);
  });
};

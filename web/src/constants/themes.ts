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

import { raw } from "@/types/i18n";
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

export interface ThemeModeColors {
  // Hex color used for buttons/toggles/borders and to derive the primary palette
  themeColor: string;
  // Optional multi-color semantic palette (errors/success/secondary button, etc.)
  semanticColors?: SemanticColors;
}

export interface PredefinedTheme {
  // Stable numeric id — kept only for legacy localStorage migration.
  id: number;
  // Stable display name — this is the persisted key for theme selection.
  name: string;
  light: ThemeModeColors;
  dark: ThemeModeColors;
}

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
 * ── DECISION RECORD: single-ink button labels vs the 4.5:1 AA bar (F-118) ──
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
 * ── LINK / ACCENT-ON-TINT RESIDUALS (F-133) ──
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
 * tier itself, which remains the themeColor on the PLAIN page (3.03–4.50 on the
 * six light page grounds): a global link move repaints every `<a>` in the app,
 * so the accent-ground consumers were routed to the picked accent label instead
 * and the page tier stays the palette owner's call.
 */
/** Predefined themes with both light and dark mode colors. */
export const PREDEFINED_THEMES: PredefinedTheme[] = [
  {
    id: 10,
    name: raw("O2 Signature"),
    light: {
      themeColor: "#1C1F23",
    },
    dark: {
      themeColor: "#E6E6E6",
    },
  },
  {
    id: 2,
    name: raw("O2 Pulse"),
    light: {
      themeColor: "#3F7994",
    },
    dark: {
      themeColor: "#3F7994",
    },
  },
  {
    id: 4,
    name: raw("O2 Horizon"),
    light: {
      themeColor: "#077A7F",
    },
    dark: {
      themeColor: "#588CF3",
    },
  },
  {
    id: 5,
    name: raw("O2 Beacon"),
    light: {
      themeColor: "#3369D6",
    },
    dark: {
      themeColor: "#6EA8FE",
    },
  },
  {
    id: 8,
    name: raw("O2 Lens"),
    light: {
      themeColor: "#4682FA",
    },
    dark: {
      themeColor: "#E56D17",
    },
  },
  {
    id: 14,
    name: raw("O2 Crimson Ink"),
    light: {
      themeColor: "#E11D48",
      semanticColors: {
        error: "#F97316",
        errorBg: "#FFF7ED",
        errorText: "#C2410C",
        success: "#6366F1",
        successBg: "#EEF2FF",
        successText: "#3730A3",
        secondaryBtnBg: "#FFE4E6",
        secondaryBtnText: "#BE123C",
        secondaryBtnBorder: "#FECDD3",
        outlineText: "#BE123C",
        outlineBorder: "#FECDD3",
        ghostText: "#BE123C",
      },
    },
    dark: {
      themeColor: "#FB7185",
      semanticColors: {
        error: "#FB923C",
        errorBg: "#3A1A08",
        errorText: "#FB923C",
        success: "#818CF8",
        successBg: "#1E1B4B",
        successText: "#A5B4FC",
        secondaryBtnBg: "#3D0617",
        secondaryBtnText: "#FECDD3",
        secondaryBtnBorder: "#9F1239",
        outlineText: "#FECDD3",
        outlineBorder: "#9F1239",
        ghostText: "#FECDD3",
      },
    },
  },
];

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

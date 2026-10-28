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
 * The PURE half of the runtime theme machinery: every colour the theme system
 * injects at runtime, computed from `themeColor` alone. Zero imports, so both
 * consumers can share one source: `utils/theme.ts` writes these values into the
 * DOM, and `scripts/check-runtime-contrast.mjs` + `tokens/themeRuntimeContrast.spec.ts`
 * measure the twelve injected scopes against them. A transcription of this map
 * anywhere else is the exact drift this file exists to prevent.
 */

export type ThemeMode = "light" | "dark";

/**
 * Resolve a design-token CSS custom property to its concrete value at runtime.
 *
 * Charts (ECharts options, SVG data-URI symbols, canvas) can't use CSS `var()` —
 * they need a literal color string. This reads the token from the document root
 * so the single source of truth stays the token layer (`lib/styles/tokens/*`),
 * not a hardcoded hex. `fallback` is returned when the token is unset or the DOM
 * is unavailable (SSR / unit tests), so callers still get a sensible value.
 *
 * @param token   - Token name, with or without the leading `--` (e.g. "--color-indigo-500")
 * @param fallback - Value to use if the token can't be read
 */
export const cssToken = (token: string, fallback: string): string => {
  if (typeof document === "undefined" || !document.documentElement) {
    return fallback;
  }
  const name = token.startsWith("--") ? token : `--${token}`;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

/**
 * Helper function to convert hex color to rgba
 * @param hex - Hex color code (e.g., "#3F7994")
 * @param opacity - Opacity value (1-10 scale, where 10 = fully opaque)
 * @returns RGBA color string
 */
export const hexToRgba = (hex: string, opacity: number): string => {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const alpha = opacity / 10; // Convert 1-10 scale to 0.1-1.0
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * WCAG relative luminance of a hex color (sRGB, gamma-corrected).
 */
const relativeLuminance = (hex: string): number => {
  hex = hex.replace("#", "");
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.substring(0, 2), 16));
  const g = channel(parseInt(hex.substring(2, 4), 16));
  const b = channel(parseInt(hex.substring(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio (1–21) between two hex colors. */
const contrastRatio = (hexA: string, hexB: string): number => {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/**
 * Pick label text for a button whose background is theme-color derived, across
 * ALL fills the single label token rides: rest (600), hover (700), active (800).
 * Predefined dark-mode theme colors are deliberately light/pastel — which can
 * drop hardcoded white well below readable — e.g. a light pastel accent like
 * #8B8DF0 with white text lands at 2.93:1. The floor is 3:1, not the strict
 * 4.5:1 AA bar: every saturated brand color (O2 Lens light #4682FA at 3.60:1)
 * already ships with white just under it, and the bar move would flip text
 * across the app for a fractional shortfall. What is NOT a compromise: the
 * chosen ink must survive the darkest state too — checking the resting shade
 * alone shipped a 2.78:1 pressed label under O2 Crimson Ink dark.
 * Pure black joins the candidates because mid-tone brand fills (Crimson's
 * pressed #974450) leave neither white nor grey-900 at 3:1. When no ink can
 * reach AA, black is weighed before grey-900 so the honest worst state is the
 * highest one available (Beacon dark active: black 3.55 vs grey-900 3.03);
 * grey-900 keeps the label whenever it itself carries AA (Signature dark:
 * worst state 5.19), because near-black stays the house ink by preference.
 * The residual sub-AA pairs this leaves are booked with equality locks in
 * tokens/themeRuntimeContrast.spec.ts and documented in constants/themes.ts.
 */
const pickButtonForeground = (palette: Record<string, string>): string => {
  const darkText = cssToken("--color-grey-900", "#171717");
  const states = ["600", "700", "800"].map((shade) => palette[shade]);
  const worstState = (ink: string) => Math.min(...states.map((bg) => contrastRatio(ink, bg)));
  if (worstState("#FFFFFF") >= 3) return "#FFFFFF";
  const grey = worstState(darkText);
  if (grey >= 4.5) return darkText;
  return worstState("#000000") >= grey ? "#000000" : darkText;
};

/** First primary-ramp shade (walking 600→900, so the brand color keeps its
 *  lightest legible voice) that clears AA text on an explicit host. Accent
 *  used AS TEXT on the theme's own tints cannot ride the raw ramp: the light
 *  active-tab ink on its primary-100 pill measured 3.03:1 under O2 Lens. */
const pickReadableShade = (
  palette: Record<string, string>,
  hostHex: string,
  start = "600",
): string => {
  const darkText = cssToken("--color-grey-900", "#171717");
  const shades = ["600", "700", "800", "900"];
  const firstPassing = shades
    .slice(shades.indexOf(start))
    .find((shade) => contrastRatio(palette[shade], hostHex) >= 4.5);
  return firstPassing ? palette[firstPassing] : darkText;
};

/** Text for an arbitrary user-chosen background, always at least WCAG AA (4.5:1). */
export const pickReadableForeground = (bgHex: string): string => {
  const darkText = cssToken("--color-grey-900", "#171717");
  const white = "#FFFFFF";
  const best = contrastRatio(white, bgHex) >= contrastRatio(darkText, bgHex) ? white : darkText;
  // On mid-tones (luminance about 0.15-0.26) neither reaches 4.5, but pure black always does.
  return contrastRatio(best, bgHex) >= 4.5 ? best : "#000000";
};

/** White stays on a selected fill whenever it already clears AA; the fill only
 *  flips ink when it cannot (white on O2 Lens light is 3.60:1). */
const pickSelectedFillForeground = (bgHex: string): string =>
  contrastRatio("#FFFFFF", bgHex) >= 4.5 ? "#FFFFFF" : pickReadableForeground(bgHex);

/** Accent shades used AS TEXT on a runtime accent tint, whose sheet step
 *  (700) sinks under AA on the tint for some themes (4.44:1 O2 Lens light)
 *  and so is re-picked per theme. Dark pins these roles in dark.css instead. */
const ACCENT_SOFT_INK_TOKENS = [
  "--color-badge-primary-soft-text",
  "--color-file-chip-text",
  "--color-file-chip-remove",
  "--color-datepicker-day-range-text",
  "--color-toggle-item-active-text",
];

/** Light fills whose ink must be picked from the injected ramp. Dark
 *  pins the same roles to ladder literals with white ink instead (dark.css). */
const SELECTED_FILL_INK_TOKENS = [
  "--color-datepicker-day-selected-text",
  "--color-datepicker-segment-focus-text",
  "--color-datepicker-clock-selected-text",
  "--color-datepicker-relative-btn-selected-text",
  "--color-pagination-item-active-text",
];

/**
 * Inks the runtime injects alongside the primary ramp, computed against the
 * ramp the page will actually paint (the token sheets cannot know it). Pure so
 * tokens/themeRuntimeContrast.spec.ts measures production's exact answers.
 */
export const libraryForegroundTokens = (
  mode: ThemeMode,
  palette: Record<string, string>,
): Record<string, string> => {
  // The dark checkbox fill rides primary-500 (dark.css), the light fill primary-600.
  const checkboxFill = mode === "dark" ? palette["500"] : palette["600"];
  const tokens: Record<string, string> = {
    "--color-checkbox-checked-fg": pickReadableForeground(checkboxFill),
    "--color-button-primary-foreground": pickButtonForeground(palette),
    // The on-dark-primary CTA is a WHITE pill on the dark hero in BOTH modes, so its
    // accent-as-text label is picked for AA on literal white (primary-600 on white sinks
    // to 1.25 under Signature dark, whose theme colour is near-white).
    "--color-button-on-dark-primary-text": pickReadableShade(palette, "#FFFFFF"),
    // The toast action chip is filled with the ramp on BOTH modes but with opposite-signed
    // shades (light 600/700, dark 400/300), so its label must be picked per scope.
    "--color-toast-action-foreground": pickReadableForeground(
      mode === "dark" ? palette["400"] : palette["600"],
    ),
    "--color-toast-action-foreground-hover": pickReadableForeground(
      mode === "dark" ? palette["300"] : palette["700"],
    ),
    // Generic ink for small glyphs painted directly on a runtime ramp fill
    // (toast info badge, drag handle on the accent dot): always full AA —
    // pickButtonForeground's 3:1 compromise is reserved for button state fills.
    // Dark runs those fills off primary-400 (dark.css), light off primary-600.
    "--color-on-fill-foreground": pickReadableForeground(
      mode === "dark" ? palette["400"] : palette["600"],
    ),
  };
  if (mode === "light") {
    const fillFg = pickSelectedFillForeground(palette["600"]);
    for (const name of SELECTED_FILL_INK_TOKENS) tokens[name] = fillFg;
    // Accent-as-text roles: their light sheets point at ramp shades whose
    // contrast depends on the theme color (3.03-4.44 worst-case).
    // Dark pins all five to ladder-invariant sheet values instead (dark.css).
    tokens["--color-tabs-active-text"] = pickReadableShade(palette, palette["100"]);
    tokens["--color-select-item-selected-text"] = pickReadableShade(palette, palette["100"], "700");
    tokens["--color-button-ghost-muted-hover-text"] = pickReadableShade(palette, palette["100"]);
    tokens["--color-button-ghost-primary-text"] = pickReadableShade(palette, palette["100"]);
    tokens["--color-datepicker-selected-fg"] = pickReadableShade(palette, "#FFFFFF");
    // The rest of the accent-as-text roles that land on a runtime accent
    // tint. Each sheet names a ramp step whose contrast depends on the theme
    // colour (primary-600 on primary-100 is 3.03:1 under O2 Lens light), so the
    // shade is walked against the tint the role actually paints on.
    tokens["--color-collapsible-icon-open"] = pickReadableShade(palette, palette["100"]);
    tokens["--color-icon-chip-primary-text"] = pickReadableShade(palette, palette["50"]);
    for (const name of ACCENT_SOFT_INK_TOKENS) {
      tokens[name] = pickReadableShade(palette, palette["100"], "700");
    }
  }
  return tokens;
};

/** Names libraryForegroundTokens may write in either mode (probe palette —
 *  keys never depend on the colors, only the values do). */
export const libraryForegroundTokenNames = (): string[] => {
  // Every shade the pickers walk (pickReadableShade reads up to "900"), or the probe
  // hands them undefined and contrastRatio() throws inside the theme paint.
  const probe = {
    "50": "#e5e5e5",
    "100": "#cccccc",
    "300": "#aaaaaa",
    "400": "#999999",
    "500": "#888888",
    "600": "#888888",
    "700": "#444444",
    "800": "#333333",
    "900": "#222222",
  };
  return [
    ...new Set([
      ...Object.keys(libraryForegroundTokens("light", probe)),
      ...Object.keys(libraryForegroundTokens("dark", probe)),
    ]),
  ];
};

/**
 * Mix two colors together (similar to CSS color-mix)
 * @param color1 - First hex color code (e.g., "#3F7994")
 * @param color2 - Second hex color code (e.g., "#FFFFFF")
 * @param percentage - Percentage of color1 (0-100, where 100 = fully color1)
 * @returns Hex color string of the mixed result
 */
export const mixColors = (color1: string, color2: string, percentage: number): string => {
  color1 = color1.replace("#", "");
  color2 = color2.replace("#", "");

  const r1 = parseInt(color1.substring(0, 2), 16);
  const g1 = parseInt(color1.substring(2, 4), 16);
  const b1 = parseInt(color1.substring(4, 6), 16);

  const r2 = parseInt(color2.substring(0, 2), 16);
  const g2 = parseInt(color2.substring(2, 4), 16);
  const b2 = parseInt(color2.substring(4, 6), 16);

  const ratio = percentage / 100;
  const r = Math.round(r1 * ratio + r2 * (1 - ratio));
  const g = Math.round(g1 * ratio + g2 * (1 - ratio));
  const b = Math.round(b1 * ratio + b2 * (1 - ratio));

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

export interface PrimaryPalette extends Record<string, string> {
  "50": string;
  "100": string;
  "200": string;
  "300": string;
  "400": string;
  "500": string;
  "600": string;
  "700": string;
  "800": string;
  "900": string;
  "950": string;
}

/**
 * Generate a full primary color palette from a single base hex color.
 * The base color is treated as the 600 shade; lighter shades are mixed
 * towards white, darker shades towards black.
 *
 * Exported for tokens/themeRuntimeContrast.spec.ts: the gate measures what this
 * function injects at runtime over the token sheets — the sheet is not what the
 * page paints, and a contrast suite that only reads the sheet misses it.
 */
export const generatePrimaryPalette = (baseHex: string): PrimaryPalette => {
  return {
    "50": mixColors(baseHex, "#ffffff", 5),
    "100": mixColors(baseHex, "#ffffff", 15),
    "200": mixColors(baseHex, "#ffffff", 30),
    "300": mixColors(baseHex, "#ffffff", 50),
    "400": mixColors(baseHex, "#ffffff", 70),
    "500": mixColors(baseHex, "#ffffff", 85),
    "600": baseHex,
    "700": mixColors(baseHex, "#000000", 80),
    "800": mixColors(baseHex, "#000000", 60),
    "900": mixColors(baseHex, "#000000", 40),
    // 950 continues the linear −20 step (700:80 → 800:60 → 900:40 → 950:20).
    // dark.css consumes --color-primary-950 for two surfaces. For the default
    // #3F7994 base, 20% reproduces the stock teal #0d181e (13/63 ≈ 0.20).
    "950": mixColors(baseHex, "#000000", 20),
  };
};

/** The `--color-primary-*` shades applyThemeColors writes for a theme. */
export const PALETTE_SHADES = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
] as const;

/**
 * The `--color-theme-*` custom properties applyThemeColors injects for a
 * `themeColor`, as an ordered map so the DOM writes and the contrast census read
 * the SAME expressions. Translucent entries keep their rgba() form: the census
 * composites them, the DOM layers them.
 */
export const runtimeInjectedTokens = (
  themeColor: string,
  mode: ThemeMode,
): Record<string, string> =>
  mode === "dark"
    ? {
        "--color-theme-accent": hexToRgba(themeColor, 10),
        "--color-theme-table-header-bg": mixColors(themeColor, "#000000", 40),
        "--color-theme-tab-bg": hexToRgba(themeColor, 3),
        "--color-theme-tab-bg-inactive": hexToRgba(themeColor, 1),
        "--color-theme-menu-gradient-start": hexToRgba(themeColor, 3),
        "--color-theme-menu-gradient-end": hexToRgba(themeColor, 3),
        "--color-theme-menu-color": themeColor,
      }
    : {
        "--color-theme-accent": hexToRgba(themeColor, 10),
        "--color-theme-body-bg-primary": hexToRgba(themeColor, 0.1),
        "--color-theme-body-bg-secondary": hexToRgba(themeColor, 4),
        "--color-theme-table-header-bg": mixColors(themeColor, "#FFFFFF", 30),
        "--color-theme-tab-bg": hexToRgba(themeColor, 2),
        "--color-theme-tab-bg-inactive": hexToRgba(themeColor, 1),
        "--color-theme-menu-gradient-start": hexToRgba(themeColor, 3),
        "--color-theme-menu-gradient-end": hexToRgba(themeColor, 3),
        "--color-theme-menu-color": themeColor,
      };

/** The `background` value applyThemeColors paints on <body> with `!important`. */
export const runtimePageBackground = (themeColor: string, mode: ThemeMode): string =>
  mode === "dark" ? mixColors(themeColor, "#000000", 8) : hexToRgba(themeColor, 0.5);

/** Key of a theme registry `semanticColors` overlay → the token it paints. */
export const SEMANTIC_TOKEN_MAP: Record<string, string> = {
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

/** The `semanticColors` overlay as the token map applyThemeColors writes it. */
export const runtimeSemanticTokens = (
  semanticColors?: Record<string, string | undefined>,
): Record<string, string> => {
  const tokens: Record<string, string> = {};
  if (!semanticColors) return tokens;
  for (const [key, token] of Object.entries(SEMANTIC_TOKEN_MAP)) {
    const value = semanticColors[key];
    if (value) tokens[token] = value;
  }
  return tokens;
};

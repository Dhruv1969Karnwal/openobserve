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

import { invalidateChartTheme } from "@/utils/chartTheme";
import {
  PALETTE_SHADES,
  SEMANTIC_TOKEN_MAP,
  generatePrimaryPalette,
  libraryForegroundTokenNames,
  libraryForegroundTokens,
  runtimeInjectedTokens,
  runtimePageBackground,
  runtimeSemanticTokens,
} from "@/utils/themePalette";

// The pure colour math lives in utils/themePalette so the runtime-contrast census
// (scripts/check-runtime-contrast.mjs) can import it in plain node. Re-exported here:
// every existing consumer keeps resolving through utils/theme.
export {
  cssToken,
  generatePrimaryPalette,
  hexToRgba,
  libraryForegroundTokenNames,
  libraryForegroundTokens,
  mixColors,
  pickReadableForeground,
} from "@/utils/themePalette";

/**
 * Run a light↔dark mode switch inside a View Transition so the whole page
 * cross-fades as one frame. Without this, elements that carry their own CSS
 * color transitions (inputs, selects, buttons) animate to the new theme a beat
 * after everything else snaps, which reads as a flash.
 *
 * Every DOM write of the switch (the `.dark` class toggle, store dispatch,
 * applyThemeColors) must happen inside `applyChanges` so the transition
 * captures them together.
 *
 * Applies instantly (no fade) when:
 * - the requested mode is already active — callers sync each other, and a
 *   second startViewTransition would cancel the fade already running;
 * - the View Transitions API is unavailable;
 * - the user prefers reduced motion.
 */
export const switchThemeMode = (mode: "light" | "dark", applyChanges: () => void): void => {
  const root = document.documentElement;
  const alreadyApplied = root.classList.contains("dark") === (mode === "dark");
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => {
      finished: Promise<void>;
    };
  };

  if (alreadyApplied) {
    applyChanges();
    return;
  }

  // Freeze per-element CSS transitions (inputs, buttons carry their own
  // `transition-colors`) while the switch is in flight, so every element snaps
  // to its final color inside the sweep instead of animating a beat behind the
  // rest of the page. The matching CSS lives in styles/tailwind.css.
  const freeze = () => root.classList.add("theme-switching");
  const unfreeze = () => root.classList.remove("theme-switching");

  if (
    typeof doc.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    freeze();
    applyChanges();
    // Two frames: let the new colors paint before transitions re-enable.
    requestAnimationFrame(() => requestAnimationFrame(unfreeze));
    return;
  }

  // The visual itself (soft top→bottom curtain sweep) is defined entirely in
  // CSS on the ::view-transition pseudos in styles/tailwind.css.
  const transition = doc.startViewTransition(() => {
    freeze();
    applyChanges();
  });
  transition.finished.then(unfreeze, unfreeze);
};

export interface SemanticColors {
  error: string; // coral hex, e.g. "#F45B49"
  errorBg: string; // coral tint bg, e.g. "#FEF0EE"
  errorText: string; // dark coral for text, e.g. "#C0392B"
  success: string; // emerald hex, e.g. "#5ACA7A"
  successBg: string; // emerald tint bg, e.g. "#EAF9EF"
  successText: string; // dark emerald for text, e.g. "#208A3C"
  secondaryBtnBg: string;
  secondaryBtnText: string;
  secondaryBtnBorder: string;
  // Outline + ghost button tinting — makes Cancel, Builder/SQL, icon buttons use primary color
  outlineText?: string;
  outlineBorder?: string;
  ghostText?: string;
}

/**
 * Sync the O2 component-library design tokens (--color-primary-*)
 * with the current custom theme color so all O2 components pick it up.
 */
const syncO2LibraryTokens = (themeColor: string, mode: "light" | "dark"): void => {
  const palette = generatePrimaryPalette(themeColor);
  const root = document.documentElement;
  for (const [shade, hex] of Object.entries(palette)) {
    root.style.setProperty(`--color-primary-${shade}`, hex);
  }
  const active = libraryForegroundTokens(mode, palette);
  for (const name of libraryForegroundTokenNames()) {
    // A name the current mode does not compute belongs to the other mode's
    // sheet — inline styles beat stylesheets, so a stale light pick would
    // otherwise keep painting over the dark ladder pins after a mode switch.
    if (name in active) root.style.setProperty(name, active[name]);
    else root.style.removeProperty(name);
  }
};

/**
 * Apply theme colors directly to CSS variables
 * @param themeColor - Hex color code for the theme
 * @param mode - Theme mode ("light" or "dark")
 * @param isDefault - Whether this is the default theme
 */
export const applyThemeColors = (
  themeColor: string,
  mode: "light" | "dark",
  isDefault: boolean = false,
  semanticColors?: SemanticColors,
) => {
  const darkModeActive = mode === "dark";

  // Toggle .dark class on <html> for the O2 component library (Tailwind dark
  // variant). `.dark` on <html> is the single dark-mode signal.
  document.documentElement.classList.toggle("dark", darkModeActive);

  // Sync O2 library tokens with the custom theme color.
  // When using the default theme, clear any previously-set inline primary palette so
  // the CSS token values in base.css take effect (inline styles beat stylesheets).
  if (isDefault) {
    const root = document.documentElement;
    PALETTE_SHADES.forEach((shade) => {
      root.style.removeProperty(`--color-primary-${shade}`);
    });
    for (const name of libraryForegroundTokenNames()) {
      root.style.removeProperty(name);
    }
  } else {
    syncO2LibraryTokens(themeColor, mode);
  }

  // Every --color-theme-* value comes from runtimeInjectedTokens, so the DOM writes and
  // the contrast census (scripts/check-runtime-contrast.mjs) cannot drift apart.
  const target = darkModeActive ? document.body : document.documentElement;
  const staleTarget = darkModeActive ? document.documentElement : document.body;
  for (const [name, value] of Object.entries(runtimeInjectedTokens(themeColor, mode))) {
    target.style.setProperty(name, value);
  }
  if (isDefault) {
    target.style.setProperty(
      "--color-theme-menu-gradient-start",
      darkModeActive ? "rgba(89, 155, 174, 0.3)" : "rgba(89, 175, 199, 0.3)",
    );
    target.style.setProperty("--color-theme-menu-gradient-end", "rgba(48, 193, 233, 0.3)");
    target.style.setProperty("--color-theme-menu-color", darkModeActive ? "#FFFFFF" : "#3F7994");
  }
  // The other mode's variables must go: inline styles beat stylesheets.
  const otherMode = mode === "dark" ? "light" : "dark";
  for (const name of [
    ...Object.keys(runtimeInjectedTokens(themeColor, otherMode)),
    "--color-theme-header-menu-bg",
  ]) {
    staleTarget.style.removeProperty(name);
  }
  // Page background: one calm theme tint in light, a near-black theme tint in dark.
  document.body.style.setProperty(
    "background",
    runtimePageBackground(themeColor, mode),
    "important",
  );

  // The semanticColors overlay (multi-colour themes) writes the token map below; both
  // the write targets and the census read SEMANTIC_TOKEN_MAP from utils/themePalette.
  const semanticTokens = runtimeSemanticTokens(
    semanticColors as unknown as Record<string, string | undefined> | undefined,
  );
  for (const token of Object.values(SEMANTIC_TOKEN_MAP)) {
    document.body.style.removeProperty(token);
    document.documentElement.style.removeProperty(token);
  }
  for (const [token, value] of Object.entries(semanticTokens)) {
    target.style.setProperty(token, value);
  }

  // Invalidate the resolved-token cache so charts read fresh values on theme change.
  invalidateChartTheme();

  // Dispatch event to notify components (like SearchResult) to re-render
  window.dispatchEvent(new CustomEvent("themeColorChanged"));
};

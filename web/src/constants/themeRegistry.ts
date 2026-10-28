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
 * The theme registry's COLOURS — the pure half of constants/themes.ts. Zero runtime
 * imports (`SemanticColors` is a type-only import, erased before resolution), so
 * `scripts/check-runtime-contrast.mjs` measures the shipped themes in plain node while
 * `constants/themes.ts` keeps owning names, i18n wrapping and resolution. Editing a
 * colour here is what moves the twelve measured scopes.
 */
import type { SemanticColors } from "@/utils/theme";

export type ThemeMode = "light" | "dark";

export interface ThemeModeColors {
  // Hex color used for buttons/toggles/borders and to derive the primary palette
  themeColor: string;
  // Optional multi-color semantic palette (errors/success/secondary button, etc.)
  semanticColors?: SemanticColors;
}

export interface PredefinedThemeColors {
  // Stable numeric id — kept only for legacy localStorage migration.
  id: number;
  // Stable display name — this is the persisted key for theme selection.
  name: string;
  light: ThemeModeColors;
  dark: ThemeModeColors;
}

/** Predefined themes with both light and dark mode colors, in registry order. */
export const PREDEFINED_THEME_COLORS: PredefinedThemeColors[] = [
  {
    id: 10,
    name: "O2 Signature",
    light: {
      themeColor: "#1C1F23",
    },
    dark: {
      themeColor: "#E6E6E6",
    },
  },
  {
    id: 2,
    name: "O2 Pulse",
    light: {
      themeColor: "#3F7994",
    },
    dark: {
      themeColor: "#3F7994",
    },
  },
  {
    id: 4,
    name: "O2 Horizon",
    light: {
      themeColor: "#077A7F",
    },
    dark: {
      themeColor: "#588CF3",
    },
  },
  {
    id: 5,
    name: "O2 Beacon",
    light: {
      themeColor: "#3369D6",
    },
    dark: {
      themeColor: "#6EA8FE",
    },
  },
  {
    id: 8,
    name: "O2 Lens",
    light: {
      themeColor: "#4682FA",
    },
    dark: {
      themeColor: "#E56D17",
    },
  },
  {
    id: 14,
    name: "O2 Crimson Ink",
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

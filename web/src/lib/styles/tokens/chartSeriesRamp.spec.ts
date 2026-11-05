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
 * The series ramp must stay separable WITHOUT colour. An accessibility round measured two
 * tone-twin seats (3~5 orange/magenta and 9~11 teal/olive) at ~1.1:1 in relative luminance —
 * separable by hue alone, so invisible to greyscale and to colour-blind users — and the
 * neighbour test only walked the 11 linear pairs, missing the 12->1 seat ECharts cycles to.
 * The re-stepped ramp holds three floors, pinned so they fail on mutation:
 *   · every seat clears the 3:1 graphic floor on every plot ground (worst 3.15 light / 3.47 dark);
 *   · all 12 ring-neighbour pairs (including the 12->1 wrap) clear 1.6 in greyscale AND hue;
 *   · the flagged tone-twin pairs 3~5, 5~7, 9~11 clear 1.6 on GREYSCALE ALONE, no hue help.
 * A pair that shares a tone but is not one of those is separated by its per-seat legend dash
 * (colorPalette SERIES_LINE_DASHES), so the whole matrix is checked: greyscale OR a distinct
 * legend cue. See ui-review/tools/ramp-separation-probe.mjs for the probe behind the numbers.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { contrastRatio, parseColor, type Rgba } from "./colorMath";

const here = dirname(fileURLToPath(import.meta.url));

const GROUND_FLOOR = 3;
const SEAT_FLOOR = 1.6;
const HUE_FLOOR = 60;

const RAMPS = [
  { theme: "light", file: "base.css", grounds: ["#ffffff", "#fafafa", "#f5f5f5"] },
  { theme: "dark", file: "dark.css", grounds: ["#15171a", "#1e2126", "#232730"] },
] as const;

// The pairs an accessibility round measured ~1.1:1 apart (1-indexed seats); they must clear
// the greyscale floor without leaning on hue.
const TONE_TWIN_PAIRS: Array<[number, number]> = [
  [3, 5],
  [5, 7],
  [9, 11],
];

const readRamp = (file: string): string[] => {
  const sheet = readFileSync(join(here, file), "utf8");
  return Array.from({ length: 12 }, (_, i) => {
    const m = sheet.match(new RegExp(`--color-chart-series-${i + 1}:\\s*(#[0-9a-fA-F]{6})`));
    if (!m) throw new Error(`--color-chart-series-${i + 1} missing from ${file}`);
    return m[1].toLowerCase();
  });
};

/** The per-seat legend dashes, read from the palette that paints both mark and swatch. */
const readDashes = (): string[] => {
  const src = readFileSync(join(here, "../../../utils/dashboard/colorPalette.ts"), "utf8");
  const start = src.indexOf("export const SERIES_LINE_DASHES");
  const open = src.indexOf("[", src.indexOf("=", start));
  let depth = 0;
  let close = open;
  for (; close < src.length; close++) {
    if (src[close] === "[") depth++;
    else if (src[close] === "]" && --depth === 0) break;
  }
  const body = src.slice(open + 1, close);
  const items: string[] = [];
  let current = "";
  let nest = 0;
  for (const ch of body) {
    if (ch === "[") nest++;
    if (ch === "]") nest--;
    if (ch === "," && nest === 0) {
      items.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) items.push(current.trim());
  return items.filter((v) => v && !v.startsWith("//"));
};

const rgba = (hex: string): Rgba => {
  const color = parseColor(hex);
  if (!color) throw new Error(`unparseable colour ${hex}`);
  return color;
};

const separation = (a: string, b: string): number => contrastRatio(rgba(a), rgba(b));

const hue = (hex: string): number | null => {
  const { r, g, b } = rgba(hex);
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  if (max === min) return null;
  const d = max - min;
  const raw = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (((raw * 60 + 360) % 360) + 360) % 360;
};

const hueGap = (a: string, b: string): number => {
  const [ha, hb] = [hue(a), hue(b)];
  if (ha === null || hb === null) return 360;
  const gap = Math.abs(ha - hb);
  return Math.min(gap, 360 - gap);
};

describe.each(RAMPS)("%s series ramp", ({ theme, file, grounds }) => {
  const seats = readRamp(file);
  const dashes = readDashes();

  it("paints twelve seats and carries a legend dash for each", () => {
    expect(seats).toHaveLength(12);
    expect(dashes).toHaveLength(12);
    // Seats 1 and 2 are deliberately both solid; the matrix test proves any pair that shares a
    // cue is separated on luminance instead.
  });

  it("clears the 3:1 graphic floor on every plot ground", () => {
    for (const [index, hex] of seats.entries()) {
      for (const ground of grounds) {
        expect(
          separation(hex, ground),
          `${theme} seat ${index + 1} ${hex} on ${ground}`,
        ).toBeGreaterThanOrEqual(GROUND_FLOOR);
      }
    }
  });

  it("separates all twelve ring neighbours (ECharts cycles 12->1) in luminance and hue", () => {
    for (let i = 0; i < 12; i++) {
      const j = (i + 1) % 12;
      const pair = `${theme} seats ${i + 1}~${j + 1} ${seats[i]}/${seats[j]}`;
      expect(separation(seats[i], seats[j]), pair).toBeGreaterThanOrEqual(SEAT_FLOOR);
      expect(hueGap(seats[i], seats[j]), `${pair} hue`).toBeGreaterThanOrEqual(HUE_FLOOR);
    }
  });

  it.each(TONE_TWIN_PAIRS)("clears the greyscale floor on the %i~%i tone twins", (a, b) => {
    expect(
      separation(seats[a - 1], seats[b - 1]),
      `${theme} tone twins ${a}~${b} ${seats[a - 1]}/${seats[b - 1]}`,
    ).toBeGreaterThanOrEqual(SEAT_FLOOR);
  });

  it("separates every seat pair by greyscale or by its legend cue (whole matrix)", () => {
    for (let i = 0; i < 12; i++) {
      for (let j = i + 1; j < 12; j++) {
        const pair = `${theme} seats ${i + 1}~${j + 1} ${seats[i]}/${seats[j]}`;
        const byLuminance = separation(seats[i], seats[j]) >= SEAT_FLOOR;
        const byLegendCue = dashes[i] !== dashes[j];
        expect(byLuminance || byLegendCue, `${pair} inseparable without colour`).toBe(true);
      }
    }
  });
});

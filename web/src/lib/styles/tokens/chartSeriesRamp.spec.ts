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
 * The series ramp must stay separable WITHOUT colour. An accessibility round measured
 * adjacent seats at 1.00:1 in relative luminance (seats 5 and 7), which makes the
 * separation hue-only and therefore invisible to greyscale and to colour-blind users;
 * the floors below are what the re-stepped ramp now measures with room to spare
 * (worst light ground 3.26:1, worst dark 3.47:1, weakest neighbour 1.66/1.72:1,
 * seat 5 to 7 1.97/1.67:1 — see ui-review/tools/ramp-separation-probe.mjs).
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

const readRamp = (file: string): string[] => {
  const sheet = readFileSync(join(here, file), "utf8");
  return Array.from({ length: 12 }, (_, i) => {
    const m = sheet.match(new RegExp(`--color-chart-series-${i + 1}:\\s*(#[0-9a-fA-F]{6})`));
    if (!m) throw new Error(`--color-chart-series-${i + 1} missing from ${file}`);
    return m[1].toLowerCase();
  });
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

  it("paints twelve seats", () => {
    expect(seats).toHaveLength(12);
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

  it("separates every neighbouring seat in luminance, not only in hue", () => {
    for (let i = 0; i < seats.length - 1; i += 1) {
      const pair = `${theme} seats ${i + 1}~${i + 2} ${seats[i]}/${seats[i + 1]}`;
      expect(separation(seats[i], seats[i + 1]), pair).toBeGreaterThanOrEqual(SEAT_FLOOR);
      expect(hueGap(seats[i], seats[i + 1]), `${pair} hue`).toBeGreaterThanOrEqual(HUE_FLOOR);
    }
  });

  it("separates seats 5 and 7, the pair that measured 1.00:1 in greyscale", () => {
    expect(
      separation(seats[4], seats[6]),
      `${theme} seats 5~7 ${seats[4]}/${seats[6]}`,
    ).toBeGreaterThanOrEqual(SEAT_FLOOR);
  });
});

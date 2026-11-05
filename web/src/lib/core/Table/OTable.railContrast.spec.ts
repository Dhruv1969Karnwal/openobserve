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
 * Floor on the colour of an `OTable` row rail.
 *
 * A rail is a 4px graphic whose whole job is to name a row's state, so SC 1.4.11
 * judges it at 3:1 — and nothing else in the repo measures it: `lint:runtime-contrast`
 * walks text pairs, and the contrast manifest exempts `--color-border-default` as a
 * container hairline, which is precisely the kind of token a rail must not borrow
 * (that binding measured 1.36:1 light / 1.84:1 dark before it was re-inked to the
 * rail family's own receding step).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  parseColor,
  resolveColor,
  resolveTokens,
  type Rgba,
} from "../../styles/tokens/colorMath";
import { ROW_RAIL_TONE_CLASS, type RowRailTone } from "./OTable.types";

type Theme = "light" | "dark";

const here = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILES = ["base.css", "semantic.css", "component.css", "dark.css"];
const SHEETS = TOKEN_FILES.map((file) =>
  readFileSync(join(here, "../../styles/tokens", file), "utf8"),
);
const THEMES = resolveTokens(SHEETS);

const RAIL_FLOOR = 3;

/** Every ground a rail can be drawn on: canvas, the muted wash, the stripe, hover, selection. */
const ROW_GROUNDS = [
  "--color-surface-base",
  "--color-surface-panel",
  "--color-surface-subtle",
  "--color-table-row-striped-bg",
  "--color-table-row-hover-bg",
  "--color-table-row-selected-bg",
];

/** Hairline families: a separator says "boundary", never "this row is in a state". */
const SEPARATOR_FAMILIES = ["border-", "separator", "divider"];

const tokenOf = (classes: string): string => {
  const utility = classes
    .split(/\s+/)
    .filter((cls) => cls.includes("border-s-") && !cls.endsWith(":border-s-4"))
    .pop();
  return `--color-${(utility ?? "")
    .split(":")
    .pop()!
    .replace(/^border-s-/, "")}`;
};

/** Declarations of `token`, tagged with whether a `.dark` block wrote them. */
function declarationsOf(css: string, token: string): { dark: boolean; value: string }[] {
  const found: { dark: boolean; value: string }[] = [];
  const pattern = new RegExp(`^${token}:\\s*([^;]+);`);
  let depth = 0;
  let darkDepth = -1;
  for (const line of css.split("\n")) {
    if (depth === 0 && line.includes(".dark") && line.includes("{")) darkDepth = 0;
    const declared = pattern.exec(line.trim());
    if (declared) found.push({ dark: darkDepth >= 0, value: declared[1].trim() });
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (darkDepth >= 0 && depth <= darkDepth) darkDepth = -1;
  }
  return found;
}

/**
 * `resolveTokens` skips the `@theme` tier on purpose, and `--color-row-rail-*` is
 * declared only there, so a rail colour can be invisible to the resolver while the
 * browser still paints it. Read the declaration out of the sheets instead of
 * skipping the check.
 */
const declaredValue = (token: string, theme: Theme): string | null => {
  const all = SHEETS.flatMap((css) => declarationsOf(css, token));
  const overridden = all.filter((entry) => entry.dark);
  const baseline = all.filter((entry) => !entry.dark);
  const tier = theme === "dark" && overridden.length > 0 ? overridden : baseline;
  return tier.length > 0 ? tier[tier.length - 1].value : null;
};

const railColor = (token: string, theme: Theme): Rgba | null => {
  const declared = resolveColor(token, THEMES[theme]);
  if (declared) return declared;
  const raw = declaredValue(token, theme);
  if (!raw) return null;
  const alias = /^var\((--[\w-]+)\)$/.exec(raw)?.[1];
  return alias && alias !== token ? resolveColor(alias, THEMES[theme]) : parseColor(raw);
};

const worstRatioOnRows = (token: string, theme: Theme): number => {
  const ink = railColor(token, theme);
  expect(ink, `${token} resolves to a colour in ${theme}`).not.toBeNull();
  const grounds = ROW_GROUNDS.map((ground) => resolveColor(ground, THEMES[theme]))
    .filter((color): color is Rgba => color !== null)
    .map((ground) => contrastRatio(ink as Rgba, ground));
  expect(grounds.length).toBe(ROW_GROUNDS.length);
  return Math.min(...grounds);
};

/** Floors are pinned at two decimals, which is how they are measured. */
const pinnedRatio = (token: string, theme: Theme): number =>
  Number(worstRatioOnRows(token, theme).toFixed(2));

const TONES = Object.keys(ROW_RAIL_TONE_CLASS) as RowRailTone[];

/**
 * Worst ground per tone, so a later re-tone cannot quietly lower a rail. `p2` /
 * `p3` / `success` dip under 3:1 on the hover and selected washes alone
 * (3.19–3.56:1 on the canvas): those three paint tokens a rail borrows from the
 * priority ramp and from status ink, so re-inking them is a token-sheet decision
 * rather than a rail decision — and each of those rails has a text carrier
 * (a priority chip, a run-status tag) beside it in every list that paints one.
 */
const FLOORS: Record<RowRailTone, Record<Theme, number>> = {
  p1: { light: 3.99, dark: 5.41 },
  p2: { light: 2.94, dark: 6.61 },
  p3: { light: 2.63, dark: 8.96 },
  p4: { light: 4.27, dark: 5.88 },
  p5: { light: 3.92, dark: 5.93 },
  success: { light: 2.73, dark: 8.58 },
  warning: { light: 4.07, dark: 9.76 },
  error: { light: 3.99, dark: 5.41 },
  info: { light: 8.57, dark: 10.09 },
  primary: { light: 8.57, dark: 10.09 },
  orange: { light: 8.57, dark: 10.09 },
  blue: { light: 5.54, dark: 5.88 },
  teal: { light: 4.53, dark: 8.03 },
  purple: { light: 5.77, dark: 5.66 },
  neutral: { light: 3.92, dark: 5.93 },
};

describe("OTable row rail contrast", () => {
  it("covers every tone the table can paint", () => {
    expect(Object.keys(FLOORS).sort()).toEqual([...TONES].sort());
  });

  it("never paints a rail with a separator family token", () => {
    const offenders = TONES.map((tone) => [tone, tokenOf(ROW_RAIL_TONE_CLASS[tone])] as const)
      .filter(([, token]) =>
        SEPARATOR_FAMILIES.some((family) => token.includes(`--color-${family}`)),
      )
      .map(([tone, token]) => `${tone} -> ${token}`);
    expect(offenders).toEqual([]);
  });

  it.each(TONES)("%s holds its measured floor on every row ground", (tone) => {
    for (const theme of ["light", "dark"] as const) {
      const pinned = pinnedRatio(tokenOf(ROW_RAIL_TONE_CLASS[tone]), theme);
      expect(pinned, `${tone} ${theme}`).toBeGreaterThanOrEqual(FLOORS[tone][theme]);
    }
  });

  it("keeps every rail tone it owns outright above the 3:1 graphic floor", () => {
    const owned = TONES.filter((tone) => FLOORS[tone].light >= RAIL_FLOOR);
    const below = owned.filter((tone) =>
      (["light", "dark"] as const)
        .map((theme) => pinnedRatio(tokenOf(ROW_RAIL_TONE_CLASS[tone]), theme))
        .some((ratio) => ratio < RAIL_FLOOR),
    );
    expect(below).toEqual([]);
  });

  describe("the neutral rail", () => {
    it("binds the receding rail token rather than a hairline", () => {
      expect(tokenOf(ROW_RAIL_TONE_CLASS.neutral)).toBe("--color-row-rail-muted");
    });

    it.each(["light", "dark"] as const)("clears 3:1 on every row ground in %s", (theme) => {
      expect(pinnedRatio(tokenOf(ROW_RAIL_TONE_CLASS.neutral), theme)).toBeGreaterThanOrEqual(
        RAIL_FLOOR,
      );
    });
  });
});

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

// Same pin as the SQL axis: the value axis resolves its unit once, from the
// extent, instead of once per tick. Real unit utils (axisBuilder.spec.ts mocks
// them away, so it cannot see this).
import { describe, expect, it } from "vitest";
import {
  buildTooltip,
  buildValueAxis,
  buildYAxis,
} from "@/utils/dashboard/promql/shared/axisBuilder";
import { calculateNiceTickValues } from "@/utils/dashboard/chartDimensionUtils";

const DURATION_TICKS = calculateNiceTickValues(0, 100000);

const suffixOf = (label: string) => label.replace(/^[-+]?[\d.,\s]+/, "");

describe("promql value axis prints one unit per axis", () => {
  const panelSchema = { config: { decimals: 2, unit: "milliseconds" } };

  it("labels every y-axis tick in the unit the extent pins", () => {
    const axis = buildYAxis(panelSchema, 0, undefined, 100000);
    const labels = DURATION_TICKS.map((tick: number) => axis.axisLabel.formatter(tick));

    expect(new Set(labels.map(suffixOf))).toEqual(new Set(["m"]));
    expect(labels).toEqual(["0.00m", "0.33m", "0.67m", "1.00m", "1.33m", "1.67m"]);
  });

  it("labels every tick of an h-bar value axis in the unit the extent pins", () => {
    const axis = buildValueAxis(panelSchema, undefined, 100000);
    const labels = DURATION_TICKS.map((tick: number) => axis.axisLabel.formatter(tick));

    expect(new Set(labels.map(suffixOf))).toEqual(new Set(["m"]));
  });

  it("pins from the configured axis bounds when the converter passes no extent", () => {
    const axis = buildYAxis({
      config: { decimals: 2, unit: "milliseconds", y_axis_max: 100000 },
    });
    const labels = DURATION_TICKS.map((tick: number) => axis.axisLabel.formatter(tick));

    expect(new Set(labels.map(suffixOf))).toEqual(new Set(["m"]));
  });

  it("sizes the pin on the largest bound magnitude, negative included", () => {
    const axis = buildYAxis({
      config: { decimals: 2, unit: "milliseconds", y_axis_min: -100000 },
    });

    expect(axis.axisLabel.formatter(-50000)).toBe("-0.83m");
  });

  it("keeps the axis_width variant of the label formatter pinned too", () => {
    const axis = buildYAxis(
      { config: { decimals: 2, unit: "milliseconds", axis_width: 100 } },
      0,
      undefined,
      100000,
    );
    const labels = DURATION_TICKS.map((tick: number) => axis.axisLabel.formatter(tick));

    expect(axis.axisLabel.width).toBe(100);
    expect(new Set(labels.map(suffixOf))).toEqual(new Set(["m"]));
  });

  it("cannot pin without any extent, so it keeps the per-value ladder", () => {
    const axis = buildYAxis(panelSchema);

    expect(axis.axisLabel.formatter(0)).toBe("0.00ms");
    expect(axis.axisLabel.formatter(100000)).toBe("1.67m");
  });
});

describe("promql single values keep their natural unit", () => {
  it("a tooltip names one value, so it is not pinned to the axis ladder", () => {
    const tooltip = buildTooltip({ config: { decimals: 2, unit: "milliseconds" } });
    const html = tooltip.formatter([
      { seriesName: "up", marker: "", value: [1700000000000, 20000] },
    ]);

    expect(html).toContain("20.00s");
  });
});

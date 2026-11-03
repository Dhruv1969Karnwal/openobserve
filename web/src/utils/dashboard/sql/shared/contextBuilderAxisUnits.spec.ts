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

// Regression: a SQL value axis resolved its unit ladder PER TICK, so one axis
// printed "0.00ms / 50.00s / 1.67m" (duration) and "1.43MB/s" above
// "878.91KB/s" (throughput). The unit is now pinned from the axis extent.
import { describe, expect, it, vi } from "vitest";
import { buildSQLContext } from "@/utils/dashboard/sql/shared/contextBuilder";
import { calculateNiceTickValues } from "@/utils/dashboard/chartDimensionUtils";

vi.mock("@/utils/dashboard/sqlProcessData", () => ({
  processData: vi.fn((data) => data[0] || []),
}));
vi.mock("@/utils/dashboard/sqlMissingValueFiller", () => ({
  fillMissingValues: vi.fn((data) => data),
}));
vi.mock("@/utils/dashboard/sql/shared/seriesBuilder", () => ({
  buildDataLookupMap: vi.fn(() => new Map()),
  createSeriesBuilders: vi.fn(() => ({
    getSeries: vi.fn(() => []),
    getAnnotationMarkLine: vi.fn(() => []),
    getSeriesMarkArea: vi.fn(() => null),
  })),
}));
vi.mock("@/utils/dashboard/sql/shared/trellisConfig", () => ({
  createTrellisHelpers: vi.fn(() => ({ updateTrellisConfig: vi.fn() })),
}));
vi.mock("@/utils/dashboard/legendConfiguration", () => ({
  createBaseLegendConfig: vi.fn(() => ({ orient: "horizontal" })),
  getChartDimensions: vi.fn(() => ({ chartWidth: 800, chartHeight: 400 })),
  calculateChartDimensions: vi.fn(() => ({
    availableWidth: 800,
    availableHeight: 400,
  })),
  calculatePieChartRadius: vi.fn(() => 50),
}));
vi.mock("@/utils/dashboard/sqlChartSeriesProps", () => ({
  getPropsByChartTypeForSeries: vi.fn(() => ({ type: "line" })),
}));

const store = {
  state: { theme: "light", zoConfig: { timestamp_column: "_timestamp" } },
};
const chartPanelRef = { value: { offsetWidth: 800, offsetHeight: 400 } };

const buildCtx = (panelSchema: any, rows: any[]) =>
  buildSQLContext(panelSchema, [rows], store, chartPanelRef, null, [{}], { queries: [{}] }, {}, []);

const basePanel = (config: any) => ({
  id: "p1",
  type: "line",
  queries: [
    {
      fields: {
        x: [{ alias: "t", label: "Time" }],
        y: [{ alias: "v", label: "Duration" }],
        z: [],
        breakdown: [],
      },
    },
  ],
  config,
});

const tickLabels = (ctx: any, lo: number, hi: number) =>
  calculateNiceTickValues(lo, hi).map((tick: number) =>
    ctx.options.yAxis.axisLabel.formatter(tick),
  );

const suffixOf = (label: string) => label.replace(/^[-+]?[\d.,\s]+/, "");
const decimalsOf = (label: string) => label.split(".")[1]?.replace(/[^0-9]/g, "").length ?? 0;

describe("SQL value axis prints one unit per axis", () => {
  const durationPanel = basePanel({ decimals: 2, unit: "milliseconds" });
  const durationRows = [
    { t: "10:00", v: 0 },
    { t: "10:01", v: 100000 },
  ];

  it("pins a duration axis whose extent spans ms, s and m to a single suffix", () => {
    const ctx: any = buildCtx(durationPanel, durationRows);
    const labels = tickLabels(ctx, 0, 100000);

    expect(labels.length).toBeGreaterThan(3);
    expect(new Set(labels.map(suffixOf))).toEqual(new Set(["m"]));
  });

  it("prints the whole duration axis with the same decimal count", () => {
    const ctx: any = buildCtx(durationPanel, durationRows);
    const labels = tickLabels(ctx, 0, 100000);

    expect(new Set(labels.map(decimalsOf))).toEqual(new Set([2]));
    expect(labels).toEqual(["0.00m", "0.33m", "0.67m", "1.00m", "1.33m", "1.67m"]);
  });

  it("labels the zero tick with the AXIS unit, not the panel's own unit", () => {
    const ctx: any = buildCtx(durationPanel, durationRows);

    expect(ctx.options.yAxis.axisLabel.formatter(0)).toBe("0.00m");
  });

  it("pins a throughput axis whose extent spans B/s, KB/s and MB/s", () => {
    const ctx: any = buildCtx(basePanel({ decimals: 2, unit: "bps" }), [
      { t: "10:00", v: 0 },
      { t: "10:01", v: 1500000 },
    ]);
    const labels = tickLabels(ctx, 0, 1500000);

    expect(new Set(labels.map(suffixOf))).toEqual(new Set(["MB/s"]));
    expect(labels).toContain("1.43MB/s");
  });

  it("pins the crosshair label to the axis unit too", () => {
    const ctx: any = buildCtx(durationPanel, durationRows);
    const crosshair = ctx.options.tooltip.axisPointer.label.formatter;

    // 20000ms alone would read "20.00s"; on an axis pinned to minutes it may not
    expect(crosshair({ axisDimension: "y", value: 20000, axisIndex: 0 })).toBe("0.33m");
  });

  it("pins the h-bar value-axis crosshair to the axis unit", () => {
    const ctx: any = buildCtx({ ...durationPanel, type: "h-bar" }, durationRows);
    const crosshair = ctx.options.tooltip.axisPointer.label.formatter;

    expect(crosshair({ axisDimension: "x", value: 20000, axisIndex: 0 })).toBe("0.33m");
  });

  it("keeps a tick beyond the predicted extent in the same axis unit", () => {
    const ctx: any = buildCtx(basePanel({ decimals: 2, unit: "kilobytes" }), [
      { t: "10:00", v: 0 },
      { t: "10:01", v: 900 },
    ]);
    const fmt = ctx.options.yAxis.axisLabel.formatter;
    const labels = [...tickLabels(ctx, 0, 900), fmt(1200)];

    expect(new Set(labels.map(suffixOf))).toEqual(new Set(["KB"]));
    // 1200 used to escalate to "1.17MB" mid-axis, a label the column width had
    // never been measured for
    expect(fmt(1200)).toBe("1200.00KB");
  });
});

describe("single values keep their natural unit", () => {
  it("a tooltip names one value, so it is not pinned to the axis ladder", () => {
    const ctx: any = buildCtx(basePanel({ decimals: 2, unit: "milliseconds" }), [
      { t: "10:00", v: 0 },
      { t: "10:01", v: 100000 },
    ]);
    const tooltip = ctx.options.tooltip.formatter;

    expect(tooltip([{ seriesName: "v", marker: "", name: "10:01", value: 20000 }])).toContain(
      "20.00s",
    );
  });
});

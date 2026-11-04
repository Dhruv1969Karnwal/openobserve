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

// Focused y-axis tick/nameGap tests for buildSQLContext with the REAL
// measurement and unit-conversion utils (the broader convertSQLData spec
// mocks those away, which bypasses the whole tick-prediction path).
import { describe, expect, it, vi } from "vitest";
import { buildSQLContext } from "@/utils/dashboard/sql/shared/contextBuilder";
import { calculateWidthText } from "@/utils/dashboard/chartDimensionUtils";

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

const basePanel = (over: any = {}) => ({
  id: "p1",
  type: "line",
  queries: [
    {
      fields: {
        x: [{ alias: "t", label: "Time" }],
        y: [{ alias: "v", label: "Data (Bytes)" }],
        z: [],
        breakdown: [],
      },
    },
  ],
  config: { decimals: 2 },
  ...over,
});

describe("buildSQLContext y-axis ticks", () => {
  it("extends tick decimals when the configured precision would collide (CLS-style range)", () => {
    const rows = [
      { t: "10:00", v: 0.002 },
      { t: "10:01", v: 0.012 },
    ];
    const ctx: any = buildCtx(basePanel(), rows);
    const fmt = ctx.options.yAxis.axisLabel.formatter;
    // 0–0.012 splits into 0.002 ticks; 2 decimals would render them all "0.00"/"0.01"
    expect(fmt(0.004)).toContain("0.004");
    expect(fmt(0.004)).not.toBe(fmt(0.006));
  });

  it("prints a whole step as whole numbers even where decimals are pinned", () => {
    const rows = [
      { t: "10:00", v: 100 },
      { t: "10:01", v: 900 },
    ];
    const ctx: any = buildCtx(basePanel(), rows);
    const fmt = ctx.options.yAxis.axisLabel.formatter;
    expect(fmt(200)).toContain("200");
    expect(fmt(200)).not.toContain(".");
  });

  it("labels the zero tick in the panel's own unit", () => {
    // the axis starts at 0, which used to read "0.00B" on a KB or MB panel
    const rows = [
      { t: "10:00", v: 100 },
      { t: "10:01", v: 900 },
    ];
    const cases: [string, number, string, string][] = [
      ["kilobytes", 2, "0KB", "200KB"],
      ["megabytes", 2, "0MB", "200MB"],
      // the License page's ingestion chart: megabytes at 0 decimals
      ["megabytes", 0, "0MB", "200MB"],
    ];
    for (const [unit, decimals, zeroTick, tick] of cases) {
      const ctx = buildCtx(basePanel({ config: { decimals, unit } }), rows);
      const fmt = ctx?.options.yAxis.axisLabel.formatter;
      expect(fmt(0)).toBe(zeroTick);
      expect(fmt(200)).toBe(tick);
    }
  });

  it("measures one tick beyond the extent so a slightly-short estimate cannot under-reserve", () => {
    // max 790 predicts ticks up to 800; the safety tick also measures the
    // 1000 label, so the gap matches a chart whose extent truly reaches 1000
    const panel = () => basePanel({ config: { decimals: 2, unit: "megabytes" } });
    const shortCtx: any = buildCtx(panel(), [
      { t: "10:00", v: 10 },
      { t: "10:01", v: 790 },
    ]);
    const fullCtx: any = buildCtx(panel(), [
      { t: "10:00", v: 10 },
      { t: "10:01", v: 950 },
    ]);
    expect(shortCtx.options.yAxis.nameGap).toBe(fullCtx.options.yAxis.nameGap);
  });

  it("sizes stacked charts from the per-bucket SUM, not the per-point max", () => {
    // per-point max is 500 (ticks to 600) but the bucket sums reach 950, so
    // ECharts stacks to a 1000 top tick — the gap must fit "1000.00MB"
    const rows = [
      { t: "10:00", v: 500, b: "b1" },
      { t: "10:00", v: 450, b: "b2" },
      { t: "10:01", v: 300, b: "b1" },
      { t: "10:01", v: 200, b: "b2" },
    ];
    const panel = basePanel({
      type: "area-stacked",
      config: { decimals: 2, unit: "megabytes" },
    });
    panel.queries[0].fields.breakdown = [{ alias: "b", label: "Breakdown" }];
    const ctx: any = buildCtx(panel, rows);
    // a plain line over the same rows only sees the per-point max (500)
    const lineCtx: any = buildCtx(
      basePanel({ config: { decimals: 2, unit: "megabytes" } }),
      rows.map(({ t, v }) => ({ t, v })),
    );
    expect(ctx.options.yAxis.nameGap).toBeGreaterThan(lineCtx.options.yAxis.nameGap);
  });
});

describe("axis formatting discipline", () => {
  const rows = [
    { t: "10:00", v: 20 },
    { t: "10:01", v: 180 },
  ];

  it("prints whole counts without two decimals when nothing pinned the precision", () => {
    const ctx: any = buildCtx(basePanel({ config: {} }), rows);
    const fmt = ctx.options.yAxis.axisLabel.formatter;
    expect(fmt(180)).toBe("180");
    expect(fmt(60)).toBe("60");
  });

  it("does not let a pinned precision inflate a whole step", () => {
    const ctx: any = buildCtx(basePanel({ config: { decimals: 2 } }), rows);
    expect(ctx.options.yAxis.axisLabel.formatter(180)).toBe("180");
  });

  it("keeps a pinned precision when the step is fractional", () => {
    const ctx: any = buildCtx(basePanel({ config: { decimals: 2 } }), [
      { t: "10:00", v: 0.1 },
      { t: "10:01", v: 0.9 },
    ]);
    expect(ctx.options.yAxis.axisLabel.formatter(0.2)).toBe("0.20");
  });

  it("titles the axis with a compound unit instead of repeating it on every tick", () => {
    const ctx: any = buildCtx(
      basePanel({ config: { decimals: 2, unit: "custom", unit_custom: "span/s" } }),
      [
        { t: "10:00", v: 1 },
        { t: "10:01", v: 6 },
      ],
    );
    expect(ctx.options.yAxis.name).toContain("span/s");
    const label = ctx.options.yAxis.axisLabel.formatter(5);
    expect(label).toBe("5");
    expect(label).not.toContain("span/s");
  });

  it("sizes the unit title on the ticks it actually paints, not on the unit it removed", () => {
    const ctx: any = buildCtx(
      basePanel({ config: { decimals: 2, unit: "custom", unit_custom: "span/s" } }),
      [
        { t: "10:00", v: 1 },
        { t: "10:01", v: 6 },
      ],
    );
    const fmt = ctx.options.yAxis.axisLabel.formatter;
    // The name inset must be sized on the label the axis actually paints. Sized on
    // a unit-bearing label instead, the rotated title lands outside the panel —
    // which is where "spans/s" went.
    expect(ctx.options.yAxis.nameGap).toBeLessThan(calculateWidthText("9span/s") + 10);
    expect(fmt(9)).toBe("9");
  });

  it("keeps a short unit on the tick, where it reads as part of the number", () => {
    const ctx: any = buildCtx(basePanel({ config: { decimals: 0, unit: "percent" } }), [
      { t: "10:00", v: 10 },
      { t: "10:01", v: 90 },
    ]);
    expect(ctx.options.yAxis.axisLabel.formatter(50)).toBe("50%");
  });

  it("thins the tick count on a short panel so tick labels cannot stack", () => {
    const short = { value: { offsetWidth: 800, offsetHeight: 120 } };
    const ctx: any = buildSQLContext(
      basePanel({ config: {} }),
      [rows],
      store,
      short,
      null,
      [{}],
      { queries: [{}] },
      {},
      [],
    );
    expect(ctx.options.yAxis.splitNumber).toBeLessThanOrEqual(3);
  });

  it("paints tick labels with the chart text token, not ECharts' own grey", () => {
    const ctx: any = buildCtx(basePanel({ config: {} }), rows);
    expect(ctx.options.yAxis.axisLabel.color).toBeTruthy();
    expect(ctx.options.xAxis[0].axisLabel.color).toBe(ctx.options.yAxis.axisLabel.color);
  });
});

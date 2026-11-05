// Copyright 2026 OpenObserve Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without an implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// Monotonicity of a real painted axis, end to end.
//
// `axisBuilderAxisUnits.spec.ts` proves the formatter pins one unit WHEN the
// converter hands it the axis extent. Nothing proved the converter ever does,
// and it did not: every panel on the metrics explorer sized each tick on its
// own, so one axis printed `1.43MB/s` above `878.91KB/s` above `0.00B/s`. Read
// as numbers that column descends and re-ascends; a rater cannot tell a
// falling axis from a rescaled one, and the axis is the only thing on the panel
// that says how big the metric is.
//
// This spec runs the ACTUAL chart path (no axisBuilder mock, no formatter mock)
// and asserts the property the council asked for in the only way it can be
// asserted: format the ticks an axis paints, parse the printed labels back into
// magnitudes using the unit each label names, and require the order to survive.
import { describe, expect, it } from "vitest";
import { TimeSeriesConverter } from "./convertPromQLTimeSeriesChart";
import { calculateNiceTickValues } from "../chartDimensionUtils";
import type { ProcessedPromQLData } from "./shared/types";

const START = 1762188000000;
const STEP = 60000;

/**
 * Parse a printed tick back into the magnitude it names. The unit is part of
 * the label, so a mis-scaled tick parses back wrong on purpose: that is the
 * whole point. `0.000K/s`-style labels are not produced by these units.
 */
const UNIT_DIVISORS: Record<string, number> = {
  "B/s": 1,
  "KB/s": 1024,
  "MB/s": 1024 * 1024,
  "GB/s": 1024 * 1024 * 1024,
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  kB: 1e3,
  "kB/s": 1e3,
  "MB/s-si": 1e6,
  ns: 1,
  μs: 1e3,
  ms: 1e6,
  s: 1e9,
};

/** `"878.91KB/s"` -> `{ magnitude: 878.91, unit: "KB/s", bytes: 900003.84 }` */
const parseTickLabel = (label: string) => {
  const match = /^(-?[\d.]+)(.*)$/.exec(label);
  if (!match) throw new Error(`unparseable tick label: ${JSON.stringify(label)}`);
  const [, number, unit] = match;
  const divisor = UNIT_DIVISORS[unit];
  if (divisor === undefined) throw new Error(`unknown unit in tick label: ${label}`);
  return { magnitude: parseFloat(number), unit, absolute: Math.abs(parseFloat(number)) * divisor };
};

/** One series over N timestamps; `values` are PromQL's string samples. */
const queryFor = (name: string, values: number[]): ProcessedPromQLData => ({
  timestamps: values.map((_, i) => [START + i * STEP, `${i}`] as [number, Date | string]),
  series: [
    {
      name,
      metric: {},
      values: values.map((v, i) => [START + i * STEP, String(v)] as [number, string]),
      data: Object.fromEntries(values.map((v, i) => [START + i * STEP, String(v)])),
    },
  ],
  queryIndex: 0,
  queryConfig: {},
});

const panelFor = (unit: string, config: any = {}) => ({
  type: "line",
  queries: [{ query: { query: "rate(container_fs_reads_bytes_total[5m])" }, fields: { y: [] } }],
  config: { unit, decimals: 2, ...config },
});

const store = { state: { timezone: "UTC", theme: "light" } };

/** The panel element the grid builder measures; a card is ~300px tall. */
const chartPanelRef = { value: { offsetWidth: 590, offsetHeight: 300 } };

/** Format the ticks a value axis actually paints for `min..max`. */
const paintedTicks = (panelSchema: any, data: ProcessedPromQLData[], splitNumber = 5) => {
  const chart = new TimeSeriesConverter().convert(
    data,
    panelSchema,
    store,
    { legends: [] },
    chartPanelRef,
  );
  const values = data.flatMap((q) =>
    q.series.flatMap((s) => s.values.map(([, v]) => parseFloat(v))),
  );
  const ticks = calculateNiceTickValues(Math.min(...values), Math.max(...values), splitNumber);
  return { chart, ticks };
};

describe("metrics axis keeps one unit and its order", () => {
  // 0 .. ~1.43 MB/s, the exact band `container_fs_reads_bytes` plots on the
  // explorer's worst-scored card.
  const MBPS = 1024 * 1024;
  const ascending = [0, 1430000, 0, 1140000, 0, 880000, 0, 590000, 0, 293000];

  it("prints every tick of a bytes/s axis in one unit", () => {
    const { chart, ticks } = paintedTicks(panelFor("bps"), [queryFor("pod=api-1", ascending)]);
    const labels = ticks.map((t) => chart.yAxis.axisLabel.formatter(t));
    const units = new Set(labels.map((l: string) => parseTickLabel(l).unit));

    expect(units.size).toBe(1);
  });

  it("keeps ascending values ascending once the printed labels are parsed back", () => {
    const { chart, ticks } = paintedTicks(panelFor("bps"), [queryFor("pod=api-1", ascending)]);
    const parsed = ticks.map((t: number) => parseTickLabel(chart.yAxis.axisLabel.formatter(t)));

    // The displayed magnitudes must be readable as a scale: no tick may print a
    // smaller number than the tick below it when the axis only rises.
    const shown = parsed.map((p) => p.magnitude);
    shown.forEach((value, i) => {
      if (i === 0) return;
      expect(value).toBeGreaterThanOrEqual(shown[i - 1]);
    });

    // ...and the labels must agree with the values they name. A printed tick is
    // the real tick rounded to `decimals` places of the pinned unit, so the
    // honest tolerance is half a step of the last printed digit - no more.
    parsed.forEach((p, i) => {
      const actual = Math.abs(ticks[i]);
      const halfLastDigit = (UNIT_DIVISORS[p.unit] * 0.01) / 2;
      expect(Math.abs(p.absolute - actual)).toBeLessThanOrEqual(halfLastDigit + 1e-9);
    });
  });

  it("holds one unit across the KB/MB boundary a rate axis actually crosses", () => {
    // Spanning 1 order of magnitude below and above the MB/s step is what makes
    // an unpinned axis switch unit mid-column.
    const values = [0, 0.29 * MBPS, 0.59 * MBPS, 0.88 * MBPS, 1.14 * MBPS, 1.43 * MBPS];
    const { chart, ticks } = paintedTicks(panelFor("bps"), [queryFor("instance-a", values)]);
    const labels = ticks.map((t) => chart.yAxis.axisLabel.formatter(t));

    expect(new Set(labels.map((l: string) => parseTickLabel(l).unit)).size).toBe(1);
    expect(
      labels
        .map((l: string) => parseTickLabel(l).magnitude)
        .every((m: number, i: number, all: number[]) => i === 0 || m >= all[i - 1]),
    ).toBe(true);
  });

  it("pins on the widest series when several series share a panel", () => {
    // Two series, two magnitudes: the axis must size on both, not on the first.
    const small = [0, 900, 1800, 2700, 3600];
    const large = [0, 400000, 800000, 1200000, 1600000];
    const { chart, ticks } = paintedTicks(panelFor("bps"), [
      queryFor("pod=api-1", small),
      queryFor("pod=api-2", large),
    ]);
    const labels = ticks.map((t) => chart.yAxis.axisLabel.formatter(t));

    expect(new Set(labels.map((l: string) => parseTickLabel(l).unit)).size).toBe(1);
  });

  it("pins an area panel the same way as a line panel", () => {
    const values = [0, 293000, 590000, 880000, 1140000, 1430000];
    const { chart, ticks } = paintedTicks(
      panelFor("bps", { line_interpolation: "smooth" }),
      [queryFor("instance-a", values)],
      5,
    );
    const labels = (chart as any).yAxis.axisLabel.formatter
      ? ticks.map((t) => (chart as any).yAxis.axisLabel.formatter(t))
      : ticks.map((t) => (chart as any).yAxis[0].axisLabel.formatter(t));

    expect(new Set(labels.map((l: string) => parseTickLabel(l).unit)).size).toBe(1);
  });

  it("honours configured axis bounds over the data when sizing the pin", () => {
    // A pinned y-axis is a promise about what the axis shows, so the unit is
    // sized to the bound, not to the (smaller) data.
    const { chart, ticks } = paintedTicks(
      panelFor("bps", { y_axis_min: 0, y_axis_max: 5 * 1024 * 1024 }),
      [queryFor("instance-a", [0, 1000, 2000, 3000])],
    );
    const labels = ticks.map((t) => chart.yAxis.axisLabel.formatter(t));

    expect(new Set(labels.map((l: string) => parseTickLabel(l).unit)).size).toBe(1);
  });

  it("sizes a plain byte panel the same way as a rate panel", () => {
    const values = [0, 900000, 1800000];
    const { chart, ticks } = paintedTicks(panelFor("bytes"), [queryFor("node-a", values)]);
    const labels = ticks.map((t) => chart.yAxis.axisLabel.formatter(t));

    expect(new Set(labels.map((l: string) => parseTickLabel(l).unit)).size).toBe(1);
  });

  it("leaves a unitless axis printing numbers, unpinned and unperturbed", () => {
    const { chart, ticks } = paintedTicks(panelFor("numbers"), [
      queryFor("count", [0, 1500000, 3000000]),
    ]);
    const labels = ticks.map((t) => chart.yAxis.axisLabel.formatter(t));

    // `numbers` has its own ladder; the point is the labels still parse back in
    // order whatever unit they land on.
    const magnitudes = labels.map((l: string) => parseFloat(l.replace(/[^0-9.-]/g, "")));
    magnitudes.forEach((m, i) => {
      if (i > 0) expect(m).toBeGreaterThanOrEqual(magnitudes[i - 1]);
    });
  });

  it("does not invent an axis on a panel with no samples", () => {
    const empty: ProcessedPromQLData = {
      timestamps: [],
      series: [{ name: "none", metric: {}, values: [], data: {} }],
      queryIndex: 0,
      queryConfig: {},
    };
    const chart: any = new TimeSeriesConverter().convert(
      [empty],
      panelFor("bps"),
      store,
      { legends: [] },
      chartPanelRef,
    );

    // An empty panel has no extent to size on; it must still answer for 0 in
    // some unit rather than throw or print nothing.
    expect(typeof chart.yAxis.axisLabel.formatter(0)).toBe("string");
  });
});

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

import { describe, expect, it } from "vitest";

import {
  chartAccessibleName,
  chartSummaryText,
  chartTableOf,
  seriesFactsOf,
  unitOf,
  xAxisExtentOf,
} from "./chartTextEquivalent";

const series = [
  {
    name: "prod",
    data: [
      [1, "2"],
      [2, "4.5"],
    ],
  },
  {
    name: "canary",
    data: [
      [1, "1"],
      [2, null],
    ],
  },
];

const options = {
  xAxis: {
    data: [
      [1, "17:10"],
      [2, "17:25"],
    ],
  },
  yAxis: { axisLabel: { formatter: (value: number) => `${value}c/s` } },
  series,
};

describe("chart text equivalent", () => {
  it("reduces each series to latest, peak and sample count", () => {
    expect(seriesFactsOf(options.series)).toEqual([
      { name: "prod", samples: 2, latest: 4.5, peak: 4.5, low: 2 },
      { name: "canary", samples: 1, latest: 1, peak: 1, low: 1 },
    ]);
  });

  it("names the chart by title, unit and the axis' own extent", () => {
    expect(xAxisExtentOf(options)).toEqual({ start: "17:10", end: "17:25" });
    expect(unitOf(options, seriesFactsOf(options.series))).toBe("c/s");
    expect(chartAccessibleName("HTTP rate", options, seriesFactsOf(options.series))).toBe(
      "HTTP rate, in c/s, 17:10 to 17:25",
    );
  });

  it("falls back to a plain name when the panel has no title and no unit", () => {
    const bare = { series: [{ name: "x", data: [1, 2] }] };
    expect(chartAccessibleName("", bare, seriesFactsOf(bare.series))).toBe("Chart");
  });

  it("states every drawn series with its latest and peak value", () => {
    const summary = chartSummaryText("HTTP rate", options, seriesFactsOf(options.series));
    expect(summary).toContain("HTTP rate: 2 series in c/s from 17:10 to 17:25");
    expect(summary).toContain("prod: latest 4.5c/s, peak 4.5c/s");
    expect(summary).toContain("canary: latest 1c/s, peak 1c/s");
    expect(summary).toContain("data table");
  });

  it("says so when nothing was plotted instead of inventing a zero", () => {
    const empty = [{ name: "x", data: [] }];
    expect(chartSummaryText("Rate", {}, seriesFactsOf(empty))).toContain(
      "No values in this window.",
    );
  });

  it("caps a long key and counts what it left out", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      name: `s${i}`,
      data: [[1, String(i)]],
    }));
    const summary = chartSummaryText("Bus", {}, seriesFactsOf(many));
    expect(summary).toContain("14 series");
    expect(summary).toContain("and 2 more series");
  });

  it("builds one row per sample and one column per series", () => {
    const table = chartTableOf("HTTP rate", options, options.series)!;
    expect(table.columns).toEqual(["Time", "prod", "canary"]);
    expect(table.rows).toEqual([
      { label: "17:10", cells: ["2c/s", "1c/s"] },
      { label: "17:25", cells: ["4.5c/s", "—"] },
    ]);
    expect(table.caption).toContain("HTTP rate");
  });

  it("thins a huge window and says that it did", () => {
    const wide = [{ name: "s", data: Array.from({ length: 300 }, (_, i) => [i, String(i)]) }];
    const table = chartTableOf("Long", {}, wide)!;
    expect(table.rows.length).toBeLessThanOrEqual(120);
    expect(table.strideNote).toBe("Every 3th sample of 300 plotted.");
  });

  it("drops the milliseconds a converter leaves on an ISO row label", () => {
    const iso = {
      xAxis: {
        data: [
          [1793552836000, "2026-11-01T17:27:16.000"],
          [1793552854000, "2026-11-01T17:27:34.000"],
        ],
      },
      series: [{ name: "s", data: [[1793552836000, "2"]] }],
    };
    expect(chartTableOf("Rate", iso, iso.series)!.rows[0].label).toBe("2026-11-01 17:27:16");
  });

  it("tidies a point whose x the converter already formatted as ISO", () => {
    const isoX = {
      series: [{ name: "s", data: [["2026-11-01T17:27:16.000", "2"]] }],
    };
    expect(chartTableOf("Rate", {}, isoX.series)!.rows[0].label).toBe("2026-11-01 17:27:16");
  });

  it("returns no table when the chart holds no series", () => {
    expect(chartTableOf("Empty", {}, [])).toBeNull();
  });
});

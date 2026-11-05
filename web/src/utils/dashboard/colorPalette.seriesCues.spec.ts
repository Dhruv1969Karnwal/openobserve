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
  getSeriesLineStyleType,
  getSeriesMarkShape,
  withSeriesNonColourCues,
} from "./colorPalette";

const line = (name: string, value = 1) => ({
  type: "line",
  name,
  data: [
    [1, String(value)],
    [2, String(value)],
  ],
});

const empty = (name: string) => ({ type: "line", name, data: [[1, null]] });

describe("per-seat non-colour cues", () => {
  it("gives every seat from the second on its own dash pattern", () => {
    const seats = Array.from({ length: 12 }, (_, i) => i);
    const dashes = new Set(seats.map((i) => JSON.stringify(getSeriesLineStyleType(i))));
    // 11 distinct across 12 seats: seats 1 and 2 are the pair that is already
    // separated by luminance, so they are deliberately left solid.
    expect(dashes.size).toBe(11);
    expect(getSeriesLineStyleType(0)).toBe("solid");
    expect(getSeriesLineStyleType(1)).toBe("solid");
    expect(new Set(seats.map((i) => getSeriesMarkShape(i))).size).toBeGreaterThanOrEqual(7);
  });

  it("leaves a single series exactly as it was", () => {
    const options = { series: [line("only")], legend: { show: false } };
    expect(withSeriesNonColourCues(options)).toBe(options);
  });

  it("keeps the first two strokes solid — they are luminance-separated already", () => {
    const out = withSeriesNonColourCues({ series: [line("a"), line("b"), line("c")] });
    expect(out.series[0].lineStyle.type).toBe("solid");
    expect(out.series[1].lineStyle.type).toBe("solid");
    expect(out.series[2].lineStyle.type).toEqual([6, 3]);
    expect(out.series[0].symbol).toBe("circle");
    expect(out.series[1].symbol).toBe("diamond");
    expect(out.series[2].symbol).toBe("rect");
  });

  it("never overwrites a dash a panel override already set", () => {
    const custom = { ...line("a"), lineStyle: { type: "dotted", width: 3 } };
    const out = withSeriesNonColourCues({ series: [custom, line("b")] });
    expect(out.series[0].lineStyle).toEqual({ type: "dotted", width: 3 });
  });

  it("does not touch a bar series", () => {
    const bar = { type: "bar", name: "bars", data: [1, 2] };
    const out = withSeriesNonColourCues({ series: [bar, line("b")] });
    expect(out.series[0]).toBe(bar);
  });

  it("does not mutate the options it was handed", () => {
    const options = { series: [line("a"), line("b")] };
    withSeriesNonColourCues(options);
    expect(options.series[0].lineStyle).toBeUndefined();
    expect(options.series[0].symbol).toBeUndefined();
  });

  it("leaves a line series swatch to the series, so the dash and mark carry over", () => {
    const out = withSeriesNonColourCues({
      series: [line("a"), line("b")],
      legend: { show: true, data: ["a", { name: "b" }] },
    });
    // ECharts draws a line series' marker from its own lineStyle + symbol: injecting an
    // icon replaces that with a filled blob and drops the seat's dash from the key.
    expect(out.legend.data).toEqual([{ name: "a" }, { name: "b" }]);
    expect(out.series[0].lineStyle.type).toBe("solid");
    expect(out.series[1].lineStyle.type).toBe("solid");
    expect(out.series[0].symbol).toBe("circle");
    expect(out.series[1].symbol).toBe("diamond");
  });

  it("keeps an icon the builder already chose", () => {
    const out = withSeriesNonColourCues({
      series: [line("a"), line("b")],
      legend: { show: true, data: [{ name: "a", icon: "triangle" }] },
    });
    expect(out.legend.data[0].icon).toBe("triangle");
  });

  it("lists only series that carry data when the legend is left to ECharts", () => {
    const out = withSeriesNonColourCues({
      series: [line("a"), empty("nothing"), line("c")],
      legend: { show: true },
    });
    expect(out.legend.data).toEqual([{ name: "a" }, { name: "c" }]);
  });

  it("leaves the legend alone when the panel turned it off", () => {
    const out = withSeriesNonColourCues({
      series: [line("a"), line("b")],
      legend: { show: false },
    });
    expect(out.legend.data).toBeUndefined();
  });
});

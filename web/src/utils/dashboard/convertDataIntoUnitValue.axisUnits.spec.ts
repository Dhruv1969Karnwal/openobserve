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

// One axis prints one unit: the ladder step is chosen from the axis extent, not
// per tick (a duration axis used to read "0.00ms / 50.00s / 1.67m").
import { describe, expect, it } from "vitest";
import {
  formatUnitValue,
  getPinnedUnitForExtent,
  getUnitValue,
} from "@/utils/dashboard/convertDataIntoUnitValue";

describe("getPinnedUnitForExtent", () => {
  it.each([
    ["milliseconds", 0, "ms"],
    ["milliseconds", 999, "ms"],
    ["milliseconds", 1000, "s"],
    ["milliseconds", 59999, "s"],
    ["milliseconds", 60000, "m"],
    ["milliseconds", 120000, "m"],
    ["milliseconds", 3600000, "h"],
    ["milliseconds", 86400000, "D"],
    ["milliseconds", -120000, "m"],
    ["seconds", 0, "s"],
    ["seconds", 90, "m"],
    ["minutes", 0, "m"],
    ["minutes", 90, "h"],
    ["bytes", 1023, "B"],
    ["bytes", 1024, "KB"],
    ["bytes", 1500000, "MB"],
    ["bps", 1500000, "MB/s"],
    ["bytes-si", 1500, "kB"],
    ["numbers", 0, ""],
    ["numbers", 1500, "K"],
    ["numbers", 2500000, "M"],
    ["req-per-sec", 2500, "K req/s"],
  ])("sizes a %s axis whose largest tick is %s to %s", (unit, extent, expected) => {
    expect(getPinnedUnitForExtent(extent, unit)?.unit).toBe(expected);
  });

  it.each([
    [999, "milliseconds", "ms", 1],
    [1000, "milliseconds", "s", 1000],
    [120000, "milliseconds", "m", 60000],
    [1500000, "bytes", "MB", 1024 * 1024],
    [2500, "numbers", "K", 1e3],
  ])("pins extent %s of %s to %s with divisor %s", (extent, unit, suffix, divisor) => {
    const pinned = getPinnedUnitForExtent(extent, unit);
    expect(pinned?.unit).toBe(suffix);
    expect(pinned?.divisor).toBe(divisor);
  });

  it("sizes the pin from the largest magnitude, not the largest positive value", () => {
    expect(getPinnedUnitForExtent(-1500000, "bytes")?.unit).toBe("MB");
  });

  it.each(["percent", "percent-1", "custom", "currency-dollar", "locale", "nope", "", undefined])(
    "returns null for %s — a unit with no ladder cannot be pinned",
    (unit) => {
      expect(getPinnedUnitForExtent(1500000, unit as string)).toBeNull();
    },
  );

  it.each([NaN, Infinity, -Infinity, undefined, null, "abc"])(
    "returns null when the extent is %s — nothing to size the axis to",
    (extent) => {
      expect(getPinnedUnitForExtent(extent, "bytes")).toBeNull();
    },
  );
});

describe("getUnitValue with a pinned axis extent", () => {
  it("prints every value of the axis in the pinned unit", () => {
    const ticks = [0, 20000, 40000, 60000, 80000, 100000, 120000, -20000];
    const units = ticks.map((v) => getUnitValue(v, "milliseconds", "", 2, 120000).unit);
    expect(new Set(units)).toEqual(new Set(["m"]));
  });

  it("keeps the decimals fixed across the axis, zero included", () => {
    expect(formatUnitValue(getUnitValue(0, "milliseconds", "", 2, 120000))).toBe("0.00m");
    expect(formatUnitValue(getUnitValue(20000, "milliseconds", "", 2, 120000))).toBe("0.33m");
    expect(formatUnitValue(getUnitValue(120000, "milliseconds", "", 2, 120000))).toBe("2.00m");
    expect(formatUnitValue(getUnitValue(-20000, "milliseconds", "", 2, 120000))).toBe("-0.33m");
  });

  it("keeps the decimals the caller asked for, not the ladder's", () => {
    expect(formatUnitValue(getUnitValue(20000, "milliseconds", "", 0, 120000))).toBe("0m");
    expect(formatUnitValue(getUnitValue(20000, "milliseconds", "", 4, 120000))).toBe("0.3333m");
  });

  it("still prints a value above the pinned step in the pinned unit", () => {
    expect(formatUnitValue(getUnitValue(7200000, "milliseconds", "", 2, 120000))).toBe("120.00m");
  });

  it("ignores the extent for units that have no ladder", () => {
    expect(getUnitValue(75.5, "percent", "", 1, 100)).toEqual({ value: "75.5", unit: "%" });
    expect(getUnitValue(1500, "custom", "widgets", 2, 120000)).toEqual({
      value: "1500.00",
      unit: "widgets",
    });
  });
});

describe("getUnitValue without an extent keeps its per-value ladder", () => {
  it("gives a single value the unit that reads best for it", () => {
    expect(formatUnitValue(getUnitValue(20000, "milliseconds", "", 2))).toBe("20.00s");
    expect(formatUnitValue(getUnitValue(120000, "milliseconds", "", 2))).toBe("2.00m");
    expect(formatUnitValue(getUnitValue(900000, "bps", "", 2))).toBe("878.91KB/s");
  });

  it("keeps zero in the panel's own unit when no axis unit is pinned", () => {
    expect(formatUnitValue(getUnitValue(0, "milliseconds", "", 2))).toBe("0.00ms");
    expect(formatUnitValue(getUnitValue(0, "kilobytes", "", 2))).toBe("0.00KB");
  });
});

// Copyright 2026 OpenObserve Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { describe, expect, it } from "vitest";
import { resolveLogsVisualizeToggle } from "./logs";

describe("resolveLogsVisualizeToggle — patterns deep-link restore (F-43)", () => {
  it("coerces patterns to logs when the build does not unlock log patterns", () => {
    expect(resolveLogsVisualizeToggle("patterns", false)).toBe("logs");
  });

  it("keeps patterns when the entitlement allows it (the upstream lock treatment)", () => {
    expect(resolveLogsVisualizeToggle("patterns", true)).toBe("patterns");
  });

  it("passes every other tab through untouched, allowed or not", () => {
    for (const tab of ["logs", "visualize", "build", "drilldown"]) {
      expect(resolveLogsVisualizeToggle(tab, false)).toBe(tab);
      expect(resolveLogsVisualizeToggle(tab, true)).toBe(tab);
    }
  });

  // F-66: the results grid and every panel v-if match only the known toggle set,
  // so any other restored value used to blank the content area.
  describe("coerces every value outside the known set to logs (F-66)", () => {
    it.each([
      ["an unknown word", "foo"],
      ["a near-miss tab name", "metrics"],
      ["the empty string", ""],
      ["wrong casing of a known tab", "PATTERNS"],
      ["trailing whitespace", "patterns "],
      ["a unicode look-alike", "pattéerns"],
      ["a repeated URL param array naming patterns", ["patterns"]],
      ["a repeated URL param array of garbage", ["foo", "bar"]],
      ["null", null],
      ["undefined", undefined],
      ["a number", 42],
      ["an object", { value: "patterns" }],
    ])("maps %s to logs, allowed or not", (_label, value) => {
      expect(resolveLogsVisualizeToggle(value, false)).toBe("logs");
      expect(resolveLogsVisualizeToggle(value, true)).toBe("logs");
    });

    it("keeps every member of the shipped toggle set", () => {
      for (const tab of ["logs", "visualize", "build", "drilldown"]) {
        expect(resolveLogsVisualizeToggle(tab, true)).toBe(tab);
      }
    });
  });
});

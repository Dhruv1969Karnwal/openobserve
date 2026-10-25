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

  it("leaves non-string query values to the existing restore semantics", () => {
    expect(resolveLogsVisualizeToggle(["patterns"], false)).toEqual(["patterns"]);
    expect(resolveLogsVisualizeToggle(null, false)).toBe(null);
  });
});

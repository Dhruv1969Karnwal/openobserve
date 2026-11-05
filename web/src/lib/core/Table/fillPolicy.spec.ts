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
import { shouldFillHeight, FILL_HYSTERESIS_PX } from "./fillPolicy";

describe("shouldFillHeight", () => {
  it("does not stretch a frame taller than its content", () => {
    // 4 rows in a viewport that could show 18: the frame must collapse.
    expect(shouldFillHeight(700, 210, true)).toBe(false);
  });

  it("fills when the rows need the room", () => {
    expect(shouldFillHeight(700, 1900, false)).toBe(true);
  });

  it("keeps the historical behaviour when height is unknown", () => {
    expect(shouldFillHeight(0, 210, false)).toBe(true);
    expect(shouldFillHeight(700, NaN, true)).toBe(true);
  });

  it("holds still inside the hysteresis band", () => {
    const near = 700;
    expect(shouldFillHeight(near, near - FILL_HYSTERESIS_PX / 2, true)).toBe(true);
    expect(shouldFillHeight(near, near + FILL_HYSTERESIS_PX / 2, false)).toBe(false);
  });
});

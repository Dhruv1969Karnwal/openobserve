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
import { balancedColumns } from "./balancedColumns";

// the canvas a list strip gets at 1440 with the rail: the width the
// five-plus-one orphan was measured in
const W1440 = 1088;
const MIN = 208;
const GAP = 8;
const at = (count: number, width: number) => balancedColumns(count, width, MIN, GAP);

describe("balancedColumns", () => {
  it("fills the row the width allows", () => {
    expect(at(1, W1440)).toBe(1);
    expect(at(4, W1440)).toBe(4);
    expect(at(5, W1440)).toBe(5);
    expect(at(6, 1317)).toBe(6);
  });

  it("never leaves one tile alone on its own row", () => {
    // Six tiles at five columns is five-plus-one across 877px of empty canvas.
    expect(at(6, W1440)).toBe(4);
    expect(6 % at(6, W1440)).not.toBe(1);
    expect(at(11, W1440)).toBe(4);
  });

  it("keeps a short final row when it is not lonely", () => {
    expect(at(7, W1440)).toBe(5);
    expect(7 % 5).toBe(2);
  });

  it("collapses to one column on a phone", () => {
    expect(at(6, 390)).toBe(1);
    expect(at(6, 0)).toBe(1);
  });

  it("never asks for more columns than there are tiles", () => {
    expect(at(3, 4000)).toBe(3);
  });
});

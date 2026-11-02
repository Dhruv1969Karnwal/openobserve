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

import { describe, it, expect } from "vitest";
import { functionRowView, parseParams, parseStreams } from "./functionRows";

describe("functionRows", () => {
  it("reads the typed params array the list endpoint serves", () => {
    expect(parseParams([{ name: "fields", value: "*" }])).toEqual([{ name: "fields", value: "*" }]);
  });

  it("reads a bare argument list as parameters without values", () => {
    expect(parseParams("row")).toEqual([{ name: "row", value: null }]);
    expect(parseParams('["row", "ts"]')).toEqual([
      { name: "row", value: null },
      { name: "ts", value: null },
    ]);
    expect(parseParams("")).toEqual([]);
    expect(parseParams(undefined)).toEqual([]);
  });

  it("keeps a parameter whose value the payload does not carry", () => {
    expect(parseParams([{ name: "table" }])).toEqual([{ name: "table", value: null }]);
  });

  it("reads streams from either field the producer uses", () => {
    expect(parseStreams({ associated_with_streams: ["k8s"] })).toEqual(["k8s"]);
    expect(parseStreams({ streams: [{ stream: "k8s", order: 1 }] })).toEqual(["k8s"]);
    expect(parseStreams({})).toEqual([]);
  });

  it("names the body's language from the payload, falling back to the transform type", () => {
    expect(functionRowView({ language: "vrl", transType: 0 }).codeLang).toBe("vrl");
    expect(functionRowView({ transType: 1 }).codeLang).toBe("javascript");
    expect(functionRowView({ transType: 0 }).codeLang).toBe("vrl");
    expect(functionRowView({ transType: 1 }).isJs).toBe(true);
  });

  it("reports a function count only when the payload states one", () => {
    expect(functionRowView({ num_of_func: 2 }).functionCount).toBe(2);
    expect(functionRowView({}).functionCount).toBeNull();
  });

  it("never invents a body for a record without one", () => {
    const view = functionRowView({ name: "x" });
    expect(view.body).toBe("");
    expect(view.name).toBe("x");
  });
});

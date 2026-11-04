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
import { shortenHostNames } from "./hostNameDisplay";

const AWS_FLEET = [
  "ip-10-0-20.eu-west-1.compute.internal",
  "ip-10-0-32.eu-west-1.compute.internal",
  "ip-10-0-11.eu-west-1.compute.internal",
];

describe("shortenHostNames", () => {
  it("withholds the suffix every row shares and prints it once", () => {
    const { labels, sharedSuffix } = shortenHostNames(AWS_FLEET);
    expect(sharedSuffix).toBe(".eu-west-1.compute.internal");
    expect(labels.get("ip-10-0-20.eu-west-1.compute.internal")).toBe("ip-10-0-20");
    expect(labels.get("ip-10-0-11.eu-west-1.compute.internal")).toBe("ip-10-0-11");
  });

  it("keeps the shortened labels distinct", () => {
    const { labels } = shortenHostNames(AWS_FLEET);
    const short = AWS_FLEET.map((name) => labels.get(name));
    expect(new Set(short).size).toBe(AWS_FLEET.length);
  });

  it("withholds only what the whole list shares, so a second region stays visible", () => {
    const { labels, sharedSuffix } = shortenHostNames([
      ...AWS_FLEET,
      "ip-10-0-41.us-east-1.compute.internal",
    ]);
    expect(sharedSuffix).toBe(".compute.internal");
    expect(labels.get("ip-10-0-20.eu-west-1.compute.internal")).toBe("ip-10-0-20.eu-west-1");
    expect(labels.get("ip-10-0-41.us-east-1.compute.internal")).toBe("ip-10-0-41.us-east-1");
  });

  it("withholds a shared domain and keeps the host whole", () => {
    const { labels, sharedSuffix } = shortenHostNames([
      "gateway-eu-primary-01.dc.internal",
      "gateway-eu-primary-02.dc.internal",
    ]);
    expect(sharedSuffix).toBe(".dc.internal");
    expect(labels.get("gateway-eu-primary-01.dc.internal")).toBe("gateway-eu-primary-01");
  });

  it("prints names in full when no two trailing segments are shared", () => {
    const { labels, sharedSuffix } = shortenHostNames(["host-01.dc.internal", "host-02.dc.lan"]);
    expect(sharedSuffix).toBeNull();
    expect(labels.size).toBe(0);
  });

  it("needs two shared segments, not one", () => {
    const { sharedSuffix } = shortenHostNames([
      "ip-10-0-20euwest1x.internal",
      "ip-10-0-32.internal",
    ]);
    expect(sharedSuffix).toBeNull();
  });

  it("never empties the shortest name in the list", () => {
    const { labels, sharedSuffix } = shortenHostNames([...AWS_FLEET, "eu-west-1.compute.internal"]);
    expect(sharedSuffix).toBe(".compute.internal");
    expect(labels.get("eu-west-1.compute.internal")).toBe("eu-west-1");
    expect(labels.get("ip-10-0-20.eu-west-1.compute.internal")).toBe("ip-10-0-20.eu-west-1");
  });

  it("does nothing for one host or none", () => {
    expect(shortenHostNames(["solo.host.example"]).sharedSuffix).toBeNull();
    expect(shortenHostNames([]).labels.size).toBe(0);
  });

  it("ignores blank and duplicate rows", () => {
    const { labels, sharedSuffix } = shortenHostNames([...AWS_FLEET, "", "  ", AWS_FLEET[0]]);
    expect(sharedSuffix).toBe(".eu-west-1.compute.internal");
    expect(labels.size).toBe(AWS_FLEET.length);
  });
});

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

// The scroll pager used to land on top of the third legend entry ("canar").

import { describe, expect, it } from "vitest";
import { reserveLegendPagerSpace } from "./legendConfiguration";
import { calculateWidthText } from "./chartDimensionUtils";

const legendOptions = (over: any = {}) => ({
  legend: {
    show: true,
    type: "scroll",
    orient: "horizontal",
    left: "0",
    top: "bottom",
    textStyle: { width: 120, overflow: "truncate" },
    ...over,
  },
  series: [{ name: "prod/frontend-5c2b8-10abcd" }, { name: "staging/checkout-9a1e6" }],
});

describe("reserveLegendPagerSpace", () => {
  it("bounds the legend to the width left after the pager", () => {
    const options = legendOptions();
    reserveLegendPagerSpace(options, 540);
    expect(options.legend.width).toBe(540 - 64);
  });

  it("never squeezes the legend below a readable strip on a narrow panel", () => {
    const options = legendOptions();
    reserveLegendPagerSpace(options, 120);
    expect(options.legend.width).toBeGreaterThanOrEqual(120);
  });

  it("sizes the label from the names it carries but never past the 7.5rem cap", () => {
    const options = legendOptions();
    reserveLegendPagerSpace(options, 1200);
    const widest = Math.max(
      ...["prod/frontend-5c2b8-10abcd", "staging/checkout-9a1e6"].map((name) =>
        calculateWidthText(name),
      ),
    );
    expect(options.legend.textStyle.width).toBe(Math.max(60, Math.min(widest, 120)));
    expect(options.legend.textStyle.width).toBeLessThanOrEqual(120);
  });

  it("keeps three named series on a page at metrics-card width", () => {
    // Reserving the pager without re-budgeting the text is what turned "1/4" into
    // "1/6": the panel could only name 2 of its plotted series at a time.
    const long = (n: number) =>
      `prod/frontend-5c2b8-1045-${n}-checkout-9a1e6-1041-payments-7f3d2-2203-auth-bd1c4-5501-` +
      `search-api-3g7h9-8812-edge-router-2k5m8-4490-ingest-gateway-6p9r1-3327-querier-8t2v4-1158`;
    const options = legendOptions();
    options.series = [1, 2, 3, 4, 5, 6].map((n) => ({ name: long(n) }));
    const container = 500;
    reserveLegendPagerSpace(options, container);
    expect(calculateWidthText(long(1))).toBeGreaterThan(120);
    const perEntry = options.legend.textStyle.width + 40;
    const viewport = options.legend.width as number;
    expect(Math.floor(viewport / perEntry)).toBeGreaterThanOrEqual(3);
    expect(viewport + 64).toBeLessThanOrEqual(container);
  });

  it("keeps three named series on a page at phone panel width", () => {
    const options = legendOptions();
    options.series = [
      { name: "frontend" },
      { name: "checkout" },
      { name: "cart" },
      { name: "search-api" },
      { name: "payments" },
    ];
    reserveLegendPagerSpace(options, 370);
    const perEntry = options.legend.textStyle.width + 40;
    expect(Math.floor((options.legend.width as number) / perEntry)).toBeGreaterThanOrEqual(3);
    // "cart" must survive whole: it was cut to a bare "c" against the pager
    expect(options.legend.textStyle.width).toBeGreaterThanOrEqual(calculateWidthText("cart"));
  });

  it("keeps the ellipsis rule so a cut name still says so", () => {
    const options = legendOptions();
    reserveLegendPagerSpace(options, 300);
    expect(options.legend.textStyle.overflow).toBe("truncate");
  });

  it("paints the pager and its page text from tokens", () => {
    const options = legendOptions();
    reserveLegendPagerSpace(options, 540);
    expect(options.legend.pageIconColor).toBeTruthy();
    expect(options.legend.pageTextStyle.color).toBeTruthy();
    expect(options.legend.pageTextStyle.fontSize).toBe(12);
  });

  it("leaves plain, vertical and hidden legends alone", () => {
    const plain = legendOptions({ type: "plain" });
    const vertical = legendOptions({ orient: "vertical" });
    const hidden = legendOptions({ show: false });
    reserveLegendPagerSpace(plain, 540);
    reserveLegendPagerSpace(vertical, 540);
    reserveLegendPagerSpace(hidden, 540);
    expect(plain.legend.width).toBeUndefined();
    expect(vertical.legend.width).toBeUndefined();
    expect(hidden.legend.width).toBeUndefined();
  });
});

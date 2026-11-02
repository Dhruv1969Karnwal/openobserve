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
import { mount } from "@vue/test-utils";
import SloBudgetCell from "./SloBudgetCell.vue";

const status = (over: Record<string, unknown>) =>
  ({
    sli: 99,
    target: 99.9,
    burn_rate: 1.2,
    coverage: 0.95,
    no_data: false,
    error_budget_remaining: 40,
    ...over,
  }) as any;

const cell = (props: Record<string, unknown>) => mount(SloBudgetCell, { props });
const geometry = (wrapper: any) => {
  const seg = wrapper.find('[data-test="slo-budget-segment"]');
  const zero = wrapper.find('[data-test="slo-budget-zero"]');
  return {
    start: parseFloat(seg.attributes("style").match(/inset-inline-start:\s*([\d.]+)%/)?.[1] ?? ""),
    width: parseFloat(seg.attributes("style").match(/width:\s*([\d.]+)%/)?.[1] ?? ""),
    zeroLeft: parseFloat(zero.attributes("style").match(/([\d.]+)%/)?.[1] ?? ""),
  };
};

describe("SloBudgetCell", () => {
  it("paints what is left to the right of the zero mark", () => {
    const wrapper = cell({ status: status({ error_budget_remaining: 40 }) });
    const g = geometry(wrapper);
    expect(g.start).toBeCloseTo(g.zeroLeft);
    expect(g.width).toBeGreaterThan(0);
    expect(wrapper.text()).toContain("40.0%");
  });

  it("paints an overspent budget as an overrun past the zero mark, never an empty track", () => {
    const wrapper = cell({ status: status({ error_budget_remaining: -59 }) });
    const g = geometry(wrapper);
    expect(g.start).toBeLessThan(g.zeroLeft);
    expect(g.start).toBeGreaterThanOrEqual(0);
    expect(g.start + g.width).toBeCloseTo(g.zeroLeft);
    expect(wrapper.find('[data-test="slo-budget-segment"]').classes()).toContain(
      "bg-progress-bar-danger",
    );
    expect(wrapper.text()).toContain("-59.0%");
  });

  it("clamps a deep overrun inside the track instead of overflowing it", () => {
    const g = geometry(cell({ status: status({ error_budget_remaining: -400 }) }));
    expect(g.start).toBe(0);
  });

  it("keeps the burn multiplier in the same reading as the budget", () => {
    expect(cell({ status: status({ burn_rate: 1.6 }) }).text()).toContain("×1.6");
  });

  it("prints a dash rather than a zero when nothing was measured", () => {
    const wrapper = cell({ status: { no_data: true, error_budget_remaining: null } as any });
    expect(wrapper.text().trim()).toBe("—");
    expect(wrapper.find('[data-test="slo-budget-bar"]').exists()).toBe(false);
  });

  it("prints a dash when the SLO has no status at all", () => {
    expect(cell({ status: null }).text().trim()).toBe("—");
  });

  it("keeps a paused SLO's last numbers out of the severity ink", () => {
    const wrapper = cell({ status: status({ error_budget_remaining: -37.6 }), enabled: false });
    expect(wrapper.find('[data-test="slo-budget-segment"]').classes()).toContain(
      "bg-progress-bar-neutral",
    );
    expect(wrapper.text()).toContain("-37.6%");
  });
});

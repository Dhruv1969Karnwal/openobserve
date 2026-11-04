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

//! The SLO list's composition, measured against what a five-persona council read
//! off a 1440x900 screenshot:
//!
//! * the six health tiles wrapped four-plus-two, leaving 539px of empty grid;
//! * a left rail appeared on the paused row and no other, so it read as a
//!   decoration rather than as the screen's state channel;
//! * a chip showed a diamond and a number that named nothing;
//! * one row was three em dashes with no sentence saying why;
//! * `sli_type` was filterable but never printable, and the burn multiplier was
//!   the smallest load-bearing figure on the page.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/services/slos", async (importOriginal) => {
  const { overlayServiceMock } = await import("@/test/unit/helpers/mockService");
  return overlayServiceMock(await importOriginal(), {
    default: { list: vi.fn(), delete: vi.fn(), move: vi.fn(), setEnabled: vi.fn() },
  });
});

vi.mock("@/services/alerts", async (importOriginal) => {
  const { overlayServiceMock } = await import("@/test/unit/helpers/mockService");
  return overlayServiceMock(await importOriginal(), {
    default: { list_by_slo: vi.fn() },
  });
});

import SloList from "@/views/slos/SloList.vue";
import i18n from "@/locales";
import store from "@/test/unit/helpers/store";
import router from "@/test/unit/helpers/router";
import sloService from "@/services/slos";

const node = document.createElement("div");
node.setAttribute("id", "slo-composition-root");
document.body.appendChild(node);

const HOUR = 3600;
const DAY = 86400;

const status = (over: Record<string, unknown> = {}) => ({
  group_key: "",
  coverage: 0.98,
  no_data: false,
  sli: 99.93,
  error_budget_remaining: 30,
  burn_rate: 0.7,
  time_to_exhaust_secs: null,
  good: 100,
  total: 100,
  covered_slices: 98,
  computed_at: Math.floor(Date.now() / 1000) - HOUR,
  ...over,
});

const row = (over: Record<string, any>) => ({
  folder_id: "default",
  description: "",
  enabled: true,
  target: 99.9,
  window_secs: 30 * DAY,
  slice_interval_secs: 300,
  tags: [],
  sli_type: "count",
  ...over,
});

/** One row per state the strip counts, in the order the severity sort leaves them:
 *  blown, at risk, meeting, then the two rows that report nothing. */
const FIXTURE = () => [
  row({
    id: "slo-blown",
    name: "search-latency-p95",
    status: status({ error_budget_remaining: -59, burn_rate: 1.6, time_to_exhaust_secs: 0 }),
  }),
  row({
    id: "slo-risk",
    name: "checkout-availability",
    sli_type: "time_slice",
    tags: ["team:payments"],
    status: status({ error_budget_remaining: 12, burn_rate: 1.4, time_to_exhaust_secs: 2 * DAY }),
  }),
  row({
    id: "slo-grouped",
    name: "ingest-completeness",
    sli_type: "alert",
    group_by: ["service", "region"],
    status: status({ error_budget_remaining: 40, burn_rate: 0.6 }),
  }),
  row({
    id: "slo-paused",
    name: "web-vitals-lcp",
    enabled: false,
    group_by: ["service"],
    status: status({ error_budget_remaining: -37.6, burn_rate: 1.4 }),
  }),
  row({ id: "slo-fresh", name: "cart-api-success-ratio", status: null }),
  row({
    id: "slo-frozen",
    name: "queue-depth-slo",
    status: status({ no_data: true, sli: null, error_budget_remaining: null, coverage: 0.31 }),
  }),
  row({
    id: "slo-late",
    name: "audit-log-delivery",
    sli_type: "time_slice",
    status: status({
      no_data: true,
      sli: null,
      error_budget_remaining: null,
      coverage: 0.12,
      measuring_since: Math.floor(new Date("2026-09-02T00:00:00Z").getTime() / 1000),
    }),
  }),
];

const ODropdownStub = {
  name: "ODropdown",
  template: '<div class="o-dropdown-stub"><slot name="trigger" /><slot /></div>',
};
const ODropdownItemStub = {
  name: "ODropdownItem",
  emits: ["select"],
  template: "<button @click=\"$emit('select')\"><slot /></button>",
};

async function mountList(rows: any[]) {
  vi.mocked(sloService.list).mockResolvedValue({ data: { list: rows } } as any);
  const wrapper = mount(SloList, {
    attachTo: node,
    global: {
      plugins: [i18n, store, router],
      stubs: {
        FolderList: { template: '<div data-test="stub-folder-list"></div>' },
        SelectFolderDropDown: true,
        ODropdown: ODropdownStub,
        ODropdownItem: ODropdownItemStub,
      },
    },
  });
  await flushPromises();
  await new Promise((r) => setTimeout(r, 75));
  await flushPromises();
  return wrapper;
}

const bodyRows = (wrapper: any) => wrapper.findAll('[data-test^="o2-table-row-"]');
const rowFor = (wrapper: any, name: string) =>
  bodyRows(wrapper).find((r: any) => r.text().includes(name));
const facts = (wrapper: any, id: string) =>
  wrapper.find(`[data-test="slos-slolist-facts-${id}"]`).text();

/** Tailwind keeps a variant in ONE class token, so a rail is matched as a
 *  substring of the row's class list rather than as an array member. */
const classesOf = (row: any) => row.classes().join(" ");

describe("SloList — strip layout and semantics", () => {
  let wrapper: any;
  beforeEach(async () => {
    vi.clearAllMocks();
    wrapper = await mountList(FIXTURE());
  });
  afterEach(() => wrapper?.unmount());

  it("lays all six facets out as one compact row, not four-plus-two", () => {
    const strip = wrapper.findComponent({ name: "OStatStrip" });
    // The wide band (the only one a headless frame measures) is the one with room
    // for six 144px tiles, and it takes the narrow wrap basis that makes that fit.
    expect(strip.props("compact")).toBe(true);
    expect(strip.props("items")).toHaveLength(6);
  });

  it("shows the reset tile as selected while nothing is filtered", () => {
    expect(wrapper.find('[data-test="slos-slolist-stat-total"]').attributes("aria-pressed")).toBe(
      "true",
    );
  });

  it("prints a count of objectives that are fine in ink, not in green", () => {
    expect(wrapper.find('[data-test="slos-slolist-stat-meeting"]').html()).not.toContain(
      "text-icon-chip-success-text",
    );
  });

  it("keeps the colour on the states someone can act on", () => {
    expect(wrapper.find('[data-test="slos-slolist-stat-budget_blown"]').html()).toContain(
      "text-icon-chip-error-text",
    );
  });
});

describe("SloList — the rail is a state channel, not a one-off mark", () => {
  let wrapper: any;
  beforeEach(async () => {
    vi.clearAllMocks();
    wrapper = await mountList(FIXTURE());
  });
  afterEach(() => wrapper?.unmount());

  it("paints a rail on every row, so the receding one has a scale", () => {
    const rows = bodyRows(wrapper);
    expect(rows).toHaveLength(7);
    for (const r of rows) expect(classesOf(r)).toContain("border-s-4");
  });

  it("paints each row its own state", () => {
    expect(classesOf(rowFor(wrapper, "search-latency-p95"))).toContain(
      "border-s-icon-chip-error-text",
    );
    expect(classesOf(rowFor(wrapper, "checkout-availability"))).toContain(
      "border-s-icon-chip-warning-text",
    );
    expect(classesOf(rowFor(wrapper, "ingest-completeness"))).toContain(
      "border-s-icon-chip-success-text",
    );
    expect(classesOf(rowFor(wrapper, "web-vitals-lcp"))).toContain("border-s-row-rail-muted");
  });

  it("washes the paused row, the way the alerts list does", () => {
    expect(classesOf(rowFor(wrapper, "web-vitals-lcp"))).toContain("bg-surface-panel");
    expect(classesOf(rowFor(wrapper, "ingest-completeness"))).not.toContain("bg-surface-panel");
  });
});

describe("SloList — every row says what it is and what it does not know", () => {
  let wrapper: any;
  beforeEach(async () => {
    vi.clearAllMocks();
    wrapper = await mountList(FIXTURE());
  });
  afterEach(() => wrapper?.unmount());

  it("names the grouping in words instead of a diamond and a number", () => {
    const chip = wrapper.find('[data-test="slos-slolist-group-slo-grouped"]');
    expect(chip.text()).toBe("service +1");
    expect(chip.attributes("aria-label")).toBe("grouped by service +1");
  });

  it("keeps every chip off the identity line so the name owns the cell", () => {
    const name = wrapper.find('[data-test="slos-slolist-name-slo-grouped"]');
    const cell = name.element.parentElement as HTMLElement;
    expect(cell.firstElementChild).toBe(name.element);
    expect(name.element.textContent).toContain("ingest-completeness");
    expect(name.element.querySelector('[data-test^="slos-slolist-group"]')).toBeNull();
    const chipLine = cell.children[1] as HTMLElement;
    expect(chipLine.querySelector('[data-test="slos-slolist-group-slo-grouped"]')).not.toBeNull();
  });

  it("drops the violet badge out of the row", () => {
    expect(wrapper.html()).not.toContain("badge-purple-soft");
  });

  it("prints the SLI type the toolbar has always filtered on", () => {
    expect(facts(wrapper, "slo-grouped")).toContain("Alert-based");
    expect(facts(wrapper, "slo-risk")).toContain("Time slice");
  });

  it("prints the tags the search placeholder has always promised", () => {
    expect(facts(wrapper, "slo-risk")).toContain("team:payments");
  });

  it("states when the budget runs out on the row that is running out", () => {
    expect(facts(wrapper, "slo-risk")).toContain("budget gone in 2d 0h");
  });

  it("does not count down on a row that is already out", () => {
    expect(facts(wrapper, "slo-blown")).not.toContain("budget gone in");
  });

  it("explains a row of em dashes instead of leaving one standing", () => {
    expect(facts(wrapper, "slo-fresh")).toContain("not measured yet");
    expect(rowFor(wrapper, "cart-api-success-ratio").text()).toContain("—");
  });

  it("explains a frozen source by the coverage it actually reported", () => {
    expect(facts(wrapper, "slo-frozen")).toContain("no data at 31% coverage");
  });

  it("says when a source only started measuring, instead of blaming coverage", () => {
    expect(facts(wrapper, "slo-late")).toContain("the source only measures since Sep 2, 2026");
    expect(facts(wrapper, "slo-late")).toContain("Time slice");
  });

  it("states the measurement age and the next exhaustion above the rows", () => {
    const line = wrapper.find('[data-test="slos-slolist-scope-facts"]').text();
    expect(line).toContain("measured");
    expect(line).toContain("next budget out in 2d 0h");
  });
});

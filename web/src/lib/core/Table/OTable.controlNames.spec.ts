// Copyright 2026 OpenObserve Inc.
import { describe, it, expect, beforeAll } from "vitest";
import { mount, config, flushPromises } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { nextTick } from "vue";

const messages = {
  en: {
    common: { addFilter: "Add filter", expand: "Expand", collapse: "Collapse" },
    search: { noData: "No data" },
  },
};
const i18n = createI18n({ legacy: false, locale: "en", messages });
beforeAll(() => {
  config.global.plugins.unshift([i18n as any]);
  (globalThis as any).requestAnimationFrame = (cb: any) => cb();
});

import OTable from "./OTable.vue";
import type { OTableColumnDef } from "./OTable.types";

type Row = { id: number; name: string; status: string; children?: Row[] };

const columns: OTableColumnDef[] = [
  { id: "name", header: "Function name", accessorKey: "name", filterable: true },
  { id: "status", header: "Status", accessorKey: "status" },
];

const flat: Row[] = [
  { id: 1, name: "redact_pii", status: "Active" },
  { id: 2, name: "add_geo", status: "Active" },
];

const tree: Row[] = [
  {
    id: 1,
    name: "ingest",
    status: "Active",
    children: [{ id: 11, name: "ingest-a", status: "Active" }],
  },
  { id: 2, name: "standalone", status: "Active" },
];

// An icon-only control whose only name is a glyph is invisible to a screen reader and
// ambiguous to voice control; both controls here render on every table that uses the feature.
describe("OTable shared icon-only controls carry accessible names", () => {
  it("names the column-filter trigger with the column it filters", async () => {
    const wrapper = mount(OTable, {
      props: {
        data: flat,
        columns,
        enableColumnFilter: true,
        pagination: "none",
        sorting: "none",
      } as any,
    });
    await flushPromises();
    await nextTick();
    const btn = wrapper.find('[data-test="o2-table-column-filter-btn-name"]');
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("aria-label")).toContain("Add filter");
    expect(btn.attributes("aria-label")).toContain("Function name");
  });

  it("names the tree expand toggle and switches it when the row opens", async () => {
    const wrapper = mount(OTable, {
      props: { data: tree, columns, tree: true, pagination: "none", sorting: "none" } as any,
    });
    await flushPromises();
    await nextTick();
    const toggle = wrapper.find('[data-test^="o2-table-tree-toggle"]');
    expect(toggle.exists()).toBe(true);
    expect(toggle.attributes("aria-label")).toBe("Expand");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    await toggle.trigger("click");
    await nextTick();
    expect(toggle.attributes("aria-label")).toBe("Collapse");
    expect(toggle.attributes("aria-expanded")).toBe("true");
  });
});

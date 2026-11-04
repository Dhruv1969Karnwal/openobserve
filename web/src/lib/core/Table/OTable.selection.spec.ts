// Copyright 2026 OpenObserve Inc.

import { describe, it, expect, beforeAll } from "vitest";
import { mount, config, flushPromises } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { raw } from "@/types/i18n";

const messages = {
  en: {
    common: { selectRow: "Select row {name}", remove: "Remove" },
    search: { showing: "Showing", of: "of", recordsPerPage: "Records per page" },
    components: {
      table: { range: "Showing {from} of {total}", selectRow: "Select row {name}" },
      pagination: { pagination: "Pagination", previousPage: "Previous", nextPage: "Next" },
    },
  },
};
const i18n = createI18n({ legacy: false, locale: "en", messages });
beforeAll(() => {
  config.global.plugins.unshift([i18n as any]);
  (globalThis as any).requestAnimationFrame = (cb: any) => cb();
});

import OTable from "./OTable.vue";
import type { OTableColumnDef } from "./OTable.types";

const columns: OTableColumnDef[] = [
  { id: "name", header: "Name", accessorKey: "name" },
  { id: "locked", header: "Locked", accessorKey: "locked" },
];

const rows = [
  { id: "a", name: "alpha", locked: false },
  { id: "b", name: "beta", locked: true },
];

const mountTable = (props: Record<string, unknown> = {}) =>
  mount(OTable, {
    props: {
      data: rows,
      columns,
      rowKey: "id",
      selection: "multiple",
      pagination: "none",
      sorting: "none",
      selectedIds: ["a"],
      ...props,
    } as any,
  });

// A selected row painted only with a 1.36:1 fill is not a usable signal, so the
// shared row must always draw an edge the tint cannot be mistaken for.
describe("OTable selection affordance", () => {
  it("draws the selection edge on the selected row and on no other", async () => {
    const wrapper = mountTable();
    await flushPromises();
    expect(wrapper.find('[data-test="o2-table-row-0"]').classes()).toContain(
      "o2-table-row-selected",
    );
    expect(wrapper.find('[data-test="o2-table-row-1"]').classes()).not.toContain(
      "o2-table-row-selected",
    );
  });

  it("states the selection through the checkbox it owns", async () => {
    const wrapper = mountTable();
    await flushPromises();
    const checked = (i: number) =>
      wrapper
        .find(`[data-test="o2-table-select-${i}"] [role="checkbox"]`)
        .attributes("aria-checked");
    expect(checked(0)).toBe("true");
    expect(checked(1)).toBe("false");
  });

  it("gives a row that refuses selection a reason the checkbox points at", async () => {
    const wrapper = mountTable({
      isRowSelectable: (row: { locked: boolean }) => !row.locked,
      rowSelectionReason: (row: { locked: boolean }) =>
        row.locked ? raw("Managed by SCIM") : undefined,
    });
    await flushPromises();
    const disabled = wrapper.find('[data-test="o2-table-select-1"] [role="checkbox"]');
    expect(disabled.attributes("disabled")).toBeDefined();
    const describedBy = disabled.attributes("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(wrapper.find(`#${describedBy}`).text()).toBe("Managed by SCIM");
    expect(
      wrapper
        .find('[data-test="o2-table-select-0"] [role="checkbox"]')
        .attributes("aria-describedby"),
    ).toBe(undefined);
  });
});

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

import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import DashboardToolbarActions from "./DashboardToolbarActions.vue";
import i18n from "@/locales";

// Reka portals menu content into <body>; render it inline so the rows are queryable.
vi.mock("reka-ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("reka-ui")>();
  return { ...actual, DropdownMenuPortal: actual.DropdownMenuContent };
});

const actions = [
  { id: "settings", label: "Dashboard Settings", icon: "settings" },
  { id: "print", label: "Print Dashboard", icon: "print" },
  { id: "json", label: "Edit Dashboard JSON", icon: "code", disabled: true },
];

const menu = () =>
  mount(DashboardToolbarActions, {
    props: { actions, triggerLabel: "More actions" },
    global: { plugins: [i18n] },
  });

describe("DashboardToolbarActions", () => {
  it("names the trigger and keeps it tabbable", () => {
    const wrapper = menu();
    const trigger = wrapper.find('[data-test="dashboard-more-actions-btn"]');
    expect(trigger.exists()).toBe(true);
    expect(trigger.attributes("aria-label")).toBe("More actions");
    expect((trigger.element as HTMLElement).tabIndex).toBe(0);
  });

  it("renders every row labelled, so no action is an icon alone", async () => {
    const wrapper = menu();
    await wrapper.find('[data-test="dashboard-more-actions-btn"]').trigger("click");
    const rows = wrapper.findAll('[data-test^="dashboard-toolbar-action-"]');
    expect(rows).toHaveLength(actions.length);
    expect(rows.map((r) => r.text().trim())).toEqual([
      "Dashboard Settings",
      "Print Dashboard",
      "Edit Dashboard JSON",
    ]);
    expect(rows.every((r) => r.attributes("role") === "menuitem")).toBe(true);
  });

  it("reports which row was chosen", async () => {
    const wrapper = menu();
    await wrapper.find('[data-test="dashboard-more-actions-btn"]').trigger("click");
    await wrapper.find('[data-test="dashboard-toolbar-action-print"]').trigger("click");
    expect(wrapper.emitted("select")?.at(-1)).toEqual(["print"]);
  });

  it("keeps a disabled row disabled rather than hiding the action", async () => {
    const wrapper = menu();
    await wrapper.find('[data-test="dashboard-more-actions-btn"]').trigger("click");
    const row = wrapper.find('[data-test="dashboard-toolbar-action-json"]');
    expect(row.exists()).toBe(true);
    expect(row.attributes("aria-disabled")).toBe("true");
  });

  it("paints plain rows in flat mode, for a host header's own phone tray", () => {
    const wrapper = mount(DashboardToolbarActions, {
      props: { actions, triggerLabel: "More actions", flat: true },
      global: { plugins: [i18n] },
    });
    expect(wrapper.find('[data-test="dashboard-more-actions-btn"]').exists()).toBe(false);
    const rows = wrapper.findAll('[data-test^="dashboard-toolbar-action-"]');
    expect(rows).toHaveLength(actions.length);
    expect(rows[0].text()).toContain("Dashboard Settings");
  });
});

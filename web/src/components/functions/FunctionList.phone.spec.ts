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

import { queryClient } from "@/composables/query/queryClient";
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import FunctionList from "./FunctionList.vue";
import i18n from "@/locales";
import { createRouter, createWebHistory } from "vue-router";
import { createStore } from "vuex";
import { resetListViewState } from "@/composables/useListViewState";

const { mockJsTransformList } = vi.hoisted(() => ({
  mockJsTransformList: vi.fn(),
}));

vi.mock("@/services/jstransform", () => ({
  default: {
    list: mockJsTransformList,
    delete: vi.fn(),
    bulkDelete: vi.fn(),
    getAssociatedPipelines: vi.fn(),
  },
}));
vi.mock("@/services/product_analytics", () => ({ default: { track: vi.fn() } }));
vi.mock("@/stores", () => ({
  default: { state: { selectedOrganization: { identifier: "test-org" } } },
}));
vi.mock("@/utils/zincutils", () => ({
  getImageURL: vi.fn((url: string) => url),
  verifyOrganizationStatus: vi.fn(),
}));
vi.mock("@/services/reodotdev_analytics", () => ({ useReo: () => ({ track: vi.fn() }) }));
vi.mock("@/composables/useLogs/searchState", () => ({
  default: () => ({ searchObj: { data: { transforms: [] } } }),
}));

describe("FunctionList on a phone", () => {
  let store: any;
  let router: any;

  const mockFunctionData = {
    data: {
      list: [
        {
          name: "redact_pii",
          function: ".",
          language: "vrl",
          num_of_func: 1,
          params: [{ name: "fields", value: "*" }],
          associated_with_streams: ["container_stdout"],
          transType: 0,
        },
        {
          name: "add_geo",
          function: ".geo = 1",
          language: "vrl",
          num_of_func: 1,
          params: [{ name: "table", value: "enrich_ip_geo" }],
          associated_with_streams: ["k8s"],
          transType: 0,
        },
      ],
    },
  };

  const globalStubs = { AddFunction: true, NoData: true, ConfirmDialog: true, ODialog: true };

  const mountList = async () => {
    const wrapper = mount(FunctionList, {
      global: { plugins: [i18n, store, router], stubs: globalStubs },
    });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 80));
    await nextTick();
    return wrapper;
  };

  // The breakpoint composable subscribes once per module instance, so the phone
  // width is pinned for the whole file.
  beforeAll(() => {
    vi.stubGlobal("matchMedia", (query: string) => {
      const match = query.match(/min-width:\s*([\d.]+)rem/);
      const minPx = match ? parseFloat(match[1]) * 16 : 0;
      return {
        matches: 390 >= minPx,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    resetListViewState();
    queryClient.clear();
    mockJsTransformList.mockResolvedValue(mockFunctionData);

    store = createStore({
      state: {
        selectedOrganization: { identifier: "test-org" },
        userInfo: { email: "test@example.com" },
        theme: "light",
      },
    });

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: "/functions", name: "functionList", component: { template: "<div/>" } },
        { path: "/pipelines/editor", name: "pipelineEditor", component: { template: "<div/>" } },
      ],
    });
    await router.push("/functions");
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("shows the list alone until a row is chosen", async () => {
    const wrapper = await mountList();
    expect(wrapper.findAll("tbody tr").length).toBe(2);
    expect(wrapper.find('[data-test="function-detail-panel"]').exists()).toBe(false);
    expect(
      wrapper.find('[data-test^="function-list-name-cell-"][aria-current="true"]').exists(),
    ).toBe(false);
  });

  it("pushes the chosen function over the list, with a way back", async () => {
    const wrapper = await mountList();

    await wrapper.find('[data-test="function-list-name-cell-add_geo"]').trigger("click");
    await nextTick();

    const panel = wrapper.find('[data-test="function-detail-panel"]');
    expect(panel.exists()).toBe(true);
    expect(panel.find('[data-test="function-detail-name"]').text()).toBe("add_geo");
    expect(panel.find('[data-test="function-detail-back"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-test="function-list-name-cell-add_geo"]').attributes("aria-current"),
    ).toBe("true");

    await panel.find('[data-test="function-detail-back"]').trigger("click");
    await nextTick();
    expect(wrapper.find('[data-test="function-detail-panel"]').exists()).toBe(false);
    expect(
      wrapper.find('[data-test^="function-list-name-cell-"][aria-current="true"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-test="function-list-name-cell-add_geo"]').exists()).toBe(true);
  });

  it("opens the pane from the auto-focused first row, without any hover", async () => {
    const wrapper = await mountList();
    expect(wrapper.find('[data-test="function-detail-panel"]').exists()).toBe(false);

    await wrapper.find('[data-test="function-list-name-cell-redact_pii"]').trigger("click");
    await nextTick();

    const panel = wrapper.find('[data-test="function-detail-panel"]');
    expect(panel.exists()).toBe(true);
    expect(panel.find('[data-test="function-detail-name"]').text()).toBe("redact_pii");
    expect(panel.find('[data-test="function-detail-back"]').exists()).toBe(true);
  });

  it("reopens the pane when the same row is chosen again after Back", async () => {
    const wrapper = await mountList();
    await wrapper.find('[data-test="function-list-name-cell-add_geo"]').trigger("click");
    await nextTick();
    await wrapper.find('[data-test="function-detail-back"]').trigger("click");
    await nextTick();
    expect(wrapper.find('[data-test="function-detail-panel"]').exists()).toBe(false);

    await wrapper.find('[data-test="function-list-name-cell-add_geo"]').trigger("click");
    await nextTick();
    expect(wrapper.find('[data-test="function-detail-panel"]').exists()).toBe(true);
  });

  it("pushes the pane that a ?function= deep link names", async () => {
    await router.push({ path: "/functions", query: { function: "add_geo" } });
    const wrapper = await mountList();

    const panel = wrapper.find('[data-test="function-detail-panel"]');
    expect(panel.exists()).toBe(true);
    expect(panel.find('[data-test="function-detail-name"]').text()).toBe("add_geo");
    expect(panel.find('[data-test="function-detail-back"]').exists()).toBe(true);
  });

  it("marks rows as opening a detail and strands no action column", async () => {
    const wrapper = await mountList();
    expect(wrapper.find('[data-test="o2-table-th-actions"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="function-list-row-more-actions"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="function-list-row-open"]').exists()).toBe(true);
    // The applied-in column dropped by the phone column set rides line 2 instead.
    expect(wrapper.find('[data-test="function-list-applied-in"]').text()).toContain(
      "container_stdout",
    );
  });

  it("keeps bulk selection controls on the phone list", async () => {
    const wrapper = await mountList();
    expect(wrapper.find('[data-test="o2-table-th-select"]').exists()).toBe(true);
  });
});

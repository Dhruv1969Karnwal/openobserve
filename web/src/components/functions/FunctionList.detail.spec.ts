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
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import FunctionList from "./FunctionList.vue";
import i18n from "@/locales";
import { createRouter, createWebHistory } from "vue-router";
import { createStore } from "vuex";
import { resetListViewState } from "@/composables/useListViewState";

const { mockJsTransformList, mockGetAssociatedPipelines } = vi.hoisted(() => ({
  mockJsTransformList: vi.fn(),
  mockGetAssociatedPipelines: vi.fn(),
}));

vi.mock("@/services/jstransform", () => ({
  default: {
    list: mockJsTransformList,
    delete: vi.fn(),
    bulkDelete: vi.fn(),
    getAssociatedPipelines: mockGetAssociatedPipelines,
  },
}));
vi.mock("@/lib/feedback/Toast/useToast", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, toast: vi.fn(() => () => {}) };
});
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

describe("FunctionList master–detail", () => {
  let store: any;
  let router: any;

  // The fields the functions endpoint actually serves.
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
          associated_with_streams: ["k8s", "edge_router_access", "container_stdout"],
          transType: 0,
        },
      ],
    },
  };

  const globalStubs = { AddFunction: true, NoData: true, ConfirmDialog: true, ODialog: true };

  const mountList = () =>
    mount(FunctionList, { global: { plugins: [i18n, store, router], stubs: globalStubs } });

  // Past OTable's MIN_SKELETON_MS hold, so the rows exist rather than the skeleton.
  const settle = async () => {
    await flushPromises();
    await new Promise((r) => setTimeout(r, 80));
    await nextTick();
  };

  // The row the table marks as current. Currency belongs to the ROW - its
  // `aria-current`, its `data-active-row` hook and the inset ring that keeps the
  // mark legible without colour - because that is what the row is to a reader and
  // to a stylesheet. A cell inside the row carrying it instead describes the wrong
  // thing, which is how this screen came to mark a row only by a grey fill.
  const currentRow = (wrapper: any) => wrapper.find('tr[aria-current="true"]');
  const currentRowName = (wrapper: any) =>
    ["redact_pii", "add_geo"].find((name) =>
      currentRow(wrapper).find(`[data-test="function-list-name-cell-${name}"]`).exists(),
    ) ?? null;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetListViewState();
    queryClient.clear();
    mockJsTransformList.mockResolvedValue(mockFunctionData);
    mockGetAssociatedPipelines.mockResolvedValue({ data: { list: [] } });

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

  it("opens with the first function already focused, not an empty pane", async () => {
    const wrapper = mountList();
    await settle();

    const panel = wrapper.find('[data-test="function-detail-panel"]');
    expect(panel.exists()).toBe(true);
    expect(panel.text()).toContain("redact_pii");
    expect(wrapper.find('[data-test="function-detail-name"]').text()).toBe("redact_pii");
    expect(currentRowName(wrapper)).toBe("redact_pii");
    expect(wrapper.findAll('tr[aria-current="true"]')).toHaveLength(1);
  });

  it("marks the current row with an edge as well as a fill, so the cue survives colour", async () => {
    // A grey fill alone measured 1.4:1 against white and sat in the same family as
    // hover, which is why raters could not tell a selected row from a pointed-at
    // one. The row's inset ring is the part that reads without colour.
    const wrapper = mountList();
    await settle();

    const row = currentRow(wrapper);
    expect(row.exists()).toBe(true);
    expect(row.attributes("data-active-row")).toBe("true");
    expect(row.classes()).toContain("ring-2");
    expect(row.classes()).toContain("ring-inset");
    // And only one row may claim it, or the mark means nothing.
    expect(wrapper.findAll('tr[data-active-row="true"]')).toHaveLength(1);
  });

  it("shows the focused function's body, params and streams", async () => {
    const wrapper = mountList();
    await settle();

    const panel = wrapper.find('[data-test="function-detail-panel"]');
    expect(panel.find('[data-test="function-detail-body-redact_pii"]').exists()).toBe(true);
    expect(panel.find('[data-test="function-detail-param-fields"]').text()).toContain("*");
    expect(panel.find('[data-test="function-detail-stream-container_stdout"]').exists()).toBe(true);
  });

  it("moves the pane, the row mark and the URL together on selection", async () => {
    const wrapper = mountList();
    await settle();

    await wrapper.find('[data-test="function-list-name-cell-add_geo"]').trigger("click");
    await flushPromises();
    await nextTick();

    expect(wrapper.find('[data-test="function-detail-name"]').text()).toBe("add_geo");
    expect(currentRowName(wrapper)).toBe("add_geo");
    expect(wrapper.findAll('tr[aria-current="true"]')).toHaveLength(1);
    expect(router.currentRoute.value.query.function).toBe("add_geo");
  });

  it("opens on the function a link names", async () => {
    await router.push({ name: "functionList", query: { function: "add_geo" } });
    const wrapper = mountList();
    await settle();

    expect(wrapper.find('[data-test="function-detail-name"]').text()).toBe("add_geo");
  });

  it("keeps the list whole and gives the pane a stated empty when nothing matches", async () => {
    const wrapper = mountList();
    await settle();

    (wrapper.vm as any).filterQuery = "nothing-named-this";
    await nextTick();
    await flushPromises();

    expect(wrapper.findAll("tbody tr")).toHaveLength(0);
    expect(wrapper.find('[data-test="function-detail-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="function-detail-name"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="functions-list-search-input"]').exists()).toBe(true);
  });

  it("names a failed read instead of inviting a first function", async () => {
    mockJsTransformList.mockRejectedValue({ response: { status: 404 } });
    const wrapper = mountList();
    await settle();

    const failed = wrapper.find('[data-test="function-list-error"]');
    expect(failed.exists()).toBe(true);
    expect(failed.text()).toContain("Something went wrong");
    expect(failed.text()).toContain("Retry");
    expect(wrapper.text()).not.toContain("Create your first function");
    // Nothing is knowable about any function, so the pane makes no claim at all.
    expect(wrapper.find('[data-test="function-detail-panel"]').exists()).toBe(false);
  });

  it("renders the pane as a skeleton on the cold read", () => {
    const wrapper = mountList();
    const panel = wrapper.find('[data-test="function-detail-panel"]');
    expect(panel.exists()).toBe(true);
    expect(panel.attributes("aria-busy")).toBe("true");
    expect(wrapper.find('[data-test="function-detail-empty"]').exists()).toBe(false);
  });

  it("counts the streams a function runs on instead of cutting one in half", async () => {
    const wrapper = mountList();
    await settle();

    const cell = wrapper.findAll("tbody tr")[1].find('[data-test="function-list-applied-in"]');
    expect(cell.find('[data-test="function-list-stream-count"]').text()).toBe("3");
    expect(cell.text()).toContain("k8s");
    expect(cell.text()).toContain("edge_router_access");
    expect(cell.find('[data-test="function-list-stream-more"]').text()).toBe("+1");
  });

  it("closes the list region with the streams its own rows carry", async () => {
    const wrapper = mountList();
    await settle();

    const index = wrapper.find('[data-test="functions-stream-index"]');
    expect(index.exists()).toBe(true);
    expect(index.text()).toContain("Where these functions run");
    expect(index.find('[data-test="functions-stream-index-total"]').text()).toBe("3 streams");
    const shared = index
      .findAll('[data-test="functions-stream-index-row"]')
      .find((row) => row.text().includes("container_stdout"));
    expect(shared?.find('[data-test="functions-stream-index-count"]').text()).toBe("2");
  });

  it("draws no pager for a list that already fits one page", async () => {
    const wrapper = mountList();
    await settle();

    expect(wrapper.find('[data-test="o2-table-page-size-select"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="o2-table-next-page-btn"]').exists()).toBe(false);
  });

  it("ends the detail region with its content rather than the frame", async () => {
    const wrapper = mountList();
    await settle();

    const classes = wrapper.find('[data-test="function-detail-panel"]').classes();
    expect(classes).toContain("xl:self-start");
    expect(classes).not.toContain("xl:self-stretch");
    expect(wrapper.find('[data-test="function-detail-section-runs"]').exists()).toBe(true);
  });
});

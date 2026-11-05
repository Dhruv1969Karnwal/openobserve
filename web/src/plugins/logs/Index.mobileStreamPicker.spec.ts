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

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { computed } from "vue";
import { mount, flushPromises } from "@vue/test-utils";

const phone = vi.hoisted(() => ({ isMobile: true }));
vi.mock("@/composables/useBreakpoint", () => ({
  default: () => ({
    isMobile: computed(() => phone.isMobile),
    isTablet: computed(() => false),
    isDesktop: computed(() => !phone.isMobile),
    mdUp: computed(() => !phone.isMobile),
    lgUp: computed(() => !phone.isMobile),
  }),
}));

import Index from "@/plugins/logs/Index.vue";
import i18n from "@/locales";
import store from "@/test/unit/helpers/store";
vi.mock("@/stores", async () => {
  const { default: store } = await import("@/test/unit/helpers/store");
  return { default: store };
});
import router from "@/test/unit/helpers/router";

vi.mock("@/composables/useStreamingSearch", () => ({
  default: () => ({
    fetchQueryDataWithHttpStream: () => Promise.resolve(),
    cancelStreamQueryBasedOnRequestId: vi.fn(),
  }),
}));

vi.mock("@/composables/useLogs/usePatterns", () => ({
  default: () => ({
    extractPatterns: vi.fn().mockResolvedValue(undefined),
    patternsState: { value: { patterns: null, loading: false, error: null, lastQuery: null } },
  }),
  patternsState: { value: { patterns: null, loading: false, error: null, lastQuery: null } },
}));

const node = document.createElement("div");
node.setAttribute("id", "app");
document.body.appendChild(node);

const streams = [
  {
    name: "container_stdout",
    stream_type: "logs",
    schema: [{ name: "_timestamp", type: "Int64" }],
    stats: { doc_num: 1550240, doc_time_max: 1762070400000000 },
    settings: {},
  },
  {
    name: "app_payments",
    stream_type: "logs",
    schema: [{ name: "_timestamp", type: "Int64" }],
    stats: { doc_num: 331900, doc_time_max: 1762070300000000 },
    settings: {},
  },
];

describe("Logs Index: the stream picker on a phone (below md)", { timeout: 60000 }, () => {
  let wrapper: any;

  const trigger = () => wrapper.find('[data-test="logs-mobile-stream-picker"]');

  beforeEach(async () => {
    (store.state as any).logs = { isInitialized: true, logs: {} };
    vi.spyOn(store, "dispatch").mockResolvedValue(undefined as any);
    wrapper = mount(Index, {
      attachTo: "#app",
      global: { provide: { store }, plugins: [i18n, router] },
    });
    await flushPromises();
    const { searchObj } = wrapper.vm;
    searchObj.data.streamResults = { list: streams };
    searchObj.data.stream.streamLists = streams.map((s) => ({ label: s.name, value: s.name }));
    searchObj.data.stream.selectedStream = [];
    searchObj.meta.logsVisualizeToggle = "logs";
    searchObj.data.errorMsg = "";
    searchObj.data.filterErrMsg = "";
    searchObj.loading = false;
    searchObj.loadingStream = false;
    await flushPromises();
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.restoreAllMocks();
  });

  it("renders the picker as a button on the canvas, not only inside the rail", () => {
    expect(wrapper.find('[data-test="logs-search-index-list"]').exists()).toBe(false);
    expect(trigger().exists()).toBe(true);
    expect(trigger().element.tagName).toBe("BUTTON");
    expect(trigger().text()).toBe("Select a stream");
  });

  it("names the chosen stream in the picker so the selection stays visible", async () => {
    wrapper.vm.searchObj.data.stream.selectedStream = ["container_stdout"];
    await flushPromises();
    expect(trigger().text()).toContain("container_stdout");
  });

  it("opens the drawer that carries the stream selector and its stream list", async () => {
    await trigger().trigger("click");
    await flushPromises();
    const drawer = document.querySelector('[data-test="logs-mobile-fields-drawer"]');
    expect(drawer).not.toBeNull();
    expect(
      drawer!.querySelector('[data-test="log-search-index-list-select-stream"]'),
    ).not.toBeNull();
    expect(
      drawer!.querySelectorAll('[data-test^="logs-search-stream-quick-pick-"]').length,
    ).toBeGreaterThan(0);
  });
});

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

// Phone-class HostsPage (app-screens §12): the decision metrics must be on screen,
// not off-canvas columns of a desktop split that never folds.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper, flushPromises } from "@vue/test-utils";
import { createStore } from "vuex";
import { createRouter, createMemoryHistory } from "vue-router";
import { defineComponent, h, ref } from "vue";
import HostsPage from "./HostsPage.vue";
import i18n from "@/locales";

vi.mock("./useHostsList", () => ({
  useHostsList: () => hostsListState,
  utilizationTint: (v: number | null) =>
    v == null ? "" : v >= 90 ? "critical" : v >= 70 ? "warn" : "",
}));

vi.mock("@/composables/useWorkloadDetection", () => ({
  useWorkloadDetection: () => ({ states: workloadStates, refresh: detectionRefresh }),
}));

const makeRow = (over: any = {}) => ({
  host_name: over.host_name ?? "web-01",
  display_name: over.host_name ?? "web-01",
  k8s_node_name: null,
  os_type: "linux",
  status: "ACTIVE",
  cpu: 95,
  memoryPct: 50,
  memoryUsedBytes: 8_000_000_000,
  memoryTotalBytes: 16_000_000_000,
  disk: 45,
  load: 1.5,
  cores: 4,
  loadPerCore: 0.375,
  lastSeen: "2026-09-03 10:00:00",
  lastSeenUs: 1_700_000_890_000_000,
  ...over,
});

const hostsListState = {
  rows: ref<any[]>([]),
  filteredRows: ref<any[]>([]),
  pagedRows: ref<any[]>([]),
  facets: ref<any>({ status: [], os: [] }),
  fleetCount: ref({ total: 0, active: 0 }),
  banners: ref({ liveness: false, lastSeen: false }),
  pageError: ref<string | null>(null),
  nameFilter: ref(""),
  statusFilter: ref<string[]>([]),
  osFilter: ref<string[]>([]),
  sortBy: ref("cpu"),
  sortDesc: ref(true),
  page: ref(1),
  refresh: vi.fn().mockResolvedValue(undefined),
};

const workloadStates = ref<Record<string, string>>({
  hosts: "detected",
  kubernetes: "undetected",
});
const detectionRefresh = vi.fn();

const passthrough = (name: string) =>
  defineComponent({
    name,
    setup(_p: any, { slots }: any) {
      return () => h("div", {}, [slots.default?.(), slots.actions?.(), slots.header?.()]);
    },
  });

const dateTimeStub = defineComponent({
  name: "DateTime",
  emits: ["on:date-change"],
  setup(_p, { expose }) {
    expose({ refresh: vi.fn() });
    return () => h("div", { "data-test": "hosts-datetime-stub" });
  },
});

const drawerStub = {
  name: "HostDetailDrawer",
  props: ["hostName", "displayName", "status", "osType", "range", "lastSeenUs"],
  emits: ["close"],
  template: "<div data-test='host-drawer-stub' :data-host='hostName' />",
};

function seedFleet() {
  const rows = [
    makeRow({ host_name: "web-01", cpu: 95, memoryPct: 75, disk: 45 }),
    makeRow({ host_name: "web-02", cpu: 42, memoryPct: 30, disk: 20 }),
    makeRow({
      host_name: "db-01",
      status: "INACTIVE",
      cpu: null,
      memoryPct: null,
      memoryUsedBytes: null,
      memoryTotalBytes: null,
      disk: null,
      load: null,
    }),
  ];
  hostsListState.rows.value = rows;
  hostsListState.filteredRows.value = rows;
  hostsListState.pagedRows.value = rows;
  hostsListState.fleetCount.value = { total: 3, active: 2 };
  hostsListState.facets.value = {
    status: [
      { value: "ACTIVE", count: 2 },
      { value: "INACTIVE", count: 1 },
    ],
    os: [{ value: "linux", count: 2 }],
  };
}

describe("HostsPage on a phone", () => {
  let wrapper: VueWrapper<any>;
  let router: any;

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

  const mountPage = async (query: Record<string, any> = {}) => {
    const store = createStore({
      state: {
        selectedOrganization: { identifier: "test-org" },
        timezone: "UTC",
        theme: "light",
        zoConfig: {},
        organizationData: {},
        userInfo: { email: "t@e.com" },
      },
    });
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", component: { template: "<div />" } },
        { path: "/infra/hosts", name: "infraHosts", component: { template: "<div />" } },
      ],
    });
    await router.push({ path: "/infra/hosts", query });
    await router.isReady();
    const w = mount(HostsPage, {
      global: {
        plugins: [store, router, i18n],
        stubs: {
          OPageLayout: passthrough("OPageLayout"),
          OPageHeader: passthrough("OPageHeader"),
          DateTime: dateTimeStub,
          HostDetailDrawer: drawerStub,
          DataSourceSetupCard: passthrough("DataSourceSetupCard"),
        },
      },
    });
    await flushPromises();
    return w;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    workloadStates.value = { hosts: "detected", kubernetes: "undetected" };
    hostsListState.banners.value = { liveness: false, lastSeen: false };
    hostsListState.pageError.value = null;
    hostsListState.nameFilter.value = "";
    hostsListState.statusFilter.value = [];
    hostsListState.osFilter.value = [];
    hostsListState.page.value = 1;
    hostsListState.sortBy.value = "cpu";
    hostsListState.sortDesc.value = true;
    seedFleet();
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
  });

  it("shows the deciding metrics on screen instead of off-canvas table columns", async () => {
    wrapper = await mountPage();
    expect(wrapper.find('[data-test="hosts-mobile-list"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="o2-table-root"]').exists()).toBe(false);

    const cpu = wrapper.find('[data-test="hosts-cell-cpu-web-01"]');
    expect(cpu.text()).toContain("95%");
    expect(wrapper.find('[data-test="hosts-bar-cpu-web-01"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="hosts-cell-memory-web-01"]').text()).toContain("75%");
    expect(wrapper.find('[data-test="hosts-cell-disk-web-01"]').text()).toContain("45%");
    expect(wrapper.find('[data-test="hosts-cell-load-web-01"]').text()).toContain("1.50");
    expect(wrapper.find('[data-test="hosts-cell-cores-web-01"]').text()).toContain("4");
    expect(wrapper.find('[data-test="hosts-cell-lastseen-web-01"]').text()).toContain(
      "2026-09-03 10:00:00",
    );
  });

  it("keeps identity and status on every phone row, nulls honest", async () => {
    wrapper = await mountPage();
    const row = wrapper.find('[data-test="hosts-row-web-01"]');
    expect(row.text()).toContain("web-01");
    expect(row.text()).toContain("Active");
    expect(row.attributes("aria-haspopup")).toBe("dialog");

    const dead = wrapper.find('[data-test="hosts-row-db-01"]');
    expect(dead.text()).toContain("Inactive");
    expect(dead.find('[data-test="hosts-cell-cpu-db-01"]').text()).toContain("—");
    expect(dead.find('[data-test="hosts-bar-cpu-db-01"]').exists()).toBe(false);
  });

  it("drills a card down into the existing host detail drawer", async () => {
    wrapper = await mountPage();
    expect(wrapper.find('[data-test="host-drawer-stub"]').exists()).toBe(false);

    await wrapper.find('[data-test="hosts-row-web-02"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.query.host).toBe("web-02");
    expect(wrapper.find('[data-test="host-drawer-stub"]').attributes("data-host")).toBe("web-02");
  });

  it("legends only the bars the phone cards actually draw", async () => {
    wrapper = await mountPage();
    const legend = wrapper.find('[data-test="hosts-usage-legend"]');
    expect(legend.exists()).toBe(true);
    expect(legend.text()).toContain("amber bar at 70%");
    expect(wrapper.findAll('[data-test^="hosts-bar-cpu-"]').length).toBeGreaterThan(0);
  });

  it("filters through chips that name their counts", async () => {
    wrapper = await mountPage();
    const chip = wrapper.find('[data-test="hosts-facet-status-INACTIVE"]');
    expect(chip.text()).toContain("Inactive");
    expect(chip.text()).toContain("1");

    await chip.trigger("click");
    await flushPromises();
    expect(hostsListState.statusFilter.value).toEqual(["INACTIVE"]);
    expect(
      wrapper.find('[data-test="hosts-facet-status-INACTIVE"]').attributes("aria-pressed"),
    ).toBe("true");
  });

  it("pages the card list with labelled controls when the fleet overflows", async () => {
    const rows = Array.from({ length: 51 }, (_, i) => makeRow({ host_name: `h-${i}` }));
    hostsListState.rows.value = rows;
    hostsListState.filteredRows.value = rows;
    hostsListState.pagedRows.value = rows.slice(0, 50);
    wrapper = await mountPage();

    expect(wrapper.find('[data-test="hosts-mobile-prev"]').attributes("disabled")).toBeDefined();
    await wrapper.find('[data-test="hosts-mobile-next"]').trigger("click");
    await flushPromises();
    expect(hostsListState.page.value).toBe(2);
    expect(wrapper.find('[data-test="hosts-mobile-page"]').text()).toContain("2");
  });

  it("keeps the card reachable by keyboard as a real button", async () => {
    wrapper = await mountPage();
    const row = wrapper.find('[data-test="hosts-row-web-01"]');
    expect(row.element.tagName).toBe("BUTTON");
    expect(row.attributes("type")).toBe("button");
  });
});

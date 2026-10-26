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

import { describe, expect, it, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import i18n from "@/locales";
import store from "@/test/unit/helpers/store";
import { useEnterpriseUpgradeDialog } from "@/composables/useEnterpriseUpgradeDialog";

const mockPush = vi.fn();
// A SHARED route object so a spec can put a `?tab=` in place BEFORE the mount —
// the restore under test happens once, in `onMounted`.
const mockRoute: { params: Record<string, any>; query: Record<string, any> } = {
  params: {},
  query: {},
};
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
  useRoute: () => mockRoute,
}));

vi.mock("@/services/alerts", async (importOriginal) => {
  const { overlayServiceMock } = await import("@/test/unit/helpers/mockService");
  return overlayServiceMock(await importOriginal(), {
    default: {
      listByFolderId: vi.fn().mockResolvedValue({
        data: {
          list: [
            { alert_id: "a1", name: "TestAlert", folder_id: "default" },
            { alert_id: "a2", name: "OtherAlert", folder_id: "default" },
          ],
        },
      }),
    },
  });
});

vi.mock("@/composables/useAlertInsights", async () => {
  const { ref } = await import("vue");
  return {
    useAlertInsights: () => ({
      rangeFilters: ref(new Map()),
      showFailedOnly: ref(false),
      showSilencedOnly: ref(false),
      selectedAlertName: ref(null),
      addRangeFilter: vi.fn(),
      removeRangeFilter: vi.fn(),
      clearAllFilters: vi.fn(),
      getBaseFilters: vi.fn().mockReturnValue([]),
    }),
  };
});

vi.mock("@/utils/dashboard/convertDashboardSchemaVersion", () => ({
  convertDashboardSchemaVersion: vi.fn((v) => v),
}));

vi.mock("@/utils/alerts/insights-metrics.json", () => ({
  default: {
    dashboardId: "insights",
    tabs: [
      {
        tabId: "overview",
        panels: [
          {
            id: "p1",
            title: "Overview Panel",
            queries: [
              { query: "SELECT [WHERE_CLAUSE]", fields: { stream: "logs", stream_type: "logs" } },
            ],
          },
        ],
      },
    ],
  },
}));

vi.mock("@/aws-exports", () => ({
  default: { isEnterprise: "false" },
}));

import AlertInsights from "@/components/alerts/AlertInsights.vue";
import alertsService from "@/services/alerts";

async function mountComp(props: Record<string, any> = {}) {
  return mount(AlertInsights, {
    props,
    global: {
      plugins: [i18n, store],
      stubs: {
        RenderDashboardCharts: {
          template: '<div data-test="render-dashboard-stub"></div>',
          props: ["dashboardData", "currentTimeObj", "viewOnly"],
          emits: ["updated:dataZoom", "chart:contextmenu"],
        },
        dateTime: {
          template: '<div data-test="datetime-stub"></div>',
          props: ["defaultType", "defaultAbsoluteTime", "defaultRelativeTime"],
          emits: ["on:date-change", "on:timezone-change"],
        },
        AlertInsightsContextMenu: {
          template: '<div data-test="context-menu-stub"></div>',
          props: ["x", "y", "value", "panelTitle", "panelId"],
          emits: ["close", "filter", "configure-dedup", "edit-alert", "view-history"],
        },
      },
    },
  });
}

describe("AlertInsights - rendering", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders without errors", async () => {
    const w = await mountComp();
    await flushPromises();
    expect(w.exists()).toBe(true);
  });

  it("renders the back button", async () => {
    const w = await mountComp();
    expect(w.find('[data-test="alert-insights-back-btn"]').exists()).toBe(true);
  });

  it("renders the refresh button", async () => {
    const w = await mountComp();
    expect(w.find('[data-test="alert-insights-refresh-btn"]').exists()).toBe(true);
  });

  it("renders the tabs", async () => {
    const w = await mountComp();
    expect(w.find('[data-test="alert-insights-tabs"]').exists()).toBe(true);
  });

  it("renders the overview tab", async () => {
    const w = await mountComp();
    expect(w.find('[data-test="tab-overview"]').exists()).toBe(true);
  });

  it("omits the enterprise tabs entirely when isEnterprise is false", async () => {
    const w = await mountComp();
    expect(w.find('[data-test="tab-frequency"]').exists()).toBe(false);
    expect(w.find('[data-test="tab-correlation"]').exists()).toBe(false);
  });

  /**
   * F-101: the `?tab=` restore used to accept any string the URL carried (it only
   * refused the two locked tabs), so a deep link like `?tab=incidents` became
   * `currentTab`, matched no tab in the insights config, and `loadDashboard` bailed
   * into its no-match branch — an empty insights page under a URL that looked like
   * a working deep link. It is a closed set now, like logs' panel toggle and
   * traces' `?tab=`.
   */
  it.each(["incidents", "overview ", "OVERVIEW", "", "🙃", "__proto__", "toString"])(
    "restores the overview tab instead of adopting the non-tab value %p",
    async (tab) => {
      mockRoute.query = { tab };
      const w = await mountComp();
      await flushPromises();

      expect((w.vm as any).currentTab).toBe("overview");
      // The no-match branch of loadDashboard left EVERY tab in the payload.
      expect((w.vm as any).dashboardData.tabs.map((t: any) => t.tabId)).toEqual(["overview"]);
    },
  );

  it.each([undefined, null, 0, true, {}, [], ["overview"]])(
    "restores the overview tab for a non-string query shape (%#)",
    async (tab) => {
      mockRoute.query = tab === undefined ? {} : { tab };
      const w = await mountComp();
      await flushPromises();

      expect((w.vm as any).currentTab).toBe("overview");
    },
  );

  /** Free tabs round-trip — the closed set is not a blanket reset to overview. */
  it.each(["overview", "quality"])("restores the free tab %s from the URL", async (tab) => {
    mockRoute.query = { tab };
    const w = await mountComp();
    await flushPromises();

    expect((w.vm as any).currentTab).toBe(tab);
  });

  /** Locked-tab defense in depth, now expressed by the same resolver. */
  it.each(["frequency", "correlation"])(
    "refuses the locked tab %s from the URL on the shipped build",
    async (tab) => {
      mockRoute.query = { tab };
      const w = await mountComp();
      await flushPromises();

      expect((w.vm as any).currentTab).toBe("overview");
    },
  );

  /** Entitled mirror: the same links DO land on the paid tabs when unlocked. */
  it.each(["frequency", "correlation"])(
    "restores the paid tab %s from the URL when the feature is entitled",
    async (tab) => {
      const config = await import("@/aws-exports");
      (config.default as any).isEnterprise = "true";
      mockRoute.query = { tab };
      const w = await mountComp();
      await flushPromises();

      expect((w.vm as any).currentTab).toBe(tab);
      (config.default as any).isEnterprise = "false";
    },
  );

  it("keeps the gated tab selected nowhere and opens no dialog when it is forced", async () => {
    const w = await mountComp();
    const { isOpen, close } = useEnterpriseUpgradeDialog();
    close();
    (w.vm as any).onTabsChange("frequency");
    expect(isOpen.value).toBe(false);
    expect((w.vm as any).currentTab).toBe("overview");
  });

  it("renders the quality tab", async () => {
    const w = await mountComp();
    expect(w.find('[data-test="tab-quality"]').exists()).toBe(true);
  });
});

describe("AlertInsights - initial state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts on overview tab", async () => {
    const w = await mountComp();
    expect((w.vm as any).currentTab).toBe("overview");
  });

  it("has isLoading default to false after mount", async () => {
    const w = await mountComp();
    await flushPromises();
    expect((w.vm as any).isLoading).toBe(false);
  });

  it("has show default to true after mount", async () => {
    const w = await mountComp();
    await flushPromises();
    expect((w.vm as any).show).toBe(true);
  });

  it("selectedAlertForAction is null initially", async () => {
    const w = await mountComp();
    expect((w.vm as any).selectedAlertForAction).toBeNull();
  });
});

describe("AlertInsights - fetchAlerts on mount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls alertsService.listByFolderId on mount", async () => {
    await mountComp();
    await flushPromises();
    expect(alertsService.listByFolderId).toHaveBeenCalled();
  });

  it("populates alertsList after mount", async () => {
    const w = await mountComp();
    await flushPromises();
    expect((w.vm as any).alertsList.length).toBeGreaterThan(0);
  });
});

describe("AlertInsights - goBack", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls router.push with alertList", async () => {
    const w = await mountComp();
    (w.vm as any).goBack();
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ name: "alertList" }));
  });

  it("clicking back button calls goBack", async () => {
    const w = await mountComp();
    await w.find('[data-test="alert-insights-back-btn"]').trigger("click");
    expect(mockPush).toHaveBeenCalled();
  });
});

describe("AlertInsights - formatFilterValue", () => {
  it("formats large number as date string", async () => {
    const w = await mountComp();
    const result = (w.vm as any).formatFilterValue(1700000000000000); // microseconds timestamp
    expect(typeof result).toBe("string");
    expect(result).not.toBe("1700000000000000");
  });

  it("formats small number as rounded integer string", async () => {
    const w = await mountComp();
    const result = (w.vm as any).formatFilterValue(42.7);
    expect(result).toBe((43).toLocaleString());
  });
});

describe("AlertInsights - hasActiveFilters", () => {
  it("returns false when no filters active", async () => {
    const w = await mountComp();
    await flushPromises();
    expect((w.vm as any).hasActiveFilters).toBeFalsy();
  });
});

describe("AlertInsights - updateDateTime", () => {
  it("updates timeRange on datetime change", async () => {
    const w = await mountComp();
    await flushPromises();
    const now = Date.now();
    (w.vm as any).updateDateTime({
      startTime: now - 3600000,
      endTime: now,
      relativeTimePeriod: "1h",
    });
    expect((w.vm as any).timeRange.__global.start_time).toBeInstanceOf(Date);
    expect((w.vm as any).timeRange.__global.end_time).toBeInstanceOf(Date);
  });

  it("sets dateTimeType to relative when relativeTimePeriod provided", async () => {
    const w = await mountComp();
    (w.vm as any).updateDateTime({
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
      relativeTimePeriod: "6h",
    });
    expect((w.vm as any).dateTimeType).toBe("relative");
    expect((w.vm as any).relativeTime).toBe("6h");
  });

  it("sets dateTimeType to absolute when no relativeTimePeriod", async () => {
    const w = await mountComp();
    (w.vm as any).updateDateTime({
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
    });
    expect((w.vm as any).dateTimeType).toBe("absolute");
  });
});

describe("AlertInsights - handleViewHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pushes to alertHistory route with alert_name", async () => {
    const w = await mountComp();
    (w.vm as any).handleViewHistory("MyAlert");
    expect(mockPush).toHaveBeenCalledWith({
      name: "alertHistory",
      query: { alert_name: "MyAlert" },
    });
  });
});

describe("AlertInsights - handleEditAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("navigates to alertList with update action when alert found", async () => {
    const w = await mountComp();
    await flushPromises();
    await (w.vm as any).handleEditAlert("TestAlert");
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "alertList",
        query: expect.objectContaining({ action: "update" }),
      }),
    );
  });
});

describe("AlertInsights - handleChartContextMenu", () => {
  it("shows context menu for valid alert panel", async () => {
    const w = await mountComp();
    await flushPromises();
    (w.vm as any).handleChartContextMenu({
      x: 100,
      y: 200,
      value: "TestAlert",
      panelId: "Panel_Alert_Frequency",
      panel: { title: "Alert Frequency" },
    });
    expect((w.vm as any).contextMenu.show).toBe(true);
    expect((w.vm as any).contextMenu.value).toBe("TestAlert");
  });

  it("does not show context menu for non-string value", async () => {
    const w = await mountComp();
    (w.vm as any).handleChartContextMenu({
      x: 100,
      y: 200,
      value: 42,
      panelId: "Panel_Alert_Frequency",
      panel: {},
    });
    expect((w.vm as any).contextMenu.show).toBe(false);
  });

  it("does not show context menu for unrecognized panel", async () => {
    const w = await mountComp();
    (w.vm as any).handleChartContextMenu({
      x: 100,
      y: 200,
      value: "TestAlert",
      panelId: "Panel_Unknown",
      panel: {},
    });
    expect((w.vm as any).contextMenu.show).toBe(false);
  });
});

describe("AlertInsights - action buttons row", () => {
  it("action-buttons-row not visible when selectedAlertForAction is null", async () => {
    const w = await mountComp();
    await flushPromises();
    expect(w.find('[data-test="action-buttons-row"]').exists()).toBe(false);
  });

  it("action-buttons-row visible when selectedAlertForAction is set", async () => {
    const w = await mountComp();
    await flushPromises();
    (w.vm as any).selectedAlertForAction = "TestAlert";
    await w.vm.$nextTick();
    expect(w.find('[data-test="action-buttons-row"]').exists()).toBe(true);
  });
});

describe("AlertInsights - dashboardData loaded on mount", () => {
  it("dashboardData is set after mount", async () => {
    const w = await mountComp();
    await flushPromises();
    expect((w.vm as any).dashboardData).not.toBeNull();
  });
});

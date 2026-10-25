// Copyright 2026 OpenObserve Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import i18n from "@/locales";
import store from "@/test/unit/helpers/store";
import { createRouter, createMemoryHistory } from "vue-router";
import config from "@/aws-exports";
import SearchBar from "@/plugins/logs/SearchBar.vue";
import { resetLogsAutoRunForTests } from "@/composables/useLogs/logsAutoRun";

const { openUpgradeDialog, toastMock, scheduleSearch } = vi.hoisted(() => ({
  openUpgradeDialog: vi.fn(),
  toastMock: vi.fn(),
  scheduleSearch: vi.fn(),
}));

// Flip for the lock-simulated checkFeatureAccess below; the shipped constant is
// read at module load (see helpers/paidFeaturePolicy LIMITATION note), so a
// "lock" build is simulated at the consumer boundary instead.
const policy = vi.hoisted(() => ({ lockSim: false }));

vi.mock("@/composables/useEnterpriseUpgradeDialog", () => ({
  useEnterpriseUpgradeDialog: () => ({
    isOpen: { value: false },
    open: (...args: unknown[]) => openUpgradeDialog(...args),
    close: () => undefined,
  }),
}));

vi.mock("@/utils/enterpriseFeatures", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/enterpriseFeatures")>();
  return {
    ...actual,
    checkFeatureAccess: (key: unknown, ctx: unknown) => {
      const access = actual.checkFeatureAccess(key as never, ctx as never);
      if (!policy.lockSim || access.allowed) return access;
      if (key !== "logPatterns" && key !== "scheduledSearch") return access;
      return { ...access, visible: true };
    },
  };
});

vi.mock("@/services/search", async () => {
  const actual = await vi.importActual<any>("@/services/search");
  return { default: { ...actual.default, schedule_search: scheduleSearch } };
});

vi.mock("@/lib/feedback/Toast/useToast", async () => {
  const actual = await vi.importActual<any>("@/lib/feedback/Toast/useToast");
  return { ...actual, toast: toastMock };
});

vi.mock("@/composables/useLogs/useStreamFields", async () => {
  const actual = await vi.importActual<any>("@/composables/useLogs/useStreamFields");
  return {
    ...actual,
    default: () => ({ ...actual.default(), extractFields: vi.fn(async () => undefined) }),
  };
});

vi.mock("@/composables/useStreams", async () => {
  const actual = await vi.importActual<any>("@/composables/useStreams");
  return {
    ...actual,
    default: (...args: any[]) => ({
      ...actual.default(...args),
      getStreams: vi.fn(async () => ({ list: [{ name: "app_logs", schema: [] }] })),
      getStream: vi.fn(async () => ({ name: "app_logs", schema: [], settings: {} })),
    }),
  };
});

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: "/logs", name: "logs", component: { template: "<div />" } }],
});

describe("SearchBar — paid affordances derive from the registry (F-36)", () => {
  let wrapper: VueWrapper<any> | undefined;
  const originalIsEnterprise = config.isEnterprise;
  const originalZoConfig = { ...store.state.zoConfig };

  const mountSearchBar = async () => {
    const zoCfg: Record<string, unknown> = {
      auto_query_enabled: true,
      query_on_stream_selection: true,
    };
    store.state.zoConfig = { ...originalZoConfig, ...zoCfg };
    wrapper = mount(SearchBar, {
      global: {
        provide: { store },
        plugins: [i18n, router],
        stubs: { QueryEditor: true },
      },
    });
    const { searchObj } = wrapper.vm;
    searchObj.meta.logsVisualizeToggle = "logs";
    searchObj.meta.sqlMode = false;
    searchObj.data.query = "";
    searchObj.data.editorValue = "";
    searchObj.data.stream.selectedStream = ["app_logs"];
    searchObj.data.stream.streamLists = [{ label: "app_logs", value: "app_logs" }];
    await flushPromises();
    return wrapper;
  };

  const viewModeValues = () => wrapper!.vm.toggleViewOptions.map((opt: any) => opt.value);

  beforeEach(() => {
    resetLogsAutoRunForTests();
    policy.lockSim = false;
    toastMock.mockClear();
    openUpgradeDialog.mockClear();
    scheduleSearch.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    policy.lockSim = false;
    (config as any).isEnterprise = originalIsEnterprise;
    store.state.zoConfig = originalZoConfig;
  });

  describe("narrow-viewport view-mode menu (F-36b)", () => {
    it("omits patterns on the shipped hide build (OSS)", async () => {
      await mountSearchBar();
      expect(viewModeValues()).not.toContain("patterns");
    });

    it("shows patterns when the edition unlocks it — menu mirrors the toolbar toggle", async () => {
      (config as any).isEnterprise = "true";
      await mountSearchBar();
      expect(viewModeValues()).toContain("patterns");
      const entry = wrapper!.vm.toggleViewOptions.find((opt: any) => opt.value === "patterns");
      expect(entry.disabled).toBe(false);
    });

    it("restores a locked-but-visible patterns entry when the policy is lock", async () => {
      policy.lockSim = true;
      await mountSearchBar();
      expect(viewModeValues()).toContain("patterns");
    });

    it("keeps patterns visible in the menu when the entitlement unlocks it", async () => {
      policy.lockSim = true;
      (config as any).isEnterprise = "true";
      await mountSearchBar();
      expect(viewModeValues()).toContain("patterns");
    });
  });

  describe("scheduled-search create click (F-36a)", () => {
    it("routes an un-entitled click to the upsell dialog instead of the create flow", async () => {
      policy.lockSim = true;
      await mountSearchBar();
      wrapper!.vm.onScheduleMenuSelect();
      await flushPromises();
      expect(openUpgradeDialog).toHaveBeenCalledTimes(1);
      expect(wrapper!.vm.searchSchedulerJob).toBe(false);
    });

    it("runs the real create flow when the entitlement allows it", async () => {
      policy.lockSim = true;
      (config as any).isEnterprise = "true";
      await mountSearchBar();
      expect(wrapper!.vm.scheduleJobReason).toBeFalsy();
      wrapper!.vm.onScheduleMenuSelect();
      await flushPromises();
      expect(wrapper!.vm.searchSchedulerJob).toBe(true);
      expect(openUpgradeDialog).not.toHaveBeenCalled();
    });

    it("bounces the dialog even on the shipped hide build as defense in depth", async () => {
      await mountSearchBar();
      wrapper!.vm.onScheduleMenuSelect();
      expect(openUpgradeDialog).toHaveBeenCalledTimes(1);
      expect(wrapper!.vm.searchSchedulerJob).toBe(false);
    });
  });
});

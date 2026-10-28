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
import { DEFAULT_LOGS_CONFIG } from "@/utils/logs/constants";

const { openUpgradeDialog, toastMock, scheduleSearch, getViewDetail } = vi.hoisted(() => ({
  openUpgradeDialog: vi.fn(),
  toastMock: vi.fn(),
  scheduleSearch: vi.fn(),
  getViewDetail: vi.fn(),
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

// The saved view a test "applies" is whatever this returns: an org-stored,
// client-writable payload, which is exactly what the boundary exists to police.
vi.mock("@/services/saved_views", async () => {
  const actual = await vi.importActual<any>("@/services/saved_views");
  return { default: { ...actual.default, getViewDetail } };
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
  routes: [
    { path: "/logs", name: "logs", component: { template: "<div />" } },
    // The scheduled-search list click pushes this by name — a spy passes through to the
    // real push, which throws "No match" unless the route is registered.
    {
      path: "/logs/search-scheduler",
      name: "searchScheduler",
      component: { template: "<div />" },
    },
  ],
});

describe("SearchBar — paid affordances derive from the registry", () => {
  let wrapper: VueWrapper<any> | undefined;
  const originalIsEnterprise = config.isEnterprise;
  const originalIsCloud = config.isCloud;
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
    (config as any).isCloud = originalIsCloud;
    store.state.zoConfig = originalZoConfig;
  });

  // The Inspect group now reads the `searchJobInspector` key its route is
  // gated on instead of re-deriving the edition from `config`; the backend
  // `search_inspector_enabled` flag stays the caller-side conjunct. The four cells
  // are the truth table of the raw triple this replaces.
  describe("Search Job Inspector entry reads the registry", () => {
    it.each([
      { label: "OSS with the flag on", ent: "false", cloud: "false", flag: true, want: false },
      {
        label: "self-hosted enterprise with the flag on",
        ent: "true",
        cloud: "false",
        flag: true,
        want: true,
      },
      {
        label: "self-hosted enterprise with the flag off",
        ent: "true",
        cloud: "false",
        flag: false,
        want: false,
      },
      { label: "cloud enterprise", ent: "true", cloud: "true", flag: true, want: false },
    ])(
      "renders the group exactly where the raw triple did: $label",
      async ({ ent, cloud, flag, want }) => {
        (config as any).isEnterprise = ent;
        (config as any).isCloud = cloud;
        const w = await mountSearchBar();
        (store.state.zoConfig as any).search_inspector_enabled = flag;
        await flushPromises();
        expect(w.vm.inspectorVisible).toBe(want);
      },
    );
  });

  describe("narrow-viewport view-mode menu", () => {
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

  describe("scheduled-search create click", () => {
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

    // Handler-level defense, same caveat as the list-item case: the create item
    // lives inside the `v-if="scheduledSearchAccess.visible"` group it belongs to,
    // so under "hide" no DOM click reaches it either.
    it("bounces the dialog from the create handler where hide makes it DOM-unreachable", async () => {
      await mountSearchBar();
      wrapper!.vm.onScheduleMenuSelect();
      expect(openUpgradeDialog).toHaveBeenCalledTimes(1);
      expect(wrapper!.vm.searchSchedulerJob).toBe(false);
    });
  });

  // The list item used to push `searchScheduler` unconditionally — a
  // lock build rendered it allowed while the page's own guard bounced the
  // visit. Same allowed-first guard as the create item now.
  describe("scheduled-search list click", () => {
    it("routes an un-entitled click to the upsell dialog instead of the bounce", async () => {
      policy.lockSim = true;
      const pushSpy = vi.spyOn(router, "push");
      await mountSearchBar();
      wrapper!.vm.onScheduleListMenuSelect();
      await flushPromises();
      expect(openUpgradeDialog).toHaveBeenCalledTimes(1);
      expect(pushSpy).not.toHaveBeenCalled();
      pushSpy.mockRestore();
    });

    it("opens the list route when the entitlement allows it", async () => {
      policy.lockSim = true;
      (config as any).isEnterprise = "true";
      const pushSpy = vi.spyOn(router, "push");
      await mountSearchBar();
      wrapper!.vm.onScheduleListMenuSelect();
      await flushPromises();
      expect(pushSpy).toHaveBeenCalledWith(expect.objectContaining({ name: "searchScheduler" }));
      expect(openUpgradeDialog).not.toHaveBeenCalled();
      pushSpy.mockRestore();
    });

    // Handler-level defense, not a shipped interaction: under "hide" the whole
    // schedule group sits behind `v-if="scheduledSearchAccess.visible"`, so no DOM
    // click can reach this — the real hide-build `open()` is the no-op that fires
    // reportLockedAffordanceUnderHide (useEnterpriseUpgradeDialog.ts).
    it("bounces the dialog from the handler even where hide makes it DOM-unreachable", async () => {
      const pushSpy = vi.spyOn(router, "push");
      await mountSearchBar();
      wrapper!.vm.onScheduleListMenuSelect();
      expect(openUpgradeDialog).toHaveBeenCalledTimes(1);
      expect(pushSpy).not.toHaveBeenCalled();
      pushSpy.mockRestore();
    });

    /**
     * Template-level wiring, proven through the rendered menu (its content is
     * teleported, hence the document lookup) instead of the exposed method.
     */
    it("routes the rendered list item's click to the dialog, not to the bounce", async () => {
      policy.lockSim = true;
      const pushSpy = vi.spyOn(router, "push");
      await mountSearchBar();
      await wrapper!.get('[data-test="logs-search-bar-more-options-btn"]').trigger("click");
      await flushPromises();
      const item = document.querySelector<HTMLElement>('[data-test="search-scheduler-list-btn"]');
      expect(item).not.toBeNull();
      item!.click();
      await flushPromises();
      expect(openUpgradeDialog).toHaveBeenCalledTimes(1);
      expect(pushSpy).not.toHaveBeenCalled();
      pushSpy.mockRestore();
    });

    it("lets the rendered list item navigate once the entitlement allows it", async () => {
      policy.lockSim = true;
      (config as any).isEnterprise = "true";
      const pushSpy = vi.spyOn(router, "push");
      await mountSearchBar();
      await wrapper!.get('[data-test="logs-search-bar-more-options-btn"]').trigger("click");
      await flushPromises();
      document.querySelector<HTMLElement>('[data-test="search-scheduler-list-btn"]')!.click();
      await flushPromises();
      expect(pushSpy).toHaveBeenCalledWith(expect.objectContaining({ name: "searchScheduler" }));
      expect(openUpgradeDialog).not.toHaveBeenCalled();
      pushSpy.mockRestore();
    });
  });

  /**
   * The e2e locked-state oracle (`tests/ui-testing/playwright-tests/Logs/logsActionReasons.spec.js`)
   * counted `search-scheduler-locked-icon`, the label-action glyph this wave deleted. The group
   * now names itself per entitlement so that oracle has one hook to read in every build.
   */
  describe("scheduled-search menu group hook", () => {
    const openMoreMenu = async () => {
      await mountSearchBar();
      await wrapper!.get('[data-test="logs-search-bar-more-options-btn"]').trigger("click");
      await flushPromises();
    };
    const hook = (name: string) => document.querySelector(`[data-test="${name}"]`);

    it("renders no schedule group hook on the shipped hide build", async () => {
      await openMoreMenu();
      expect(hook("search-scheduler-menu-group")).toBeNull();
      expect(hook("search-scheduler-menu-group-locked")).toBeNull();
      expect(hook("search-scheduler-list-btn")).toBeNull();
    });

    it("names the rendered group '-locked' where the policy keeps it visible but refused", async () => {
      policy.lockSim = true;
      await openMoreMenu();
      expect(hook("search-scheduler-menu-group")).toBeNull();
      expect(hook("search-scheduler-menu-group-locked")).not.toBeNull();
    });

    it("names the rendered group without the suffix once the entitlement allows it", async () => {
      (config as any).isEnterprise = "true";
      await openMoreMenu();
      expect(hook("search-scheduler-menu-group")).not.toBeNull();
      expect(hook("search-scheduler-menu-group-locked")).toBeNull();
    });
  });
});

/**
 * The saved-view boundary WITH ITS WIRING: these cells drive the only production
 * caller of `sanitizeSearchSnapshotMeta` (`SearchBar.applySavedView`) through a
 * mounted SearchBar and assert on the paid UI that caller feeds. Deleting the
 * sanitizer call at the call site goes red HERE, not just in the unit spec — the
 * unit spec proves the function, this proves the app calls it.
 */
describe("SearchBar — a stored view cannot open paid UI through the apply path", () => {
  let wrapper: VueWrapper<any> | undefined;
  const originalIsEnterprise = config.isEnterprise;
  const originalIsCloud = config.isCloud;
  const originalZoConfig = { ...store.state.zoConfig };

  // NO QueryEditor stub on purpose: the claim under test is that the paid Ask-AI
  // bar is absent from the DOM, which needs the real component's `v-if`.
  const mountOnLogsRoute = async (extraZoConfig: Record<string, unknown> = {}) => {
    await router.push({ name: "logs" });
    const zoCfg: Record<string, unknown> = {
      auto_query_enabled: false,
      query_on_stream_selection: false,
      ...extraZoConfig,
    };
    store.state.zoConfig = { ...originalZoConfig, ...zoCfg };
    wrapper = mount(SearchBar, {
      global: { provide: { store }, plugins: [i18n, router] },
    });
    const { searchObj } = wrapper.vm;
    searchObj.meta.logsVisualizeToggle = "logs";
    searchObj.meta.sqlMode = false;
    searchObj.data.query = "";
    searchObj.data.editorValue = "";
    searchObj.data.stream.selectedStream = ["app_logs"];
    searchObj.data.stream.streamLists = [{ label: "app_logs", value: "app_logs" }];
    wrapper.vm.autoRun.setExecutors({ logs: vi.fn(), patterns: vi.fn(), histogram: vi.fn() });
    await flushPromises();
    await vi.waitFor(() => expect(wrapper!.html()).toContain("logs-search-bar-query-editor"), {
      timeout: 5000,
    });
    return wrapper;
  };

  /**
   * What an entitled build used to store (a legacy view), or what anyone who can
   * write to the org's saved views can store today. A fresh object per call, and
   * none of them is ever written by the boundary — it returns a sanitized COPY, so a
   * second apply of the same object sees the payload exactly as it was stored.
   */
  const paidStateView = () => ({
    meta: {
      nlpMode: true,
      showSearchScheduler: true,
      logsVisualizeToggle: "patterns",
      jobId: "job-of-another-session",
      jobRecords: "250000",
      showHistogram: true,
      sqlMode: true,
    },
    data: {
      stream: { selectedStream: ["app_logs"], selectedFields: [] },
      resultGrid: { columns: [] },
      query: "SELECT * FROM app_logs",
      editorValue: "SELECT * FROM app_logs",
      tempFunctionContent: "",
      datetime: { type: "relative", relativeTimePeriod: "15m" },
    },
  });

  const applyView = async () => {
    getViewDetail.mockResolvedValueOnce({ status: 200, data: { data: paidStateView() } });
    wrapper!.vm.dateTimeRef = { setSavedDate: vi.fn() };
    await wrapper!.vm.applySavedView({ view_id: "v1", view_name: "legacy view" });
    await flushPromises();
  };

  beforeEach(() => {
    resetLogsAutoRunForTests();
    policy.lockSim = false;
    getViewDetail.mockReset();
    toastMock.mockClear();
    localStorage.clear();
  });

  afterEach(async () => {
    wrapper?.unmount();
    wrapper = undefined;
    policy.lockSim = false;
    (config as any).isEnterprise = originalIsEnterprise;
    (config as any).isCloud = originalIsCloud;
    store.state.zoConfig = originalZoConfig;
    // The editor region is `v-if`-ed on the logs route; leave it un-satisfied so a
    // later cell cannot measure a DOM it did not ask for.
    await router.push({ name: "searchScheduler" });
  });

  it("renders no Ask-AI bar when a stored view claims nlpMode on a hide build", async () => {
    const w = await mountOnLogsRoute();
    await applyView();

    // The editor is on screen (the cell is not measuring an unmounted subtree)…
    expect(w.html()).toContain("logs-search-bar-query-editor");
    // …and the paid bar its `nlpMode` prop drives is not.
    expect(w.html()).not.toContain("logs-search-bar-ai-input-bar");
    expect(w.vm.searchObj.meta.nlpMode).toBe(false);
  });

  /** The refusal above is a coercion, not an unmount: entitled keeps what it saved. */
  it("renders the Ask-AI bar for an org that has the assistant", async () => {
    (config as any).isEnterprise = "true";
    const w = await mountOnLogsRoute({ ai_enabled: true });
    await applyView();

    await vi.waitFor(() => expect(w.html()).toContain("ai-input-bar"), { timeout: 5000 });
    expect(w.vm.searchObj.meta.nlpMode).toBe(true);
  });

  /** The entitled mirror is the assistant's OWN conjunct: edition without the
   * `ai_enabled` runtime toggle is a build where the bar is not offered at all. */
  it("renders no Ask-AI bar for an entitled org that has the assistant switched off", async () => {
    (config as any).isEnterprise = "true";
    const w = await mountOnLogsRoute();
    await applyView();

    expect(w.html()).not.toContain("logs-search-bar-ai-input-bar");
    expect(w.vm.searchObj.meta.nlpMode).toBe(false);
  });

  it("opens no scheduled-search dialog and no patterns panel from a stored flag", async () => {
    const w = await mountOnLogsRoute();
    await applyView();

    expect(w.vm.searchSchedulerJob).toBe(false);
    expect(w.vm.searchObj.meta.showSearchScheduler).toBe(false);
    expect(w.vm.searchObj.meta.logsVisualizeToggle).toBe("logs");
  });

  /**
   * The job context is NOT execution-neutral on a free build: a payload `jobId`
   * re-points the next search at the scheduled-result endpoint (which the OSS backend
   * answers 403) and the two `immediate` watchers in this component turn it into
   * visible UI, one of them shutting the free histogram panel. So it is reset here,
   * and the toast that announces scheduled-search state never fires.
   */
  it("drops the job context a stored view carried, and the UI state it announces", async () => {
    const w = await mountOnLogsRoute();
    await applyView();

    expect(w.vm.searchObj.meta.jobId).toBe("");
    expect(w.vm.searchObj.meta.jobRecords).toBe(DEFAULT_LOGS_CONFIG.meta.jobRecords);
    expect(w.vm.searchObj.meta.showHistogram).toBe(true);
    const jobToasts = toastMock.mock.calls
      .map((call: any[]) => String(call?.[0]?.message ?? ""))
      .filter((message: string) => /job|scheduled/i.test(message));
    expect(jobToasts).toEqual([]);
  });

  /** The entitled mirror: an org with scheduled search keeps the job it saved. */
  it("keeps the job context for an org that has scheduled search", async () => {
    (config as any).isEnterprise = "true";
    const w = await mountOnLogsRoute();
    await applyView();

    expect(w.vm.searchObj.meta.jobId).toBe("job-of-another-session");
    expect(w.vm.searchObj.meta.jobRecords).toBe("250000");
  });

  /** What the view IS entitled to persist stays intact — the reset is not a wipe. */
  it("still restores the free state of the same view", async () => {
    const w = await mountOnLogsRoute();
    await applyView();

    expect(w.vm.searchObj.meta.sqlMode).toBe(true);
    expect(w.vm.searchObj.data.query).toBe("SELECT * FROM app_logs");
  });
});

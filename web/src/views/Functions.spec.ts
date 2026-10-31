// Copyright 2026 OpenObserve Inc.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createStore } from "vuex";
import { createRouter, createWebHistory } from "vue-router";
import { createI18n } from "vue-i18n";
import config from "@/aws-exports";
import Functions from "./Functions.vue";

// Mock heavy child components that are not under test
vi.mock("@/lib/core/PageHeader/OPageHeader.vue", () => ({
  default: {
    name: "OPageHeader",
    template:
      '<div class="app-page-header" data-test="app-page-header"><slot name="tabs" /><slot name="title-trail" /><slot name="actions" /></div>',
    props: ["title", "subtitle", "icon", "back", "tabsBelow"],
  },
}));

vi.mock("@/components/pipeline/PipelineSectionTabs.vue", () => ({
  default: {
    name: "PipelineSectionTabs",
    template: '<div class="pipeline-section-tabs" />',
  },
}));

vi.mock("@/plugins/pipelines/useDnD", () => ({
  pipelineObj: {
    currentSelectedPipeline: { name: "" },
  },
}));

vi.mock("@/aws-exports", () => ({
  default: {
    isEnterprise: "false",
    isCloud: "false",
  },
}));

// The shipped PAID_FEATURE_POLICY is fixed at module load (see
// helpers/paidFeaturePolicy LIMITATION), so a "lock" build is simulated at the
// consumer boundary — same pattern as SearchBar.paidAffordances.spec.ts.
const policy = vi.hoisted(() => ({ lockSim: false }));

vi.mock("@/utils/enterpriseFeatures", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/enterpriseFeatures")>();
  return {
    ...actual,
    checkFeatureAccess: (key: unknown, ctx: unknown) => {
      const access = actual.checkFeatureAccess(key as never, ctx as never);
      if (!policy.lockSim || access.allowed || key !== "pipelineBackfill") return access;
      return { ...access, visible: true };
    },
  };
});

vi.mock("@/lib/core/Button/OButton.vue", () => ({
  default: {
    name: "OButton",
    template:
      "<button :data-test=\"$attrs['data-test']\" @click=\"$emit('click', $event)\"><slot /></button>",
    props: ["variant", "size", "iconLeft", "disabled"],
    emits: ["click"],
  },
}));

vi.mock("@/lib/overlay/Dropdown/ODropdown.vue", () => ({
  default: {
    name: "ODropdown",
    template: '<div class="o-dropdown"><slot name="trigger" /><slot /></div>',
    props: ["align"],
  },
}));

vi.mock("@/lib/overlay/Dropdown/ODropdownItem.vue", () => ({
  default: {
    name: "ODropdownItem",
    template: "<div :data-test=\"$attrs['data-test']\" @click=\"$emit('select')\"><slot /></div>",
    emits: ["select"],
  },
}));

describe("Functions.vue", () => {
  let wrapper: any;
  let store: any;
  let router: any;
  let i18n: any;

  const createWrapper = async (storeStateOverride = {}, routeName = "pipelines") => {
    store = createStore({
      state: {
        selectedOrganization: {
          identifier: "test-org-id",
          name: "Test Organization",
        },
        zoConfig: {
          custom_hide_menus: "",
        },
        ...storeStateOverride,
      },
      getters: {},
      mutations: {},
      actions: {},
    });

    i18n = createI18n({
      legacy: false,
      locale: "en",
      fallbackLocale: "en",
      globalInjection: true,
      messages: {
        en: {
          function: {
            streamPipeline: "Stream Pipeline",
            header: "Functions",
            enrichmentTables: "Enrichment Tables",
          },
          menu: { pipeline: "Pipeline" },
          pipeline: {
            subtitle: "Manage pipelines",
            addPipeline: "Add Pipeline",
            history: "History",
            import: "Import",
            backfill: "Backfill",
            evalTemplates: "Eval Templates",
            pipelineName: "Pipeline Name",
          },
        },
      },
    });

    router = createRouter({
      history: createWebHistory(),
      routes: [
        {
          path: "/",
          name: "home",
          component: { template: "<div>Home</div>" },
        },
        {
          path: "/pipelines",
          name: "pipelines",
          component: { template: "<div>Pipelines</div>" },
        },
        {
          path: "/pipeline",
          name: "pipeline",
          component: { template: "<div>Pipeline</div>" },
        },
        {
          path: "/functions",
          name: "functionList",
          component: { template: "<div>Functions</div>" },
        },
        {
          path: "/enrichment",
          name: "enrichmentTables",
          component: { template: "<div>Enrichment</div>" },
        },
        {
          path: "/pipeline/editor",
          name: "pipelineEditor",
          component: { template: "<div>Editor</div>" },
        },
        {
          path: "/pipeline/create",
          name: "createPipeline",
          component: { template: "<div>Create</div>" },
        },
        {
          path: "/pipeline/import",
          name: "importPipeline",
          component: { template: "<div>Import</div>" },
        },
        {
          path: "/pipeline/history",
          name: "pipelineHistory",
          component: { template: "<div>History</div>" },
        },
        {
          path: "/pipeline/backfill",
          name: "pipelineBackfill",
          component: { template: "<div>Backfill</div>" },
        },
        {
          path: "/eval",
          name: "evalTemplates",
          component: { template: "<div>Eval</div>" },
        },
      ],
    });

    await router.push({ name: routeName, query: { org_identifier: "test-org-id" } });

    return mount(Functions, {
      global: {
        plugins: [store, router, i18n],
        stubs: {
          RouterView: {
            name: "RouterView",
            template: '<div class="mock-router-view" />',
          },
        },
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("Component Initialization", () => {
    it("should render the component without errors", async () => {
      wrapper = await createWrapper();
      expect(wrapper.exists()).toBe(true);
    });

    it("should initialize activeTab based on current route", async () => {
      wrapper = await createWrapper({}, "functionList");
      expect((wrapper.vm as any).activeTab).toBe("functions");
    });

    it("should initialize activeTab to streamPipelines for pipelines route", async () => {
      wrapper = await createWrapper({}, "pipelines");
      expect((wrapper.vm as any).activeTab).toBe("streamPipelines");
    });

    it("should expose store on the component instance", async () => {
      wrapper = await createWrapper();
      expect((wrapper.vm as any).store).toBeDefined();
    });
  });

  describe("Header visibility", () => {
    it("should show OPageHeader when on pipelines route", async () => {
      wrapper = await createWrapper({}, "pipelines");
      const header = wrapper.find('[data-test="app-page-header"]');
      expect(header.exists()).toBe(true);
    });

    it("should not show OPageHeader when on functionList route", async () => {
      wrapper = await createWrapper({}, "functionList");
      const header = wrapper.find('[data-test="app-page-header"]');
      expect(header.exists()).toBe(false);
    });

    it("should show header on detail view routes like pipelineEditor", async () => {
      wrapper = await createWrapper({}, "pipelineEditor");
      const header = wrapper.find('[data-test="app-page-header"]');
      expect(header.exists()).toBe(true);
    });
  });

  describe("Pipeline actions buttons", () => {
    it("should show add pipeline button on pipelines route", async () => {
      wrapper = await createWrapper({}, "pipelines");
      const addBtn = wrapper.find('[data-test="pipeline-list-add-pipeline-btn"]');
      expect(addBtn.exists()).toBe(true);
    });

    it("should show history button on pipelines route when window is wide", async () => {
      Object.defineProperty(window, "innerWidth", { value: 1920, writable: true });
      wrapper = await createWrapper({}, "pipelines");
      const historyBtn = wrapper.find('[data-test="pipeline-list-history-btn"]');
      expect(historyBtn.exists()).toBe(true);
    });

    it("should not show pipeline actions on functionList route", async () => {
      wrapper = await createWrapper({}, "functionList");
      const addBtn = wrapper.find('[data-test="pipeline-list-add-pipeline-btn"]');
      expect(addBtn.exists()).toBe(false);
    });
  });

  describe("Backfill entry gate", () => {
    const originalIsEnterprise = (config as any).isEnterprise;
    const originalIsCloud = (config as any).isCloud;
    const originalInnerWidth = window.innerWidth;

    const setViewport = (width: number) => {
      Object.defineProperty(window, "innerWidth", { value: width, writable: true });
    };

    afterEach(() => {
      (config as any).isEnterprise = originalIsEnterprise;
      (config as any).isCloud = originalIsCloud;
      policy.lockSim = false;
      setViewport(originalInnerWidth);
    });

    /** The shipped build: the entry the paid page is reached through does not render. */
    it("omits the toolbar entry on the shipped OSS build", async () => {
      setViewport(1920);
      wrapper = await createWrapper({}, "pipelines");
      expect(wrapper.find('[data-test="pipeline-list-backfill-btn"]').exists()).toBe(false);
    });

    it("omits the overflow entry on the shipped OSS build", async () => {
      setViewport(1024);
      wrapper = await createWrapper({}, "pipelines");
      expect(wrapper.find('[data-test="pipeline-list-menu-backfill-btn"]').exists()).toBe(false);
    });

    /** Entitled: both halves of the same action (wide group + collapsed menu) come back. */
    it("renders the toolbar entry on an entitled build", async () => {
      setViewport(1920);
      (config as any).isEnterprise = "true";
      wrapper = await createWrapper({}, "pipelines");
      expect(wrapper.find('[data-test="pipeline-list-backfill-btn"]').exists()).toBe(true);
    });

    it("renders the overflow entry on an entitled build", async () => {
      setViewport(1024);
      (config as any).isEnterprise = "true";
      wrapper = await createWrapper({}, "pipelines");
      expect(wrapper.find('[data-test="pipeline-list-menu-backfill-btn"]').exists()).toBe(true);
    });

    /** The key is `cloudOffers: false` — Cloud sells neither the entry nor the page. */
    it("omits the entry on a pure-cloud build", async () => {
      setViewport(1920);
      (config as any).isCloud = "true";
      wrapper = await createWrapper({}, "pipelines");
      expect(wrapper.find('[data-test="pipeline-list-backfill-btn"]').exists()).toBe(false);
    });

    /**
     * The `lock` contract, and the point where the registry and the raw
     * `config.isEnterprise` check this entry used to read diverge: a
     * visible-but-locked entry whose click the route gate turns into the
     * locked page, instead of an affordance that silently never renders.
     */
    it("shows the entry as a locked affordance on an un-entitled lock build", async () => {
      setViewport(1920);
      policy.lockSim = true;
      wrapper = await createWrapper({}, "pipelines");
      expect(wrapper.find('[data-test="pipeline-list-backfill-btn"]').exists()).toBe(true);
    });

    /** Only the literal "true" unlocks, exactly as the registry predicate compares it. */
    it.each(["", "TRUE", "1", "yes"])("treats isEnterprise=%p as OSS", async (value) => {
      setViewport(1920);
      (config as any).isEnterprise = value;
      wrapper = await createWrapper({}, "pipelines");
      expect(wrapper.find('[data-test="pipeline-list-backfill-btn"]').exists()).toBe(false);
    });

    it("pushes the registry-gated route from the entry", async () => {
      setViewport(1920);
      (config as any).isEnterprise = "true";
      wrapper = await createWrapper({}, "pipelines");
      const pushSpy = vi.spyOn(router, "push");
      await wrapper.find('[data-test="pipeline-list-backfill-btn"]').trigger("click");
      expect(pushSpy).toHaveBeenCalledWith({
        name: "pipelineBackfill",
        query: { org_identifier: "test-org-id" },
      });
      pushSpy.mockRestore();
    });
  });

  describe("Route Handling", () => {
    it("should redirect from pipeline route to pipelines on mount", async () => {
      // The component calls redirectRoute in onBeforeMount; router.replace happens during mount
      const replaceSpy = vi.fn();
      // We verify indirectly: starting on 'pipeline' route triggers replace to 'pipelines'
      // Because router.replace is called during mount we set up spy before createWrapper
      router = createRouter({
        history: createWebHistory(),
        routes: [
          { path: "/", name: "home", component: { template: "<div />" } },
          { path: "/pipelines", name: "pipelines", component: { template: "<div />" } },
          { path: "/pipeline", name: "pipeline", component: { template: "<div />" } },
          { path: "/functions", name: "functionList", component: { template: "<div />" } },
          { path: "/enrichment", name: "enrichmentTables", component: { template: "<div />" } },
          { path: "/pipeline/editor", name: "pipelineEditor", component: { template: "<div />" } },
          { path: "/pipeline/create", name: "createPipeline", component: { template: "<div />" } },
          { path: "/pipeline/import", name: "importPipeline", component: { template: "<div />" } },
          {
            path: "/pipeline/history",
            name: "pipelineHistory",
            component: { template: "<div />" },
          },
          {
            path: "/pipeline/backfill",
            name: "pipelineBackfill",
            component: { template: "<div />" },
          },
          { path: "/eval", name: "evalTemplates", component: { template: "<div />" } },
        ],
      });
      await router.push({ name: "pipeline", query: { org_identifier: "test-org-id" } });
      vi.spyOn(router, "replace").mockImplementation(replaceSpy);

      wrapper = mount(Functions, {
        global: {
          plugins: [store, router, i18n],
          stubs: {
            RouterView: { name: "RouterView", template: '<div class="mock-router-view" />' },
          },
        },
      });

      expect(replaceSpy).toHaveBeenCalledWith({
        name: "pipelines",
        query: { org_identifier: "test-org-id" },
      });
    });
  });

  describe("Event Handling", () => {
    it("should emit sendToAiChat event when sendToAiChat method is called", async () => {
      wrapper = await createWrapper();

      const testValue = { message: "test message" };
      (wrapper.vm as any).sendToAiChat(testValue);

      expect(wrapper.emitted("sendToAiChat")).toBeTruthy();
      expect(wrapper.emitted("sendToAiChat")?.[0]).toEqual([testValue, false]);
    });

    it("should emit sendToAiChat with append=true when second arg is true", async () => {
      wrapper = await createWrapper();

      const testValue = { message: "test" };
      (wrapper.vm as any).sendToAiChat(testValue, true);

      expect(wrapper.emitted("sendToAiChat")?.[0]).toEqual([testValue, true]);
    });
  });

  describe("Computed Properties", () => {
    it("should compute routeName from current route", async () => {
      wrapper = await createWrapper({}, "pipelines");
      expect((wrapper.vm as any).routeName).toBe("pipelines");
    });

    it("should compute showPipelineActions as true on pipelines route", async () => {
      wrapper = await createWrapper({}, "pipelines");
      expect((wrapper.vm as any).showPipelineActions).toBe(true);
    });

    it("should compute showPipelineActions as false on functionList route", async () => {
      wrapper = await createWrapper({}, "functionList");
      expect((wrapper.vm as any).showPipelineActions).toBe(false);
    });

    it("should compute isDetailView as true for pipelineEditor", async () => {
      wrapper = await createWrapper({}, "pipelineEditor");
      expect((wrapper.vm as any).isDetailView).toBe(true);
    });

    it("should compute isDetailView as false for pipelines", async () => {
      wrapper = await createWrapper({}, "pipelines");
      expect((wrapper.vm as any).isDetailView).toBe(false);
    });
  });

  describe("Store Integration", () => {
    it("should access store state correctly", async () => {
      wrapper = await createWrapper();
      expect((wrapper.vm as any).store.state.selectedOrganization.identifier).toBe("test-org-id");
    });

    it("should handle missing organization identifier gracefully", async () => {
      wrapper = await createWrapper({
        selectedOrganization: { identifier: "", name: "Test" },
      });
      expect((wrapper.vm as any).store.state.selectedOrganization.identifier).toBe("");
    });

    it("should handle undefined zoConfig without errors", async () => {
      wrapper = await createWrapper({ zoConfig: undefined });
      expect(wrapper.exists()).toBe(true);
    });
  });

  describe("RouterView Integration", () => {
    it("should render RouterView", async () => {
      wrapper = await createWrapper();
      const routerView = wrapper.find(".mock-router-view");
      expect(routerView.exists()).toBe(true);
    });
  });

  describe("Active tab update on route change", () => {
    it("should update activeTab when route changes to enrichmentTables", async () => {
      wrapper = await createWrapper({}, "pipelines");
      expect((wrapper.vm as any).activeTab).toBe("streamPipelines");

      await router.push({ name: "enrichmentTables", query: { org_identifier: "test-org-id" } });
      await wrapper.vm.$nextTick();

      expect((wrapper.vm as any).activeTab).toBe("enrichmentTables");
    });

    it("should call router.replace when route watcher fires on pipeline route", async () => {
      wrapper = await createWrapper({}, "pipelines");
      const routerReplaceSpy = vi.spyOn(router, "replace").mockImplementation(vi.fn());

      await router.push({ name: "pipeline" });
      await wrapper.vm.$nextTick();

      expect(routerReplaceSpy).toHaveBeenCalledWith(expect.objectContaining({ name: "pipelines" }));
    });
  });

  describe("Component Cleanup", () => {
    it("should unmount without errors", async () => {
      wrapper = await createWrapper();
      expect(() => wrapper.unmount()).not.toThrow();
    });
  });
});

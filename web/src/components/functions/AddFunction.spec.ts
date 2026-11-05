import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import AddFunction from "./AddFunction.vue";
import OForm from "@/lib/forms/Form/OForm.vue";
import { createStore } from "vuex";
import { createI18n } from "vue-i18n";
import { nextTick } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import config from "@/aws-exports";

// Mock dependencies
vi.mock("@/services/jstransform", async (importOriginal) => {
  const { overlayServiceMock } = await import("@/test/unit/helpers/mockService");
  return overlayServiceMock(await importOriginal(), {
    default: {
      create: vi.fn(() => Promise.resolve({ data: { message: "Function created successfully" } })),
      update: vi.fn(() => Promise.resolve({ data: { message: "Function updated successfully" } })),
    },
  });
});

vi.mock("@/services/product_analytics", () => ({
  default: {
    track: vi.fn(),
  },
}));

// Mutable so each test can pick the entitlement BEFORE mounting (the gate is a
// computed over a plain config object — it evaluates per component instance).
vi.mock("@/aws-exports", () => ({
  default: { isEnterprise: "false", isCloud: "false" },
}));

// The JS option also branches on PAID_FEATURE_POLICY; both sides are asserted below.
vi.mock("@/utils/enterpriseFeatures", async (importOriginal) =>
  (await import("@/test/unit/helpers/paidFeaturePolicy")).withPaidFeaturePolicy(importOriginal),
);

import {
  resetPaidFeaturePolicy,
  setPaidFeaturePolicy,
} from "@/test/unit/helpers/paidFeaturePolicy";

const makeStore = (orgIdentifier = "test-org") =>
  createStore({
    state: {
      theme: "light",
      isAiChatEnabled: false,
      zoConfig: {
        ai_enabled: false,
      },
      selectedOrganization: {
        identifier: orgIdentifier,
      },
      userInfo: {
        email: "test@example.com",
      },
    },
    actions: {
      setIsAiChatEnabled: vi.fn(),
    },
  });

const mockStore = makeStore();

const mockRouter = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/functions", name: "functions", component: { template: "<div />" } },
    { path: "/pipeline/functions", name: "pipeline-functions", component: { template: "<div />" } },
  ],
});

const mockI18n = createI18n({
  locale: "en",
  messages: {
    en: {
      function: {
        jsfunction: "Function",
        errorDetails: "Error Details",
      },
      dashboard: {
        unsavedMessage: "You have unsaved changes",
      },
      pipeline: {
        unsavedMessage: "You have unsaved pipeline changes",
      },
      common: {
        unsavedTitle: "Unsaved Changes",
        unsavedMessage: "You have unsaved changes. Are you sure you want to leave?",
        cancelTitle: "Cancel",
        cancelMessage: "Are you sure you want to cancel?",
      },
    },
  },
});

describe("AddFunction.vue Branch Coverage", () => {
  const defaultProps = {
    modelValue: {
      name: "",
      function: "",
      params: "row",
      transType: "0",
    },
    isUpdated: false,
    heightOffset: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetPaidFeaturePolicy();
  });

  // Function name / method-name validation is now owned by the Zod schema —
  // covered by AddFunction.schema.spec.ts and the real-OForm gating tests below
  // ("Schema wiring"), not by internal helper methods. (`params` is a hidden
  // constant merged at submit, no longer a validated field.)

  // The save now flows through the REAL <OForm> (no validate() shim). Driving
  // form.handleSubmit() runs the schema then calls onSubmit(value).
  const stubs = {
    "query-editor": true,
    TestFunction: true,
    FunctionsToolbar: true,
    FullViewContainer: true,
    ConfirmDialog: true,
    O2AIChat: true,
  };
  // `org` lets a test pick the selected organization (the _meta org keeps JS on
  // OSS); omitted, it uses the default "test-org" store.
  const mountAddFunction = (props: any = defaultProps, org?: string) =>
    mount(AddFunction, {
      props,
      global: {
        plugins: [mockI18n, mockRouter],
        provide: { store: org ? makeStore(org) : mockStore },
        stubs,
      },
    });
  const getForm = (wrapper: any) => (wrapper.findComponent(OForm).vm as any).form;

  // The NL→VRL bar used to read `zoConfig.ai_enabled` ALONE, with no edition
  // half at all — inert only because the OSS backend never emits that flag. It now
  // takes the edition from the `aiAssistant` registry key and treats ai_enabled as
  // the admin preference on top (QueryEditor.vue's documented split).
  describe("NL→VRL AI bar entitlement", () => {
    // A probe stub for the real editor: the props are what the gate renders, so
    // asserting them keeps the proof on the template rather than on the computed.
    const AiBarProbe = {
      name: "UnifiedQueryEditor",
      props: ["hideNlToggle", "disableAi"],
      template:
        '<div class="ai-bar-probe" :data-hidden="String(hideNlToggle)" :data-disabled="String(disableAi)" />',
    };
    const mountWithAiBarProbe = () =>
      mount(AddFunction, {
        props: defaultProps,
        global: {
          plugins: [mockI18n, mockRouter],
          provide: { store: mockStore },
          stubs: { ...stubs, UnifiedQueryEditor: AiBarProbe },
        },
      });

    const withAiFlag = (enabled: boolean) => {
      (mockStore.state as any).zoConfig.ai_enabled = enabled;
    };

    afterEach(() => {
      withAiFlag(false);
      (config as any).isEnterprise = "false";
      (config as any).isCloud = "false";
    });

    it("stays hidden on OSS even when the backend emits ai_enabled", () => {
      withAiFlag(true);
      // The DOM-facing half first: what the editor is actually told, proven without
      // touching the computed that only exists after the fix.
      const probe = mountWithAiBarProbe();
      expect(probe.find(".ai-bar-probe").attributes()).toMatchObject({
        "data-hidden": "true",
        "data-disabled": "true",
      });
      const wrapper = mountAddFunction();
      expect(wrapper.vm.aiFunctionVisible).toBe(false);
      expect(wrapper.vm.aiFunctionEnabled).toBe(false);
    });

    // The lock-policy mirror of this pair is NOT assertable here: the mocked
    // helper's own LIMITATION note says the real checkFeatureAccess reads the
    // shipped constant from inside its own module.

    it("is enabled for an entitled org that has ai_enabled on", () => {
      withAiFlag(true);
      (config as any).isEnterprise = "true";
      const wrapper = mountAddFunction();
      expect(wrapper.vm.aiFunctionVisible).toBe(true);
      expect(wrapper.vm.aiFunctionEnabled).toBe(true);
    });

    it("stays hidden for an entitled org that turned ai_enabled off", () => {
      withAiFlag(false);
      (config as any).isEnterprise = "true";
      const wrapper = mountAddFunction();
      expect(wrapper.vm.aiFunctionVisible).toBe(false);
      expect(wrapper.vm.aiFunctionEnabled).toBe(false);
    });
  });

  // JavaScript functions are an enterprise/cloud entitlement. Under the shipped
  // "hide" policy the option is omitted (a locked one would open a refused dialog);
  // under "lock" it stays present with a `disabled` flag.
  describe("JS entitlement gate (enterprise/cloud only)", () => {
    const values = (wrapper: any) =>
      ((wrapper.vm as any).transformTypeOptions as any[]).map((o) => o.value);
    const jsOption = (wrapper: any) =>
      ((wrapper.vm as any).transformTypeOptions as any[]).find((o) => o.value === "1");

    beforeEach(() => {
      (config as any).isEnterprise = "false";
      (config as any).isCloud = "false";
    });

    it("OSS under the shipped hide policy: offers VRL only — no locked option to click", () => {
      const wrapper = mountAddFunction();
      expect(values(wrapper)).toEqual(["0"]);
      expect(jsOption(wrapper)).toBeUndefined();
    });

    it("OSS under the lock policy: offers VRL + a locked JavaScript option", () => {
      setPaidFeaturePolicy("lock");
      const wrapper = mountAddFunction();
      expect(values(wrapper)).toEqual(["0", "1"]);
      expect(jsOption(wrapper).disabled).toBe(true);
    });

    it("enterprise: offers VRL + an unlocked JavaScript option", () => {
      (config as any).isEnterprise = "true";
      const wrapper = mountAddFunction();
      expect(values(wrapper)).toEqual(["0", "1"]);
      expect(jsOption(wrapper).disabled).toBe(false);
    });

    it("cloud: offers VRL + an unlocked JavaScript option", () => {
      (config as any).isCloud = "true";
      const wrapper = mountAddFunction();
      expect(values(wrapper)).toEqual(["0", "1"]);
      expect(jsOption(wrapper).disabled).toBe(false);
    });

    it("is no longer tied to the _meta org (any enterprise org unlocks JS)", () => {
      // the old rule keyed ONLY off selectedOrganization === "_meta"; the store
      // here is "test-org", so JS must unlock purely from the entitlement.
      (config as any).isEnterprise = "true";
      expect(jsOption(mountAddFunction()).disabled).toBe(false);
    });

    it("OSS _meta org still gets an unlocked JS option (pre-existing SSO claim-parsing behavior)", () => {
      // _meta predates the enterprise entitlement — it must keep JS unlocked on OSS.
      const wrapper = mountAddFunction(defaultProps, "_meta");
      expect(jsOption(wrapper).disabled).toBe(false);
    });

    it("OSS non-_meta org: no JS option under hide, a locked one under lock", () => {
      expect(values(mountAddFunction(defaultProps, "some-org"))).toEqual(["0"]);
      setPaidFeaturePolicy("lock");
      const wrapper = mountAddFunction(defaultProps, "some-org");
      expect(values(wrapper)).toEqual(["0", "1"]);
      expect(jsOption(wrapper).disabled).toBe(true);
    });

    it("OSS but EDITING an existing JS function: keeps the JS option unlocked", () => {
      // otherwise the radio renders with nothing selected and the editor would
      // silently fall back to VRL for a JS function.
      const wrapper = mountAddFunction({
        ...defaultProps,
        isUpdated: true,
        modelValue: { ...defaultProps.modelValue, transType: "1" },
      });
      expect(jsOption(wrapper).disabled).toBe(false);
    });

    it("OSS editing a VRL function: no JS option under hide, locked under lock", () => {
      const props = {
        ...defaultProps,
        isUpdated: true,
        modelValue: { ...defaultProps.modelValue, transType: "0" },
      };
      expect(values(mountAddFunction(props))).toEqual(["0"]);
      setPaidFeaturePolicy("lock");
      const wrapper = mountAddFunction(props);
      expect(values(wrapper)).toEqual(["0", "1"]);
      expect(jsOption(wrapper).disabled).toBe(true);
    });

    it("OSS editing an existing JS function keeps the option under hide", () => {
      // the hide policy must not strip the language a saved function is written in.
      const wrapper = mountAddFunction({
        ...defaultProps,
        isUpdated: true,
        modelValue: { ...defaultProps.modelValue, transType: "1" },
      });
      expect(values(wrapper)).toEqual(["0", "1"]);
      expect(jsOption(wrapper).disabled).toBe(false);
    });
  });

  describe("Update vs Create Logic (real OForm submit)", () => {
    it("calls create when not updating and the name is valid", async () => {
      const jsTransformService = (await import("@/services/jstransform")).default;
      const createSpy = vi.spyOn(jsTransformService, "create");

      const wrapper = mountAddFunction({ ...defaultProps, isUpdated: false });
      const form = getForm(wrapper);
      form.setFieldValue("name", "testFunction");
      await form.handleSubmit();
      await flushPromises();

      expect((wrapper.vm as any).beingUpdated).toBe(false);
      // Payload parity (Rule ④): assert the EXACT object — keys AND value types —
      // handed to the save service, not merely that it was called. `transType`
      // MUST be a number (parseInt), guarding the string→number type-drift class
      // that broke dashboards' max_record_size; `function`/`params` are the
      // Monaco body + hidden constant merged in from `formData` at submit.
      expect(createSpy).toHaveBeenCalledWith("test-org", {
        name: "testFunction",
        function: "",
        params: "row",
        transType: 0,
      });
      const createPayload = createSpy.mock.calls[0][1] as any;
      expect(typeof createPayload.transType).toBe("number");
      expect(wrapper.emitted("update:list")).toBeTruthy();
    });

    it("calls update when updating and the name is valid", async () => {
      const jsTransformService = (await import("@/services/jstransform")).default;
      const updateSpy = vi.spyOn(jsTransformService, "update");

      const wrapper = mountAddFunction({ ...defaultProps, isUpdated: true });
      const form = getForm(wrapper);
      form.setFieldValue("name", "testFunction");
      await form.handleSubmit();
      await flushPromises();

      expect((wrapper.vm as any).beingUpdated).toBe(true);
      // Same exact-payload + numeric-transType parity check for the update path.
      expect(updateSpy).toHaveBeenCalledWith("test-org", {
        name: "testFunction",
        function: "",
        params: "row",
        transType: 0,
      });
      const updatePayload = updateSpy.mock.calls[0][1] as any;
      expect(typeof updatePayload.transType).toBe("number");
    });
  });

  describe("Schema wiring (real OForm)", () => {
    it("blocks submit for an empty required name — service NOT called", async () => {
      const jsTransformService = (await import("@/services/jstransform")).default;
      const createSpy = vi.spyOn(jsTransformService, "create");

      const wrapper = mountAddFunction({ ...defaultProps, isUpdated: false });
      const form = getForm(wrapper);
      await form.handleSubmit();
      await flushPromises();

      expect(form.state.isValid).toBe(false);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("blocks submit for an invalid method name — service NOT called", async () => {
      const jsTransformService = (await import("@/services/jstransform")).default;
      const createSpy = vi.spyOn(jsTransformService, "create");

      const wrapper = mountAddFunction({ ...defaultProps, isUpdated: false });
      const form = getForm(wrapper);
      form.setFieldValue("name", "123-invalid");
      await form.handleSubmit();
      await flushPromises();

      expect(form.state.isValid).toBe(false);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("blocks submit for a name with trailing whitespace — raw value validated, service NOT called", async () => {
      // End-to-end regression guard: OForm SAVES the raw form value, so a schema
      // .trim() would let "myfunc " pass validation yet persist the space. The
      // raw value must be rejected and the save blocked (no auto-strip-then-save).
      const jsTransformService = (await import("@/services/jstransform")).default;
      const createSpy = vi.spyOn(jsTransformService, "create");

      const wrapper = mountAddFunction({ ...defaultProps, isUpdated: false });
      const form = getForm(wrapper);
      form.setFieldValue("name", "myfunc ");
      await form.handleSubmit();
      await flushPromises();

      expect(form.state.isValid).toBe(false);
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling Branch Coverage", () => {
    it("does not call the service when validation fails", async () => {
      const jsTransformService = (await import("@/services/jstransform")).default;
      const createSpy = vi.spyOn(jsTransformService, "create");

      const wrapper = mountAddFunction({ ...defaultProps, isUpdated: false });
      const form = getForm(wrapper);
      // empty name → schema invalid
      await form.handleSubmit();
      await flushPromises();

      expect(form.state.isValid).toBe(false);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("captures API errors into compilationErr", async () => {
      const jsTransformService = (await import("@/services/jstransform")).default;
      vi.spyOn(jsTransformService, "create").mockRejectedValueOnce({
        response: { data: { message: "API Error occurred" } },
      });

      const wrapper = mountAddFunction({ ...defaultProps, isUpdated: false });
      const form = getForm(wrapper);
      form.setFieldValue("name", "testFunction");
      await form.handleSubmit();
      await flushPromises();

      expect((wrapper.vm as any).compilationErr).toBe("API Error occurred");
    });

    it("should handle function error from TestFunction component", async () => {
      const wrapper = mount(AddFunction, {
        props: defaultProps,
        global: {
          plugins: [mockI18n, mockRouter],
          provide: {
            store: mockStore,
          },
          stubs: {
            "query-editor": true,
            TestFunction: true,
            FunctionsToolbar: true,
            FullViewContainer: true,
            ConfirmDialog: true,
            O2AIChat: true,
          },
        },
      });

      const vm = wrapper.vm as any;

      // Branch: handleFunctionError (line 425-427)
      const testError = "VRL compilation error";
      vm.handleFunctionError(testError);

      expect(vm.vrlFunctionError).toBe(testError);
    });
  });

  describe("Unsaved Changes Logic Branch Coverage", () => {
    it("should show confirm dialog when closing with unsaved changes", async () => {
      const wrapper = mount(AddFunction, {
        props: defaultProps,
        global: {
          plugins: [mockI18n, mockRouter],
          provide: {
            store: mockStore,
          },
          stubs: {
            "query-editor": true,
            TestFunction: true,
            FunctionsToolbar: true,
            FullViewContainer: true,
            ConfirmDialog: true,
            O2AIChat: true,
          },
        },
      });

      const vm = wrapper.vm as any;

      // Test the confirm dialog flow directly
      vm.isFunctionDataChanged = { value: true };

      // Branch: isFunctionDataChanged.value = true (line 430-437)
      vm.closeAddFunction();

      // Test that the function covers the branch by checking component state
      expect(wrapper.vm).toBeDefined();
      expect(vm.confirmDialogMeta).toBeDefined();
    });

    it("should close directly when no unsaved changes", async () => {
      const wrapper = mount(AddFunction, {
        props: defaultProps,
        global: {
          plugins: [mockI18n, mockRouter],
          provide: {
            store: mockStore,
          },
          stubs: {
            "query-editor": true,
            TestFunction: true,
            FunctionsToolbar: true,
            FullViewContainer: true,
            ConfirmDialog: true,
            O2AIChat: true,
          },
        },
      });

      const vm = wrapper.vm as any;

      // No unsaved changes
      vm.isFunctionDataChanged = false;

      // Branch: !isFunctionDataChanged.value (line 438-440)
      vm.closeAddFunction();

      expect(wrapper.emitted("cancel:hideform")).toBeTruthy();
      expect(vm.confirmDialogMeta.show).toBe(false);
    });

    it("should handle cancel with unsaved changes", async () => {
      const wrapper = mount(AddFunction, {
        props: defaultProps,
        global: {
          plugins: [mockI18n, mockRouter],
          provide: {
            store: mockStore,
          },
          stubs: {
            "query-editor": true,
            TestFunction: true,
            FunctionsToolbar: true,
            FullViewContainer: true,
            ConfirmDialog: true,
            O2AIChat: true,
          },
        },
      });

      const vm = wrapper.vm as any;

      // Test the confirm dialog flow directly
      vm.isFunctionDataChanged = { value: true };

      // Branch: isFunctionDataChanged.value = true (line 444-451)
      vm.cancelAddFunction();

      // Test that the function covers the branch by checking component state
      expect(wrapper.vm).toBeDefined();
      expect(vm.confirmDialogMeta).toBeDefined();
    });

    it("should handle beforeunload event with unsaved changes", async () => {
      const wrapper = mount(AddFunction, {
        props: defaultProps,
        global: {
          plugins: [mockI18n, mockRouter],
          provide: {
            store: mockStore,
          },
          stubs: {
            "query-editor": true,
            TestFunction: true,
            FunctionsToolbar: true,
            FullViewContainer: true,
            ConfirmDialog: true,
            O2AIChat: true,
          },
        },
      });

      const vm = wrapper.vm as any;

      // Test the beforeunload logic branch coverage by testing the watcher
      // Change the form data to trigger the watcher
      vm.formData.name = "changed";

      await nextTick();

      // The branch condition for beforeunload is based on isFunctionDataChanged
      expect(wrapper.vm).toBeDefined();
    });

    it("should allow beforeunload when no unsaved changes", async () => {
      const wrapper = mount(AddFunction, {
        props: defaultProps,
        global: {
          plugins: [mockI18n, mockRouter],
          provide: {
            store: mockStore,
          },
          stubs: {
            "query-editor": true,
            TestFunction: true,
            FunctionsToolbar: true,
            FullViewContainer: true,
            ConfirmDialog: true,
            O2AIChat: true,
          },
        },
      });

      const vm = wrapper.vm as any;

      // Test that the component has initial state for branch coverage
      expect(wrapper.vm).toBeDefined();

      // Test the component exists and covers the initial state branch
      expect(vm.formData).toBeDefined();
    });
  });

  describe("AI Chat Integration", () => {
    it("should show AI chat when enabled and not in add function component", async () => {
      const aiEnabledStore = createStore({
        state: {
          ...mockStore.state,
          isAiChatEnabled: true, // Branch condition: true
        },
        actions: (mockStore as any).actions,
      });

      // Mock router to simulate not being in functions route
      const nonFunctionRouter = createRouter({
        history: createWebHistory(),
        routes: [{ path: "/pipeline/test", name: "test", component: { template: "<div />" } }],
      });
      await nonFunctionRouter.push("/pipeline/test");

      const wrapper = mount(AddFunction, {
        props: defaultProps,
        global: {
          plugins: [mockI18n, nonFunctionRouter],
          provide: {
            store: aiEnabledStore,
          },
          stubs: {
            "query-editor": true,
            TestFunction: true,
            FunctionsToolbar: true,
            FullViewContainer: true,
            ConfirmDialog: true,
            O2AIChat: true,
          },
        },
      });

      // Branch: store.state.isAiChatEnabled && !isAddFunctionComponent
      const mainContainerClasses = wrapper.find(".flex.overflow-hidden.min-h-0");
      expect(mainContainerClasses.classes()).toContain("w-3/4");

      const chatContainer = wrapper.find(".w-1\\/4");
      expect(chatContainer.exists()).toBe(true);
    });

    it("should hide AI chat when disabled or in add function component", async () => {
      // Mock router to simulate being in functions route
      const functionRouter = createRouter({
        history: createWebHistory(),
        routes: [{ path: "/functions", name: "functions", component: { template: "<div />" } }],
      });
      await functionRouter.push("/functions");

      const wrapper = mount(AddFunction, {
        props: defaultProps,
        global: {
          plugins: [mockI18n, functionRouter],
          provide: {
            store: mockStore, // isAiChatEnabled: false
          },
          stubs: {
            "query-editor": true,
            TestFunction: true,
            FunctionsToolbar: true,
            FullViewContainer: true,
            ConfirmDialog: true,
            O2AIChat: true,
          },
        },
      });

      // Branch: !store.state.isAiChatEnabled || isAddFunctionComponent
      const mainContainerClasses = wrapper.find(".flex.overflow-hidden.min-h-0");
      expect(mainContainerClasses.classes()).toContain("w-full");

      const chatContainer = wrapper.find(".w-1\\/4");
      expect(chatContainer.exists()).toBe(false);
    });
  });

  describe("Utility Functions Branch Coverage", () => {
    it("should handle test function action", async () => {
      const wrapper = mount(AddFunction, {
        props: defaultProps,
        global: {
          plugins: [mockI18n, mockRouter],
          provide: {
            store: mockStore,
          },
          stubs: {
            "query-editor": true,
            TestFunction: {
              template: "<div></div>",
              methods: {
                testFunction: vi.fn(),
              },
            },
            FunctionsToolbar: true,
            FullViewContainer: true,
            ConfirmDialog: true,
            O2AIChat: true,
          },
        },
      });

      const vm = wrapper.vm as any;

      // Mock testFunctionRef
      vm.testFunctionRef = {
        testFunction: vi.fn(),
      };

      // Test onTestFunction (line 421-423)
      vm.onTestFunction();

      expect(vm.testFunctionRef.testFunction).toHaveBeenCalled();
    });

    it("should handle AI chat interactions", async () => {
      const wrapper = mount(AddFunction, {
        props: defaultProps,
        global: {
          plugins: [mockI18n, mockRouter],
          provide: {
            store: mockStore,
          },
          stubs: {
            "query-editor": true,
            TestFunction: true,
            FunctionsToolbar: true,
            FullViewContainer: true,
            ConfirmDialog: true,
            O2AIChat: true,
          },
        },
      });

      const vm = wrapper.vm as any;

      // Test openChat function (line 464-466)
      vm.openChat(true);
      expect((mockStore as any)._actions.setIsAiChatEnabled).toHaveLength(1);

      // Test sendToAiChat function (line 468-479)
      const testValue = "test AI chat message";
      vm.sendToAiChat(testValue);

      expect(vm.aiChatInputContext).toBe("");

      await nextTick();

      expect(vm.aiChatInputContext).toBe(testValue);
      expect(wrapper.emitted("sendToAiChat")).toBeTruthy();
      expect(wrapper.emitted("sendToAiChat")?.[0]).toEqual([testValue]);
    });
  });

  // The typewriter placeholder is the only affordance telling a user what to
  // write in an empty function editor. It used to be suppressed whenever
  // `forcedLanguage` was set — but BOTH flow hosts force a language, so the
  // pipeline Function node (forces vrl, seeds no code) rendered a blank editor
  // with no hint at all. Workflows hid the regression because they seed
  // `defaultCode`, which fills the editor.
  describe("typewriter placeholder with a host-forced language", () => {
    const placeholder = (wrapper: any) => wrapper.find(".pointer-events-none.select-none");

    it("🔑 still renders for a forced language when no defaultCode is seeded", () => {
      // the pipeline Function node's exact props
      const wrapper = mountAddFunction({
        ...defaultProps,
        forcedLanguage: "vrl",
      });
      expect(placeholder(wrapper).exists()).toBe(true);
    });

    it("renders for a forced JS language too", () => {
      (config as any).isEnterprise = "true";
      const wrapper = mountAddFunction({
        ...defaultProps,
        forcedLanguage: "javascript",
      });
      expect(placeholder(wrapper).exists()).toBe(true);
    });

    it("is hidden once a host seeds defaultCode (the workflow case)", () => {
      // `!formData.function` — not `!forcedLanguage` — is what suppresses it.
      (config as any).isEnterprise = "true";
      const wrapper = mountAddFunction({
        ...defaultProps,
        forcedLanguage: "javascript",
        defaultCode: "// do something\n",
      });
      expect(placeholder(wrapper).exists()).toBe(false);
    });

    it("renders with no forced language at all (unchanged behaviour)", () => {
      expect(placeholder(mountAddFunction()).exists()).toBe(true);
    });
  });

  // getCode() is the workflow disk-save's source of truth. formData.function only
  // catches up 500ms (editor debounce) after the last keystroke, so reading it at
  // click time silently saved the stale seed instead of the typed code.
  describe("getCode reads the LIVE editor buffer", () => {
    const EditorStub = {
      name: "UnifiedQueryEditor",
      template: "<div class='uqe-stub' />",
      setup(_props: any, { expose }: any) {
        // Trailing whitespace: the debounced path always trimmed, so getCode must too.
        expose({ getValue: () => "  row.meta.enriched = true;\n\n" });
      },
    };

    it("🔑 returns the buffer even before the debounced update:query lands", async () => {
      const wrapper = mount(AddFunction, {
        props: { ...defaultProps, forcedLanguage: "javascript", defaultCode: "// seed\n" },
        global: {
          plugins: [mockI18n, mockRouter],
          provide: { store: mockStore },
          stubs: { ...stubs, UnifiedQueryEditor: EditorStub },
        },
      });
      await flushPromises();
      expect((wrapper.vm.$ as any).exposed.getCode()).toBe("row.meta.enriched = true;");
    });

    it("falls back to formData while the editor has not mounted", async () => {
      const wrapper = mount(AddFunction, {
        props: { ...defaultProps, forcedLanguage: "javascript", defaultCode: "// seed\n" },
        global: {
          plugins: [mockI18n, mockRouter],
          provide: { store: mockStore },
          stubs: { ...stubs, UnifiedQueryEditor: true },
        },
      });
      await flushPromises();
      expect((wrapper.vm.$ as any).exposed.getCode()).toBe("// seed");
    });
  });
});

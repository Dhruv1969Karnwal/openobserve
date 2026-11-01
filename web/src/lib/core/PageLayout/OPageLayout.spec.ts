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

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";

import i18n from "@/locales";
import OPageLayout from "./OPageLayout.vue";

const { phone } = vi.hoisted(() => ({ phone: { value: false } }));

vi.mock("@/composables/useBreakpoint", async () => {
  const { computed } = await import("vue");
  return {
    default: () => ({
      isMobile: computed(() => phone.value),
      isTablet: computed(() => false),
      isDesktop: computed(() => !phone.value),
      mdUp: computed(() => !phone.value),
      lgUp: computed(() => true),
    }),
  };
});

vi.mock("vue-router", () => ({
  useRoute: () => ({ name: "users", query: {}, fullPath: "/iam/users" }),
  useRouter: () => ({
    push: vi.fn(() => Promise.resolve()),
    currentRoute: { value: { fullPath: "" } },
  }),
}));

const RAIL = "[data-test='hub-rail-under-test']";

const Hub = (pageComponent: unknown, hubProps: Record<string, unknown> = {}) =>
  defineComponent({
    setup: () => () =>
      h(
        OPageLayout,
        { delegateSidebar: true, sidebarWidth: 230, bleed: true, ...hubProps },
        {
          sidebar: () => h("nav", { "data-test": "hub-rail-under-test" }, "rail"),
          default: () => h(pageComponent as never),
        },
      ),
  });

const SectionPage = defineComponent({
  setup: () => () =>
    h(
      OPageLayout,
      { title: "Users", icon: "person", bleed: true },
      { default: () => h("div", { "data-test": "section-body" }, "table") },
    ),
});

// The claim is taken while the hosted page sets up, so the hub drops its interim
// rail one tick later — which is still before the browser paints.
const mountOf = async (pageComponent: unknown, hubProps: Record<string, unknown> = {}) => {
  const wrapper = mount(Hub(pageComponent, hubProps), { global: { plugins: [i18n] } });
  await nextTick();
  return wrapper;
};

describe("OPageLayout delegated section rail", () => {
  it("renders the rail under the hosted page header, never beside it", async () => {
    const wrapper = await mountOf(SectionPage);
    const rail = wrapper.find(RAIL);
    expect(rail.exists()).toBe(true);

    const aside = rail.element.closest("aside");
    expect(aside).not.toBeNull();
    const row = aside!.parentElement!;
    const header = row.previousElementSibling;
    expect(header?.querySelector("h1")?.textContent).toBe("Users");
    // The title row spans the frame: nothing indents it beside the rail.
    expect(aside!.querySelector("h1")).toBeNull();
  });

  it("renders the rail exactly once when a page is hosted", async () => {
    expect((await mountOf(SectionPage)).findAll(RAIL)).toHaveLength(1);
  });

  it("keeps drawing the rail itself when the hosted page has no layout", async () => {
    const plainPage = defineComponent({
      setup: () => () => h("div", { "data-test": "plain-body" }, "form"),
    });
    const wrapper = await mountOf(plainPage);
    expect(wrapper.find(RAIL).exists()).toBe(true);
    expect(wrapper.find('[data-test="plain-body"]').exists()).toBe(true);
  });

  it("does not let a layout nested in the hosted page take the rail twice", async () => {
    const nestedPage = defineComponent({
      setup: () => () =>
        h(
          OPageLayout,
          { title: "Outer", icon: "person", bleed: true },
          {
            default: () =>
              h(
                OPageLayout,
                { title: "Inner", icon: "person", bleed: true },
                { default: () => h("div", "inner body") },
              ),
          },
        ),
    });
    const wrapper = await mountOf(nestedPage);
    expect(wrapper.findAll(RAIL)).toHaveLength(1);
    const header = wrapper.find(RAIL).element.closest("aside")!.parentElement!
      .previousElementSibling!;
    expect(header.querySelector("h1")?.textContent).toBe("Outer");
  });

  it("mounts the hosted page once, not again when the rail changes hands", async () => {
    const mounts: number[] = [];
    const CountedPage = defineComponent({
      setup: () => {
        mounts.push(1);
        return () =>
          h(
            OPageLayout,
            { title: "Users", icon: "person", bleed: true },
            { default: () => h("div", "body") },
          );
      },
    });
    await mountOf(CountedPage);
    expect(mounts).toHaveLength(1);
  });

  it("leaves a non-delegating layout alone", () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            OPageLayout,
            { title: "Streams", icon: "list", bleed: true },
            { default: () => h("div", "body") },
          ),
      }),
      { global: { plugins: [i18n] } },
    );
    expect(wrapper.find("h1").text()).toBe("Streams");
    expect(wrapper.find("aside").exists()).toBe(false);
  });
});

describe("OPageLayout delegated section rail on a phone", () => {
  it("still mounts the hosted page once when the rail moves into the drawer", async () => {
    phone.value = true;
    try {
      const mounts: number[] = [];
      const CountedPage = defineComponent({
        setup: () => {
          mounts.push(1);
          return () =>
            h(
              OPageLayout,
              { title: "Users", icon: "person", bleed: true },
              { default: () => h("div", "body") },
            );
        },
      });
      const wrapper = await mountOf(CountedPage);
      await nextTick();
      expect(mounts).toHaveLength(1);
      // The rail belongs to the drawer now, so no column is parked beside the body.
      expect(wrapper.find("aside").exists()).toBe(false);
    } finally {
      phone.value = false;
    }
  });
});

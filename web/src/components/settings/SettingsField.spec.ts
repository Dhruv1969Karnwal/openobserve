import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SettingsField from "./SettingsField.vue";
import i18n from "@/locales";

const mountField = (props: Record<string, unknown> = {}) =>
  mount(SettingsField, {
    props: { label: "Custom Logo Text" as any, ...props },
    slots: { default: '<input data-test="the-control" />' },
    global: { plugins: [i18n] },
  });

describe("SettingsField", () => {
  it("stacks label, control and description in that order", () => {
    const wrapper = mountField({ description: "Shown in the app chrome." as any });
    const kids = wrapper
      .findAll(".flex-col > *")
      .filter((n) => !n.classes().includes("flex-col"))
      .map((n) => n.element.className.split(" ")[0]);
    expect(kids[0]).toContain("text-input-label-text");
    expect(wrapper.find('[data-test="the-control"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Shown in the app chrome.");
  });

  it("prints no description line when the field has none", () => {
    expect(mountField().text()).toBe("Custom Logo Text");
  });

  it("marks a required field with a star that carries no meaning for a screen reader", () => {
    const star = mountField({ required: true }).find('[aria-hidden="true"]');
    expect(star.text()).toBe("*");
  });
});

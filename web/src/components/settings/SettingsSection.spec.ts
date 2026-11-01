import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SettingsSection from "./SettingsSection.vue";
import i18n from "@/locales";

const mountSection = (props: Record<string, unknown> = {}) =>
  mount(SettingsSection, {
    props: { title: "Query limits" as any, ...props },
    slots: { default: '<input data-test="a-control" />' },
    global: { plugins: [i18n] },
  });

describe("SettingsSection", () => {
  it("names the section as a heading level below the page title", () => {
    const heading = mountSection().find("h2");
    expect(heading.attributes("data-test")).toBe("settings-section-title");
    expect(heading.text()).toBe("Query limits");
  });

  it("renders no description line when the section has none", () => {
    expect(mountSection().find('[data-test="settings-section-help"]').exists()).toBe(false);
  });

  it("puts the description in the heading column, not beside the control", () => {
    const wrapper = mountSection({ description: "One PromQL query, one ceiling." as any });
    expect(wrapper.find('[data-test="settings-section-help"]').text()).toBe(
      "One PromQL query, one ceiling.",
    );
    expect(
      wrapper.find('[data-test="settings-section-help"]').element.previousElementSibling?.tagName,
    ).toBe("H2");
  });

  it("exposes its heading id so a control group can be labelled by it", () => {
    const wrapper = mountSection({ headingId: "appearance-heading" });
    expect(wrapper.find("h2").attributes("id")).toBe("appearance-heading");
    expect(mountSection().find("h2").attributes("id")).toMatch(/^v-\d+/);
  });

  it("renders the controls in their own column", () => {
    expect(mountSection().find('[data-test="a-control"]').exists()).toBe(true);
  });
});

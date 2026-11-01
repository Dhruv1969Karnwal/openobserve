import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ThemeModeChip from "./ThemeModeChip.vue";
import i18n from "@/locales";

// jsdom resolves an inline colour to rgb(), so expectations are stated in the
// form the DOM reports rather than the form the picker writes.
const asRgb = (hex: string) => {
  const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return "rgb(" + parts.join(", ") + ")";
};

const mountChip = (props: Record<string, unknown> = {}) =>
  mount(ThemeModeChip, {
    props: {
      mode: "light",
      label: "Light" as any,
      accent: "#1C1F23",
      active: false,
      dataTest: "theme-light-chip",
      ...props,
    },
    global: { plugins: [i18n] },
  });

describe("ThemeModeChip", () => {
  it("is a real button, so the keyboard reaches it", () => {
    const chip = mountChip().find('[data-test="theme-light-chip"]');
    expect(chip.element.tagName).toBe("BUTTON");
    expect(chip.attributes("type")).toBe("button");
    expect(chip.attributes("tabindex")).toBeUndefined();
  });

  it("carries the mode's selected state as aria-pressed", () => {
    expect(
      mountChip({ active: true }).find('[data-test="theme-light-chip"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(
      mountChip({ active: false })
        .find('[data-test="theme-light-chip"]')
        .attributes("aria-pressed"),
    ).toBe("false");
  });

  it("paints the mode's page ground, not its accent, as the swatch field", () => {
    const layers = mountChip().find(".color-circle").findAll("span");
    expect(layers[0].attributes("style")).toContain("var(--color-white)");
    expect(layers[1].attributes("style")).toContain(asRgb("#1C1F23"));
  });

  it("paints the dark swatch inside a dark scope so its ground token resolves", () => {
    const wrapper = mountChip({ mode: "dark", accent: "#E6E6E6", dataTest: "theme-dark-chip" });
    const swatch = wrapper.find(".color-circle");
    expect(swatch.classes()).toContain("dark");
    expect(swatch.find("span").attributes("style")).toContain("var(--color-surface-base)");
    expect(wrapper.findAll(".color-circle span")[1].attributes("style")).toContain(
      asRgb("#E6E6E6"),
    );
  });

  it("keeps the accent hex as text, because the band names it", () => {
    expect(mountChip().text()).toContain("#1C1F23");
  });

  it("emits edit on click", async () => {
    const wrapper = mountChip();
    await wrapper.find('[data-test="theme-light-chip"]').trigger("click");
    expect(wrapper.emitted("edit")).toHaveLength(1);
  });
});

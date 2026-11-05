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

const chip = (wrapper: ReturnType<typeof mountChip>, hook = "theme-light-chip") =>
  wrapper.find(`[data-test="${hook}"]`);

/** What a sighted reader sees: the button's text minus the screen-reader-only accent. */
const visibleText = (wrapper: ReturnType<typeof mountChip>, hook?: string) => {
  const el = chip(wrapper, hook).element.cloneNode(true) as HTMLElement;
  el.querySelector(".chip-accent-value")?.remove();
  return (el.textContent || "").replace(/\s+/g, " ").trim();
};

describe("ThemeModeChip", () => {
  it("is a real button, so the keyboard reaches it", () => {
    const button = chip(mountChip());
    expect(button.element.tagName).toBe("BUTTON");
    expect(button.attributes("type")).toBe("button");
    expect(button.attributes("tabindex")).toBeUndefined();
  });

  it("names the control as the accent picker it is, not as a mode toggle", () => {
    const active = chip(mountChip({ active: true }));
    const inactive = chip(mountChip({ active: false }));
    expect(active.attributes("aria-pressed")).toBeUndefined();
    expect(active.attributes("aria-label")).toBe(
      "Change the Light theme accent color, current mode",
    );
    expect(inactive.attributes("aria-label")).toBe("Change the Light theme accent color");
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

  it("keeps the accent a subordinate rule of the swatch, never the whole field", () => {
    const layers = mountChip().find(".color-circle").findAll("span");
    expect(layers[0].classes()).toContain("inset-0");
    expect(layers[1].classes()).toEqual(expect.arrayContaining(["bottom-0", "h-2.5"]));
  });

  it("labels the chip with the mode, so the swatch can never invert it", () => {
    const wrapper = mountChip();
    expect(wrapper.find(".chip-label").text()).toBe("Light");
    expect(visibleText(wrapper)).toBe("Light");
  });

  it("labels the dark chip with its mode, not with its near-white accent", () => {
    const wrapper = mountChip({
      mode: "dark",
      label: "Dark" as any,
      accent: "#E6E6E6",
      dataTest: "theme-dark-chip",
    });
    expect(wrapper.find(".chip-label").text()).toBe("Dark");
    expect(visibleText(wrapper, "theme-dark-chip")).toBe("Dark");
  });

  it("keeps the raw hex out of the visible label", () => {
    expect(visibleText(mountChip())).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("still reads the accent hex to assistive tech, as the swatch is hidden from it", () => {
    const wrapper = mountChip();
    expect(wrapper.find(".chip-accent-value").text()).toBe("#1C1F23");
    expect(wrapper.find(".color-circle").attributes("aria-hidden")).toBe("true");
    expect(chip(wrapper).text()).toContain("#1C1F23");
  });

  it("marks the selected chip with a glyph, not with colour alone", () => {
    expect(mountChip({ active: true }).find(".chip-mark").exists()).toBe(true);
    expect(mountChip({ active: false }).find(".chip-mark").exists()).toBe(false);
  });

  it("stays unsqueezed and reaches 44px on touch", () => {
    const classes = chip(mountChip()).classes();
    expect(classes).toContain("shrink-0");
    expect(classes).toContain("whitespace-nowrap");
    expect(classes).toContain("max-md:min-h-11");
  });

  it("emits edit on click", async () => {
    const wrapper = mountChip();
    await chip(wrapper).trigger("click");
    expect(wrapper.emitted("edit")).toHaveLength(1);
  });
});

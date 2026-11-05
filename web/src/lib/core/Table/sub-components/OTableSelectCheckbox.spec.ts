// Copyright 2026 OpenObserve Inc.

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import OTableSelectCheckbox from "./OTableSelectCheckbox.vue";
import { raw } from "@/types/i18n";

const CHECKBOX = '[role="checkbox"]';

describe("OTableSelectCheckbox disabled reason", () => {
  it("connects a disabled checkbox to the reason it refuses the row", () => {
    const wrapper = mount(OTableSelectCheckbox, {
      props: { modelValue: false, rowId: "0", disabled: true, disabledReason: raw("Root user") },
    });
    const reason = wrapper.get(".sr-only");
    expect(wrapper.get(CHECKBOX).attributes("aria-describedby")).toBe(reason.attributes("id"));
    expect(reason.text()).toBe("Root user");
  });

  it("leaves an enabled checkbox un-described", () => {
    const wrapper = mount(OTableSelectCheckbox, {
      props: { modelValue: false, rowId: "0", disabledReason: raw("Root user") },
    });
    expect(wrapper.get(CHECKBOX).attributes("aria-describedby")).toBeUndefined();
  });

  it("leaves a disabled checkbox un-described when no reason was supplied", () => {
    const wrapper = mount(OTableSelectCheckbox, {
      props: { modelValue: false, rowId: "0", disabled: true },
    });
    expect(wrapper.find(".sr-only").exists()).toBe(false);
  });
});

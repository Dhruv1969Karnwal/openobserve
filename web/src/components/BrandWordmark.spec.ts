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

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import { raw } from "@/types/i18n";
import BrandWordmark from "./BrandWordmark.vue";

// The brand must render as drawn text, so these assert DOM presence rather than an asset fetch.
describe("BrandWordmark", () => {
  it("renders the product name as selectable text, not as an image", () => {
    const wrapper = mount(BrandWordmark);

    expect(wrapper.text()).toBe("Retrace.ai");
    expect(wrapper.find("img").exists()).toBe(false);
  });

  it("exposes one accessible name for the whole lock-up", () => {
    const wrapper = mount(BrandWordmark, { props: { name: raw("Retrace.ai logo") } });
    const root = wrapper.get('[data-test="brand-wordmark"]');

    expect(root.attributes("role")).toBe("img");
    expect(root.attributes("aria-label")).toBe("Retrace.ai logo");
    // The mark is decoration next to that name.
    expect(wrapper.get('[data-test="brand-wordmark-mark"]').attributes("aria-hidden")).toBe("true");
  });

  it("keeps the caller's test hook and honours the size scale", () => {
    const header = mount(BrandWordmark, { props: { testId: "header-retrace-logo" } });
    expect(header.find('[data-test="header-retrace-logo"]').exists()).toBe(true);
    expect(header.get('[data-test="brand-wordmark-mark"]').classes()).toContain("h-7");

    const hero = mount(BrandWordmark, { props: { size: "hero", testId: "login-retrace-logo" } });
    expect(hero.get('[data-test="brand-wordmark-mark"]').classes()).toContain("h-8");
  });
});

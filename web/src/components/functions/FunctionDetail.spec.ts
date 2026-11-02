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

import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import FunctionDetail from "./FunctionDetail.vue";
import { functionRowView } from "./functionRows";
import i18n from "@/locales";

// The mock API's own record shape: language, count, typed params and the streams
// the function is applied to all come from the payload, none are derived here.
const PAYLOAD = {
  name: "redact_pii",
  function: '.foo = "bar"',
  language: "vrl",
  num_of_func: 2,
  params: [{ name: "fields", value: "*" }],
  associated_with_streams: ["container_stdout", "k8s"],
  transType: 0,
};

const view = () => functionRowView(PAYLOAD);

const mountDetail = (props: Record<string, unknown> = {}) =>
  mount(FunctionDetail, {
    props: { view: view(), ...props },
    global: { plugins: [i18n] },
  });

describe("FunctionDetail", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("paints every field the payload carries", () => {
    const wrapper = mountDetail();

    expect(wrapper.find('[data-test="function-detail-name"]').text()).toBe("redact_pii");
    expect(wrapper.find('[data-test="function-detail-panel"]').text()).toContain("VRL");
    expect(wrapper.find('[data-test="function-detail-body-redact_pii"]').text()).toContain(
      '.foo = "bar"',
    );
    expect(wrapper.find('[data-test="function-detail-count"]').text()).toBe("2");
    expect(wrapper.find('[data-test="function-detail-param-fields"]').text()).toContain("fields");
    expect(wrapper.find('[data-test="function-detail-param-fields"]').text()).toContain("*");
    expect(wrapper.find('[data-test="function-detail-stream-container_stdout"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-test="function-detail-stream-k8s"]').exists()).toBe(true);
  });

  it("keeps the list's actions available on the focused function", async () => {
    const wrapper = mountDetail();

    await wrapper.find('[data-test="function-detail-edit-btn"]').trigger("click");
    expect(wrapper.emitted("edit")).toHaveLength(1);

    wrapper.vm.$emit("pipelines");
    wrapper.vm.$emit("export");
    wrapper.vm.$emit("delete");
    expect(wrapper.emitted("pipelines")).toHaveLength(1);
    expect(wrapper.emitted("export")).toHaveLength(1);
    expect(wrapper.emitted("delete")).toHaveLength(1);
  });

  it("offers no way back while the pane sits beside the list", () => {
    const wrapper = mountDetail();
    expect(wrapper.find('[data-test="function-detail-back"]').exists()).toBe(false);
  });

  it("carries a back control once it covers the list", async () => {
    const wrapper = mountDetail({ pushed: true });
    const back = wrapper.find('[data-test="function-detail-back"]');
    expect(back.exists()).toBe(true);
    expect(back.attributes("aria-label")).toBe("Back");
    await back.trigger("click");
    expect(wrapper.emitted("back")).toHaveLength(1);
  });

  it("says which state it is in when there is nothing to show", () => {
    const first = mountDetail({ view: null });
    const empty = first.find('[data-test="function-detail-empty"]');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toContain("Create your first function");

    const filtered = mountDetail({ view: null, filtered: true });
    expect(filtered.find('[data-test="function-detail-empty"]').text()).toContain("No functions");
  });

  it("holds the pane's shape with flat bars while the first read is in flight", () => {
    const wrapper = mountDetail({ view: null, loading: true });
    expect(wrapper.find('[data-test="function-detail-panel"]').attributes("aria-busy")).toBe(
      "true",
    );
    expect(wrapper.findAll(".animate-pulse, .skeleton-wave").length).toBeGreaterThan(0);
    expect(wrapper.find('[data-test="function-detail-name"]').exists()).toBe(false);
  });

  it("marks a JavaScript function as JavaScript", () => {
    const wrapper = mountDetail({
      view: functionRowView({ name: "js_fn", function: "row", transType: 1 }),
    });
    expect(wrapper.find('[data-test="function-detail-panel"]').text()).toContain("JavaScript");
    expect(wrapper.find('[data-test="function-detail-count"]').exists()).toBe(false);
  });
});

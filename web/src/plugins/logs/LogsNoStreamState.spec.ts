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

import { afterEach, describe, expect, it, vi } from "vitest";
import { computed } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createStore } from "vuex";
import i18n from "@/locales";
import type { LogsStreamPick } from "./logsStreamPicks";

const phone = vi.hoisted(() => ({ isMobile: true }));
vi.mock("@/composables/useBreakpoint", () => ({
  default: () => ({
    isMobile: computed(() => phone.isMobile),
    isTablet: computed(() => !phone.isMobile),
    isDesktop: computed(() => true),
    mdUp: computed(() => true),
    lgUp: computed(() => true),
  }),
}));

import LogsNoStreamState from "./LogsNoStreamState.vue";

const STREAMS: LogsStreamPick[] = [
  { name: "container_stdout", events: 1550240, lastUs: 1762070400000000 },
  { name: "app_payments", events: 331900, lastUs: 1762070300000000 },
  { name: "node_syslog", events: null, lastUs: null },
];

let wrapper: VueWrapper | undefined;

const mountState = (onPhone: boolean) => {
  phone.isMobile = onPhone;
  const store = createStore({ state: { timezone: "UTC", theme: "light" } });
  wrapper = mount(LogsNoStreamState, {
    props: { streams: STREAMS },
    global: { plugins: [i18n, store] },
  });
  return wrapper;
};

const picks = () => wrapper!.findAll('[data-test^="logs-no-stream-pick-"]');

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("LogsNoStreamState", () => {
  it("renders every fetched stream as a real button on the phone", () => {
    mountState(true);
    const rows = picks();
    expect(rows).toHaveLength(STREAMS.length);
    rows.forEach((row, i) => {
      expect(row.element.tagName).toBe("BUTTON");
      expect(row.text()).toContain(STREAMS[i].name);
    });
  });

  it("keeps the phone picks out of viewport-only CSS", () => {
    mountState(true);
    const list = wrapper!.find('[data-test="logs-no-stream-quick-list"]');
    expect(list.exists()).toBe(true);
    expect(list.classes().join(" ")).not.toMatch(
      /(^|\s)(hidden|max-sm:hidden|max-md:hidden|md:flex)/,
    );
    picks().forEach((row) => {
      const cls = row.classes().join(" ");
      expect(cls).not.toMatch(/(^|\s)(hidden|max-sm:hidden|max-md:hidden)/);
      expect(cls).toContain("min-h-11");
    });
  });

  it("moves the events figure to the phone row's second line instead of dropping it", () => {
    mountState(true);
    const withStats = wrapper!.find('[data-test="logs-no-stream-pick-container_stdout"]');
    expect(withStats.text()).toContain("container_stdout");
    expect(withStats.text()).toContain("1,550,240");
    const withoutStats = wrapper!.find('[data-test="logs-no-stream-pick-node_syslog"]');
    expect(withoutStats.text()).toContain("node_syslog");
    expect(withoutStats.text()).toContain("—");
  });

  it("emits pick-stream with the stream name when a phone row is activated", async () => {
    mountState(true);
    await wrapper!.find('[data-test="logs-no-stream-pick-app_payments"]').trigger("click");
    expect(wrapper!.emitted("pick-stream")?.[0]).toEqual(["app_payments"]);
  });

  it("keeps the desktop columns and their header labels", () => {
    mountState(false);
    expect(wrapper!.find('[data-test="logs-no-stream-quick-list"]').text()).toContain("Events");
    const rows = picks();
    expect(rows).toHaveLength(STREAMS.length);
    expect(rows[0].text()).toContain("container_stdout");
    expect(rows[0].text()).toContain("1,550,240");
    expect(rows[0].classes().join(" ")).not.toContain("min-h-11");
  });
});

// Copyright 2026 OpenObserve Inc.

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import OTablePagination from "./OTablePagination.vue";

const PAGE_SIZE_SELECT = '[data-test="o2-table-page-size-select"]';
const INFO = '[data-test="o2-table-pagination-info"]';

function mountPager(props: Record<string, unknown> = {}) {
  return mount(OTablePagination, {
    props: {
      currentPage: 1,
      totalPages: 1,
      totalCount: 4,
      pageSize: 10,
      pageSizeOptions: [10, 20, 50],
      showingFrom: 1,
      showingTo: 4,
      isFirstPage: true,
      isLastPage: true,
      ...props,
    },
  });
}

describe("OTablePagination page-size control", () => {
  it("draws the page-size select when the set cannot fit the smallest page", () => {
    const wrapper = mountPager({ totalCount: 40, showingTo: 10, totalPages: 4 });
    expect(wrapper.find(PAGE_SIZE_SELECT).exists()).toBe(true);
  });

  it("suppresses the page-size select when the whole set fits the smallest page", () => {
    expect(mountPager().find(PAGE_SIZE_SELECT).exists()).toBe(false);
  });

  it("still states the total while the select is suppressed", () => {
    expect(mountPager().find(INFO).text()).toContain("of 4");
  });

  it("keeps the select when the total is only a lower bound", () => {
    const wrapper = mountPager({ totalCount: 4, totalCountExact: false });
    expect(wrapper.find(PAGE_SIZE_SELECT).exists()).toBe(true);
  });

  it("draws the select once the set outgrows the smallest page", () => {
    const wrapper = mountPager();
    expect(wrapper.find(PAGE_SIZE_SELECT).exists()).toBe(false);
    expect(
      mountPager({ totalCount: 11, showingTo: 11, totalPages: 2, isFirstPage: false })
        .find(PAGE_SIZE_SELECT)
        .exists(),
    ).toBe(true);
  });
});

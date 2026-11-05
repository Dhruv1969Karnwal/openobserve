// Copyright 2026 OpenObserve Inc.

import { describe, it, expect } from "vitest";
import { isUnnamedCountChip } from "./countChipName";

const el = (html: string): Element => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.firstElementChild as Element;
};

describe("isUnnamedCountChip", () => {
  it("flags a chip whose entire name is a digit", () => {
    expect(isUnnamedCountChip(el('<span class="chip">6</span>'))).toBe(true);
  });

  it("accepts a chip that states its noun", () => {
    expect(isUnnamedCountChip(el('<span class="chip"><span>Streams</span> 6</span>'))).toBe(false);
  });

  it("accepts a chip an aria-label names", () => {
    expect(isUnnamedCountChip(el('<span aria-label="6 streams">6</span>'))).toBe(false);
  });

  it("leaves a decorative chip alone", () => {
    expect(isUnnamedCountChip(el('<span aria-hidden="true">6</span>'))).toBe(false);
  });
});

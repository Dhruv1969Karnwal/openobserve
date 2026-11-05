// Copyright 2026 OpenObserve Inc.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const baseElements = readFileSync(join(here, "base-elements.css"), "utf8");
const utilities = readFileSync(join(here, "utilities.css"), "utf8");

// 170 `outline-none` sites strip the UA focus ring without naming a substitute,
// so the app owes one baseline rule that a component's own ring can still beat.
describe("global focus baseline", () => {
  it("paints :focus-visible for every natively focusable affordance", () => {
    const rule = baseElements.slice(
      baseElements.indexOf(":where("),
      baseElements.indexOf("outline-offset"),
    );
    for (const selector of [
      "a[href]",
      "button",
      "input",
      "select",
      "textarea",
      'role="button"',
      'role="checkbox"',
      'role="tab"',
      'role="menuitem"',
      'role="option"',
      '[tabindex]:not([tabindex="-1"])',
    ]) {
      expect(rule, selector).toContain(selector);
    }
  });

  it("draws the ring from the contrast-cleared focus token, not a palette colour", () => {
    expect(baseElements).toContain("outline: 0.125rem solid var(--color-focus-ring-accent);");
  });

  it("keeps the rule at zero specificity so a component's own ring wins", () => {
    expect(baseElements).toMatch(/:where\([\s\S]*?\):focus-visible/);
  });
});

describe("shared selection affordance", () => {
  it("pairs the tint with a 3px edge drawn from the selection token", () => {
    expect(utilities).toMatch(
      /@utility list-selected-edge\s*\{[^}]*box-shadow:\s*inset 0\.1875rem 0 0 var\(--color-border-strong\)/,
    );
  });
});

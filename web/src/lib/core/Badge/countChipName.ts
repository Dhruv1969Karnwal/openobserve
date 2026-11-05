// Copyright 2026 OpenObserve Inc.

/** True when a chip's whole name is digits, so assistive tech says "6" and nothing else. */
export function isUnnamedCountChip(el: Element): boolean {
  if (
    el.hasAttribute("aria-label") ||
    el.hasAttribute("aria-labelledby") ||
    el.getAttribute("role") === "presentation" ||
    el.getAttribute("aria-hidden") === "true"
  ) {
    return false;
  }
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("[aria-hidden='true']").forEach((n) => n.remove());
  const text = clone.textContent?.trim() ?? "";
  return text.length > 0 && /^[\d.,+\s]+$/.test(text);
}

export const UNNAMED_COUNT_DELAY_MS = 1000;

/** Dev-only nudge for a count chip that never names what it counts. */
export function warnIfUnnamedCount(el: Element | null | undefined) {
  if (!el || !import.meta.env.DEV || import.meta.env.MODE === "test") return;
  if (isUnnamedCountChip(el)) {
    console.warn(
      "[OBadge] numeric badge has no noun; pass countNoun or aria-label so the count is not the only signal",
      el,
    );
  }
}

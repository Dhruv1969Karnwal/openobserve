// Copyright 2026 OpenObserve Inc.

// Landing-page scroll reveal. Elements opt in with data-reveal (and optional
// data-reveal-step for stagger order). They are VISIBLE by default; JS marks
// them hidden then reveals each one as it enters the viewport, so no-JS and
// reduced-motion visitors always see the full content.
import { onBeforeUnmount, onMounted, type Ref } from "vue";

const STEP_MS = 80;

export function useLandingReveal(root: Ref<HTMLElement | null>) {
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = root.value;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const t = entry.target as HTMLElement;
          const step = Number(t.dataset.revealStep ?? "0");
          t.style.transitionDelay = `${step * STEP_MS}ms`;
          t.classList.add("landing-reveal-in");
          observer?.unobserve(t);
        }
      },
      { threshold: 0.15, rootMargin: "0rem 0rem -3rem 0rem" },
    );

    for (const t of targets) {
      t.classList.add("landing-reveal-wait");
      observer.observe(t);
    }
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });
}

export function smoothScrollTo(target: HTMLElement | null, reduce: boolean) {
  if (!target) return;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

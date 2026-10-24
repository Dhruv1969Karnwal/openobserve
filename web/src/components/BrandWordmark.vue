<!-- Copyright 2026 OpenObserve Inc.

     The product's own wordmark: the mark, and "Retrace.ai" set in the same
     typeface the rest of the UI uses.

     WHY THIS IS MARKUP AND NOT AN .svg FILE
     The wordmarks this replaced (web/src/assets/images/common/
     retrace_wordmark_{dark,light}.svg) were external SVG files containing live
     <text font-family="Inter, …">, loaded through <img src>. Two things follow
     from that and neither is fixable inside the file: an <img>-loaded external
     SVG is an isolated document that cannot reach the page's webfonts — the app
     ships Geist and Geist Mono only (tokens/base.css) — and the ink is baked in,
     so the mark needs one file per theme. The result measured at real header
     size was a fallback-font wordmark sitting in ~38% dead canvas, because the
     glyph metrics the file was drawn against are not the metrics any host has.
     Rendering the word here means it uses the design system's font, weight,
     tracking and colour tokens, one implementation for both themes, and it stays
     selectable/legible at any zoom.
-->

<template>
  <span
    :data-test="testId"
    :class="['inline-flex shrink-0 items-center', size === 'hero' ? 'gap-2.5' : 'gap-2']"
    role="img"
    :aria-label="name"
  >
    <svg
      :class="['shrink-0', size === 'hero' ? 'h-8 w-8' : 'h-7 w-7 max-md:h-6 max-md:w-6']"
      viewBox="14 72 96 96"
      aria-hidden="true"
      focusable="false"
      data-test="brand-wordmark-mark"
    >
      <rect class="brand-plate" x="14" y="72" width="96" height="96" rx="14" />
      <path
        class="brand-glyph"
        d="M36 120h14l10-26 12 52 10-26h16"
        fill="none"
        stroke-width="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <span
      :class="[
        'brand-word font-sans leading-none font-medium tracking-tight whitespace-nowrap',
        size === 'hero' ? 'text-2xl max-md:text-xl' : 'text-lg max-md:text-base',
      ]"
      >{{ brand }}<span class="brand-suffix">{{ suffix }}</span></span
    >
  </span>
</template>

<script setup lang="ts">
import { raw, type I18nText } from "@/types/i18n";

/* A brand token, not copy: raw() marks it deliberately untranslated. */
const brand = raw("Retrace");
const suffix = raw(".ai");

// `hero` is the login/About scale; the default fits the 2.5rem app bar.
withDefaults(
  defineProps<{
    size?: "header" | "hero";
    testId?: string;
    name?: I18nText;
  }>(),
  // Callers pass t(...) for localised alt text; the default is a brand token.
  { size: "header", testId: "brand-wordmark", name: raw("Retrace.ai") },
);
</script>

<style scoped>
/* Token colours only, so one implementation covers both themes: no dark/light asset pair. */
.brand-mark {
  fill: var(--color-text-heading);
}

.brand-glyph {
  stroke: var(--color-surface-base);
}

.brand-word {
  color: var(--color-text-heading);
}

/* The suffix sits a tier down so the name reads as one unit, and stays above AA on every surface. */
.brand-suffix {
  color: var(--color-text-secondary);
}
</style>

<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Closing statement with the action inline on the baseline (direction: "a
// sentence with a blank" — the blank is the button, since there is no form
// backend to fake). A real anchor keeps keyboard and middle-click semantics.
import { useI18nTyped } from "@/types/i18n";
import { getPath } from "@/utils/queryUtils";

const { t } = useI18nTyped();
const base = getPath();
</script>

<template>
  <section aria-labelledby="cta-h" class="mx-auto max-w-7xl px-6 py-32 md:px-10 md:py-44">
    <h2
      id="cta-h"
      class="cta-sentence text-text-heading max-w-[22ch] leading-none font-semibold tracking-tight"
      data-reveal
    >
      {{ t("welcome.cta.sentence") }}
      <a
        :href="base + 'login'"
        class="cta-inline-btn rounded-default bg-button-primary text-button-primary-foreground hover:bg-button-primary-hover focus-visible:outline-focus-ring-accent inline-block px-[0.3em] leading-normal font-semibold whitespace-nowrap no-underline focus-visible:outline-2 focus-visible:outline-offset-4"
        data-landing-cta="final"
        data-test="landing-cta-button"
        >{{ t("welcome.cta.button") }}</a
      >
    </h2>
    <p class="text-text-secondary mt-6 text-base md:text-lg" data-reveal data-reveal-step="1">
      {{ t("welcome.cta.note") }}
    </p>
  </section>
</template>

<style scoped>
/* keep(brand): the statement scale is a fluid vw clamp; no fixed utility step exists. */
.cta-sentence {
  font-size: clamp(2.25rem, 6vw, 5rem);
}
</style>

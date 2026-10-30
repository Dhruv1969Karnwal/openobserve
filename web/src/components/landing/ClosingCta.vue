<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Closing statement: headline, one line of ground, the standard primary
// action at its standard size (the round-1 council rejected the inline
// baseline block as a collision and a scale break).
import { useI18nTyped } from "@/types/i18n";
import { getPath } from "@/utils/queryUtils";

const { t } = useI18nTyped();
const base = getPath();
</script>

<template>
  <section aria-labelledby="cta-h" class="bg-text-heading">
    <div
      class="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-24 md:px-10 md:py-28 lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <h2
          id="cta-h"
          class="cta-sentence text-surface-base leading-[1.04] font-semibold tracking-tight"
          data-reveal
        >
          {{ t("welcome.cta.sentence") }}
        </h2>
        <p
          class="text-surface-base mt-4 max-w-xl text-base leading-relaxed md:text-lg"
          data-reveal
          data-reveal-step="1"
        >
          {{ t("welcome.cta.note") }}
        </p>
      </div>
      <a
        :href="base + 'login'"
        class="rounded-default bg-surface-base text-text-heading focus-visible:outline-surface-base hover:bg-surface-panel inline-flex h-12 shrink-0 items-center px-6 text-base font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4"
        data-landing-cta="final"
        data-test="landing-cta-button"
        data-reveal
        data-reveal-step="2"
        >{{ t("welcome.cta.button") }}</a
      >
    </div>
  </section>
</template>

<style scoped>
/* keep(brand): the closing statement carries the marketing display scale
   (fluid vw clamp); no fixed utility step exists for it. */
.cta-sentence {
  font-size: clamp(2rem, 3vw + 1rem, 3.5rem);
  max-width: 26ch;
}
</style>

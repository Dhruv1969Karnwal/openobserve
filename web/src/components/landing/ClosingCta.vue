<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Closing statement: left-anchored composition — headline, ground, and the
// standard primary action under the copy, on the shared page grid.
import { useI18nTyped } from "@/types/i18n";
import { getPath } from "@/utils/queryUtils";

const { t } = useI18nTyped();
const base = getPath();
</script>

<template>
  <section aria-labelledby="cta-h" class="bg-text-heading">
    <div class="mx-auto max-w-7xl px-6 py-14 md:px-10 md:py-20">
      <h2
        id="cta-h"
        class="cta-sentence text-surface-base leading-[1.04] font-semibold tracking-tight text-balance"
        data-test="landing-cta-heading"
      >
        {{ t("welcome.cta.sentence") }}
      </h2>
      <p
        class="text-surface-base mt-5 max-w-xl text-lg leading-relaxed"
        data-reveal
        data-reveal-step="1"
      >
        {{ t("welcome.cta.note") }}
      </p>
      <a
        :href="base + 'login'"
        class="rounded-default text-text-heading hover:bg-surface-panel focus-visible:ring-offset-surface-base focus-visible:ring-surface-base mt-10 inline-flex h-12 items-center justify-center px-6 text-base font-medium transition-colors duration-150 outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-offset-2"
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

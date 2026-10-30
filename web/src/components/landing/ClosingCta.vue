<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Closing statement with the action inline on the baseline (direction: "a
// sentence with a blank" — the blank is the button, since there is no form
// backend to fake).
import { useI18nTyped } from "@/types/i18n";

const { t } = useI18nTyped();
</script>

<template>
  <section aria-labelledby="cta-h" class="mx-auto max-w-7xl px-6 py-32 md:px-10 md:py-44">
    <h2 id="cta-h" class="cta-sentence text-text-heading" data-reveal>
      {{ t("welcome.cta.sentence") }}
      <RouterLink to="/login" custom v-slot="{ navigate }">
        <button
          type="button"
          class="cta-inline-btn focus-visible:outline-focus-ring-accent focus-visible:outline-2 focus-visible:outline-offset-4"
          data-landing-cta="final"
          data-test="landing-cta-button"
          @click="navigate"
        >
          {{ t("welcome.cta.button") }}
        </button>
      </RouterLink>
    </h2>
    <p class="text-text-secondary mt-6 text-base md:text-lg" data-reveal data-reveal-step="1">
      {{ t("welcome.cta.note") }}
    </p>
  </section>
</template>

<style scoped>
/* keep(brand): the action sits ON the sentence baseline — its box is one line-height
   of the fluid heading, which only em-relative sizing can express. */
.cta-inline-btn {
  display: inline-block;
  border-radius: var(--radius-default);
  padding-inline: 0.3em;
  line-height: 1.15;
  font-weight: var(--font-semibold);
}
</style>

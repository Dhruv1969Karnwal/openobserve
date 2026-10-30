<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Capabilities as switchable sentences (direction: "Sentences with switches").
// Off = page ground, soft ink. On = inverted field (the product's own
// primary-by-inversion signature - the monochrome brand forbids a hue per band).
// The consequence line only exists in the On state.
import { ref } from "vue";
import { useI18nTyped } from "@/types/i18n";

const { t } = useI18nTyped();

const BANDS = [
  { n: 1, s: "welcome.bands.b1", c: "welcome.bands.b1c" },
  { n: 2, s: "welcome.bands.b2", c: "welcome.bands.b2c" },
  { n: 3, s: "welcome.bands.b3", c: "welcome.bands.b3c" },
  { n: 4, s: "welcome.bands.b4", c: "welcome.bands.b4c" },
  { n: 5, s: "welcome.bands.b5", c: "welcome.bands.b5c" },
] as const;

const bands = ref<Record<number, boolean>>({ 1: true, 2: true, 3: false, 4: false, 5: false });

function toggle(i: number) {
  bands.value[i] = !bands.value[i];
}
</script>

<template>
  <section id="capabilities" aria-labelledby="capabilities-h" class="scroll-mt-24">
    <div class="mx-auto max-w-7xl px-6 pt-28 md:px-10 md:pt-36">
      <h2
        id="capabilities-h"
        class="text-text-heading text-2xl font-semibold tracking-tight"
        data-reveal
      >
        {{ t("welcome.bands.heading") }}
      </h2>
      <p class="text-text-secondary mt-3 text-base">{{ t("welcome.bands.note") }}</p>
    </div>

    <div class="mt-14 flex flex-col">
      <template v-for="b in BANDS" :key="b.n">
        <div
          v-if="bands[b.n]"
          class="bg-text-heading flex min-h-40 items-center md:min-h-44"
          data-reveal
        >
          <div
            class="mx-auto grid w-full max-w-7xl grid-cols-12 items-center gap-x-6 px-6 py-10 md:px-10"
          >
            <div class="col-span-9 md:col-span-10">
              <p class="band-sentence text-surface-base">{{ t(b.s) }}.</p>
              <p class="text-surface-base mt-3 max-w-3xl text-base leading-relaxed md:text-lg">
                {{ t(b.c) }}
              </p>
            </div>
            <div class="col-span-3 flex justify-end md:col-span-2">
              <button
                type="button"
                role="switch"
                :aria-checked="true"
                :aria-label="t('welcome.bands.toggleDetail', { sentence: t(b.s) })"
                data-test="landing-band-switch"
                class="border-surface-base bg-surface-base focus-visible:outline-surface-base relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 px-0.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                @click="toggle(b.n)"
              >
                <span
                  class="bg-text-heading block size-5 translate-x-5 rounded-full"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
        <div v-else class="bg-surface-base flex min-h-40 items-center md:min-h-44" data-reveal>
          <div
            class="mx-auto grid w-full max-w-7xl grid-cols-12 items-center gap-x-6 px-6 py-10 md:px-10"
          >
            <div class="col-span-9 md:col-span-10">
              <p class="band-sentence text-text-secondary">{{ t(b.s) }}.</p>
            </div>
            <div class="col-span-3 flex justify-end md:col-span-2">
              <button
                type="button"
                role="switch"
                :aria-checked="false"
                :aria-label="t('welcome.bands.toggleDetail', { sentence: t(b.s) })"
                data-test="landing-band-switch"
                class="border-border-strong focus-visible:outline-focus-ring-accent relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 bg-transparent px-0.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                @click="toggle(b.n)"
              >
                <span
                  class="bg-border-strong block size-5 translate-x-0 rounded-full"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
/* keep(brand): the fluid display step for the sentence rows is the landing
   type system itself — no fixed utility step expresses the 1.5rem–2.75rem ramp. */
.band-sentence {
  font-size: clamp(1.5rem, 3vw, 2.75rem);
  line-height: 1.08;
  letter-spacing: var(--tracking-tight);
  font-weight: var(--font-medium);
}
</style>

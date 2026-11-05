<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Ingestion section: the literal first command plus a four-segment control
// that walks the same request through its life. Selection is explicit —
// nothing moves on its own (WCAG 2.2.2).
import { ref } from "vue";
import { useI18nTyped } from "@/types/i18n";

const { t } = useI18nTyped();

const STAGES = ["c0", "c1", "c2", "c3"] as const;
const stage = ref(0);

const go = (i: number) => {
  stage.value = ((i % STAGES.length) + STAGES.length) % STAGES.length;
};
const onKey = (e: KeyboardEvent) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    e.preventDefault();
    go(stage.value + 1);
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    go(stage.value - 1);
  }
};
</script>

<template>
  <section id="how-it-works" aria-labelledby="how-h" class="bg-surface-subtle scroll-mt-24">
    <div class="mx-auto max-w-7xl px-6 py-14 md:px-10 md:py-16">
      <h2
        id="how-h"
        class="text-text-heading text-2xl font-semibold tracking-tight md:text-3xl"
        data-reveal
      >
        {{ t("welcome.stages.heading") }}
      </h2>

      <div
        role="tablist"
        :aria-label="t('welcome.stages.heading')"
        class="bg-surface-panel border-border-subtle rounded-surface mt-6 grid grid-cols-2 gap-1 border p-1 md:grid-cols-4"
        data-test="landing-steps"
        data-stages="4"
        :data-stage="stage"
      >
        <button
          v-for="(st, i) in STAGES"
          :key="st"
          type="button"
          role="tab"
          class="rounded-default text-compact focus-visible:ring-text-heading flex min-h-11 items-center gap-2 px-3 py-2 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:justify-center"
          :class="
            i === stage
              ? 'bg-text-heading text-surface-panel'
              : 'text-text-heading hover:bg-surface-base'
          "
          :aria-selected="i === stage"
          :tabindex="i === stage ? 0 : -1"
          data-test="landing-stage-name"
          @click="go(i)"
          @keydown="onKey"
        >
          <span
            class="font-mono text-xs tabular-nums"
            :class="i === stage ? 'text-surface-panel' : 'text-text-body'"
            aria-hidden="true"
            >{{ String(i + 1).padStart(2, "0") }}</span
          >
          {{ t("welcome.stages." + st.replace("c", "nm")) }}
        </button>
      </div>

      <div class="mt-8 grid grid-cols-1 items-start gap-x-10 gap-y-8 lg:grid-cols-2">
        <div data-reveal>
          <p class="stage-clause text-text-heading text-balance">
            {{ t("welcome.stages." + STAGES[stage]) }}
          </p>
        </div>
        <div class="rounded-surface border-border-subtle bg-surface-panel border" data-reveal>
          <div class="border-border-subtle flex items-center border-b px-4 py-2">
            <p class="text-text-body font-mono text-xs">{{ t("welcome.stages.terminal") }}</p>
          </div>
          <!-- eslint-disable vue/no-bare-strings-in-template -->
          <pre
            class="text-text-code overflow-hidden px-4 py-4 font-mono text-xs leading-6 whitespace-pre-wrap"
            data-test="landing-curl"
          ><code>curl -u you@corp.com:•••••• -k \
  http://localhost:5080 \
  /api/default/app_logs/_json \
  -d '{"level":"info",
    "msg":"charge accepted"}'</code></pre>
          <!-- eslint-enable vue/no-bare-strings-in-template -->
          <div class="border-border-subtle flex items-center gap-2 border-t px-4 py-2">
            <span class="text-text-body font-mono text-xs" aria-hidden="true">→</span>
            <p class="text-text-heading font-mono text-xs" data-test="landing-stage-outcome">
              {{ t("welcome.stages.out" + stage) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* keep(brand): clause line sits between heading and body sizes with the
   brand's tight tracking; no utility covers it. */
.stage-clause {
  font-size: clamp(1.375rem, 1.6vw + 0.8rem, 1.75rem);
  line-height: 1.12;
  letter-spacing: var(--tracking-tight);
  font-weight: var(--font-semibold);
}
</style>

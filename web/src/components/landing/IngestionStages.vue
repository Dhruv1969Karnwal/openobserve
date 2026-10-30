<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Ingestion section: the literal first command, and a connected four-segment
// control that walks the product through what happens to that one request.
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18nTyped } from "@/types/i18n";
import { CURL } from "./sampleData";

const { t } = useI18nTyped();

const STAGES = ["c0", "c1", "c2", "c3"] as const;
const stage = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

const go = (i: number) => {
  stage.value = ((i % STAGES.length) + STAGES.length) % STAGES.length;
};
const start = () => {
  stop();
  timer = setInterval(() => {
    stage.value = (stage.value + 1) % STAGES.length;
  }, 4200);
};
const stop = () => {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
};
const onKey = (e: KeyboardEvent) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    e.preventDefault();
    go(stage.value + 1);
    stop();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    go(stage.value - 1);
    stop();
  }
};

let io: IntersectionObserver | undefined;
const sectionEl = ref<HTMLElement | null>(null);
if (typeof IntersectionObserver !== "undefined") {
  io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) start();
        else stop();
      }
    },
    { threshold: 0.25 },
  );
}
onMounted(() => {
  if (sectionEl.value && io) io.observe(sectionEl.value);
});

onBeforeUnmount(() => {
  stop();
  io?.disconnect();
});
</script>

<template>
  <section id="how-it-works" aria-labelledby="how-h" class="bg-surface-subtle scroll-mt-24">
    <div ref="sectionEl" class="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
      <h2
        id="how-h"
        class="text-text-heading text-2xl font-semibold tracking-tight text-balance md:text-3xl"
        data-reveal
      >
        {{ t("welcome.stages.heading") }}
      </h2>

      <div class="mt-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <p class="stage-clause text-text-heading text-balance" data-reveal>
          {{ t("welcome.stages.c" + stage) }}
        </p>
        <div class="rounded-surface border-border-subtle bg-surface-panel border" data-reveal>
          <div
            class="border-border-subtle flex items-center justify-between gap-4 border-b px-4 py-2"
          >
            <p class="text-text-secondary font-mono text-xs">{{ t("welcome.stages.terminal") }}</p>
          </div>
          <pre
            class="text-text-code overflow-x-auto px-4 py-4 font-mono text-xs leading-6 break-all whitespace-pre-wrap"
            data-test="landing-curl"
          ><!-- eslint-disable vue/no-bare-strings-in-template --><code>curl -u [EMAIL]:[PASSCODE] -k \
  {{ CURL.url }} \
  -d '{{ CURL.body }}'</code><!-- eslint-enable vue/no-bare-strings-in-template --></pre>
          <div class="border-border-subtle flex items-center gap-2 border-t px-4 py-2">
            <span class="text-text-secondary font-mono" aria-hidden="true">→</span>
            <p class="text-text-heading font-mono text-xs" data-test="landing-stage-outcome">
              {{ t("welcome.stages.ok") }}
            </p>
          </div>
        </div>
      </div>

      <div class="mt-12" data-reveal>
        <div
          class="rounded-surface border-border-strong grid grid-cols-2 gap-px overflow-hidden border md:grid-cols-4"
          role="tablist"
          @focusin="stop()"
          :aria-label="t('welcome.stages.heading')"
          data-test="landing-steps"
          data-stages="4"
          :data-stage="stage"
        >
          <button
            v-for="(st, i) in STAGES"
            :key="st"
            type="button"
            role="tab"
            class="text-compact focus-visible:ring-text-heading flex min-h-12 items-center justify-center gap-2 rounded-none px-3 py-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset"
            :class="
              i === stage
                ? 'bg-surface-active text-text-heading'
                : 'bg-surface-panel text-text-body hover:bg-surface-subtle'
            "
            :aria-selected="i === stage"
            :tabindex="i === stage ? 0 : -1"
            data-test="landing-stage-name"
            @click="((stage = i), stop())"
            @keydown="onKey"
          >
            <span class="text-text-secondary font-mono text-xs tabular-nums" aria-hidden="true">{{
              String(i + 1).padStart(2, "0")
            }}</span>
            {{ t("welcome.stages." + st) }}
          </button>
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

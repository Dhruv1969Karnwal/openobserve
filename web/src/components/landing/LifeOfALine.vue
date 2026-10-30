<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Showcase: one row of the example stream, shown three times - as it arrives,
// selected with its JSON open (live: click the row), and with the alert it
// fired. The middle copy works: it is the product's row + JSON preview.
import { ref } from "vue";
import { useI18nTyped } from "@/types/i18n";
import { SAMPLE_JSON_FIELDS } from "./sampleData";

const { t } = useI18nTyped();
const openMid = ref(true);

const ROW = {
  time: "14:32:06.902",
  level: "error",
  message: "upstream timeout service=billing",
  duration: "5.0s",
};

const QUOTE = String.fromCharCode(34);
const SEP = ": ";

function shortTime(t: string): string {
  return t.length > 8 ? t.slice(0, 8) : t;
}

function quoted(v: string): string {
  return QUOTE + v + QUOTE;
}

function jsonClass(kind: string): string {
  return kind === "bool" ? "log-boolean" : "log-" + kind;
}
</script>

<template>
  <section
    id="one-line"
    aria-labelledby="one-line-h"
    class="mx-auto max-w-7xl scroll-mt-24 px-6 py-16 md:px-10 md:py-24"
  >
    <h2
      id="one-line-h"
      class="text-text-heading text-2xl font-semibold tracking-tight md:text-3xl"
      data-reveal
    >
      {{ t("welcome.oneLine.heading") }}
    </h2>

    <div class="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-y-6 md:grid-cols-12 md:gap-y-10">
      <!-- arrives -->
      <div class="col-span-12 text-right md:col-span-3 md:pe-8" data-reveal>
        <p class="text-text-heading text-xl font-medium">{{ t("welcome.oneLine.arrives") }}</p>
        <p class="text-compact text-text-secondary mt-1">{{ t("welcome.oneLine.arrivesNote") }}</p>
      </div>
      <div class="md:col-span-9" data-reveal data-reveal-step="1">
        <div
          data-ui
          class="rounded-surface border-border-subtle bg-surface-panel overflow-hidden border"
        >
          <div
            class="grid grid-cols-[4.6rem_auto_1fr] items-baseline gap-x-2.5 px-3 py-2.5 lg:grid-cols-[5.6rem_auto_1fr_3.5rem]"
          >
            <span class="text-2xs text-text-secondary font-mono tabular-nums">{{
              shortTime(ROW.time)
            }}</span>
            <span
              class="border-log-severity-error-indicator bg-surface-subtle text-2xs text-log-severity-error-indicator rounded-xs border-s-2 px-1.5 py-px font-mono leading-4"
            >
              {{ ROW.level }}
            </span>
            <span class="text-compact text-text-body truncate">{{ ROW.message }}</span>
            <span
              class="text-2xs text-text-secondary hidden text-end font-mono tabular-nums lg:block"
            >
              {{ ROW.duration }}
            </span>
          </div>
          <p class="border-border-subtle text-2xs text-text-secondary border-t px-3 py-2 font-mono">
            {{ t("welcome.oneLine.ingested") }}
          </p>
        </div>
      </div>

      <!-- selected (live) -->
      <div class="col-span-12 text-right md:col-span-3 md:pe-8" data-reveal>
        <p class="text-text-heading text-xl font-medium">{{ t("welcome.oneLine.look") }}</p>
        <p class="text-compact text-text-secondary mt-1">{{ t("welcome.oneLine.lookNote") }}</p>
      </div>
      <div class="md:col-span-9" data-reveal data-reveal-step="1">
        <div
          data-ui
          class="rounded-surface border-border-subtle bg-surface-panel overflow-hidden border"
        >
          <button
            type="button"
            class="hover:bg-surface-subtle focus-visible:ring-focus-ring-accent grid w-full grid-cols-[4.6rem_auto_1fr] items-baseline gap-x-2.5 px-3 py-2.5 text-start transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-inset lg:grid-cols-[5.6rem_auto_1fr_3.5rem]"
            :aria-expanded="openMid"
            data-test="landing-line-row"
            @click="openMid = !openMid"
          >
            <span class="text-2xs text-text-secondary font-mono tabular-nums">{{
              shortTime(ROW.time)
            }}</span>
            <span
              class="border-log-severity-error-indicator bg-surface-subtle text-2xs text-log-severity-error-indicator rounded-xs border-s-2 px-1.5 py-px font-mono leading-4"
            >
              {{ ROW.level }}
            </span>
            <span class="text-compact text-text-body truncate">{{ ROW.message }}</span>
            <span
              class="text-2xs text-text-secondary hidden text-end font-mono tabular-nums lg:block"
            >
              {{ ROW.duration }}
            </span>
          </button>
          <div
            v-if="openMid"
            class="log-highlight border-border-subtle bg-surface-subtle border-t px-3 py-2.5"
          >
            <div v-for="pair in SAMPLE_JSON_FIELDS" :key="pair[0]" class="leading-5">
              <span class="log-key">{{ quoted(pair[0]) }}</span>
              <span class="log-separator">{{ SEP }}</span>
              <span :class="jsonClass(pair[2])">{{ quoted(pair[1]) }}</span>
            </div>
          </div>
        </div>
        <p
          v-if="openMid"
          class="text-compact text-text-secondary mt-2"
          data-test="landing-line-live-note"
        >
          {{ t("welcome.oneLine.liveNote") }}
        </p>
      </div>

      <!-- alarmed -->
      <div class="col-span-12 text-right md:col-span-3 md:pe-8" data-reveal>
        <p class="text-text-heading text-xl font-medium">{{ t("welcome.oneLine.warns") }}</p>
        <p class="text-compact text-text-secondary mt-1">{{ t("welcome.oneLine.warnsNote") }}</p>
      </div>
      <div class="md:col-span-9" data-reveal data-reveal-step="1">
        <div
          data-ui
          class="rounded-surface border-border-subtle bg-surface-panel overflow-hidden border"
        >
          <div class="flex items-center gap-2.5 px-3 py-2.5">
            <span
              class="rounded-default border-border-subtle bg-surface-base text-2xs text-text-heading border px-2 py-0.5 font-mono"
            >
              {{ t("welcome.oneLine.alertName") }}
            </span>
            <span class="text-compact text-text-body">{{ t("welcome.oneLine.alertCond") }}</span>
          </div>
          <div class="border-border-subtle border-t px-3 py-2.5">
            <p class="text-compact text-text-body">{{ t("welcome.oneLine.alertFired") }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <span
                class="rounded-default bg-surface-subtle text-2xs text-text-heading inline-flex h-6 items-center gap-1.5 px-2"
              >
                <span class="bg-text-heading size-1.5 rounded-full" aria-hidden="true" />
                {{ t("welcome.stages.tEmail") }}
              </span>
              <span
                class="rounded-default bg-surface-subtle text-2xs text-text-heading inline-flex h-6 items-center gap-1.5 px-2"
              >
                <span class="bg-text-heading size-1.5 rounded-full" aria-hidden="true" />
                {{ t("welcome.stages.tWebhook") }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Hero: the product performs. The claim on the left; the real log-search UI —
// the app's own controls over example stream data — works at real size beside
// it. Below lg the fragment falls under the copy at its natural width.
import { useI18nTyped } from "@/types/i18n";
import { getPath } from "@/utils/queryUtils";
import LogFragment from "./LogFragment.vue";

const { t } = useI18nTyped();
const base = getPath();

function reduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
}
</script>

<template>
  <section aria-labelledby="hero-lead" class="mx-auto max-w-7xl px-6 pt-14 pb-20 md:px-10 md:pt-20">
    <div
      class="grid grid-cols-1 items-start gap-x-14 gap-y-12 lg:grid-cols-[26rem_minmax(0,1fr)] xl:grid-cols-[30rem_minmax(0,1fr)] xl:gap-x-20"
    >
      <div>
        <h1
          id="hero-lead"
          class="landing-h1 text-text-heading leading-[0.98] font-semibold tracking-tight"
          data-test="landing-h1"
        >
          <span class="landing-h1-line block">
            <span class="landing-h1-word block">{{ t("welcome.hero.line1") }}</span>
          </span>
          <span class="landing-h1-line block">
            <span class="landing-h1-word block">{{ t("welcome.hero.line2") }}</span>
          </span>
        </h1>
        <p class="text-text-body mt-6 text-lg leading-relaxed" data-reveal data-reveal-step="1">
          {{ t("welcome.hero.sub") }}
        </p>
        <div
          class="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4"
          data-reveal
          data-reveal-step="2"
        >
          <a
            :href="base + 'login'"
            class="rounded-default bg-button-primary text-button-primary-foreground hover:bg-button-primary-hover active:bg-button-primary-active focus-visible:ring-text-heading inline-flex h-12 items-center px-6 text-base font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            data-landing-cta="get-started"
            data-test="landing-hero-cta"
            >{{ t("welcome.hero.cta") }}</a
          >
          <a
            href="#how-it-works"
            class="rounded-default text-text-body hover:text-text-heading focus-visible:ring-text-heading text-base underline underline-offset-4 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            data-test="landing-hero-secondary"
            @click.prevent="scrollToSection('how-it-works')"
            >{{ t("welcome.hero.secondary") }}</a
          >
        </div>
        <p
          class="text-compact text-text-secondary mt-8 leading-relaxed"
          data-reveal
          data-reveal-step="3"
          data-test="landing-hero-facts"
        >
          {{ t("welcome.hero.facts") }}
        </p>
      </div>

      <div data-reveal data-reveal-step="1">
        <LogFragment />
        <p class="text-compact text-text-secondary mt-3" data-test="landing-fragment-caption">
          {{ t("welcome.hero.caption") }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* keep(keyframes): the hero line-mask entrance is this page's signature motion;
   the display scale is a fluid clamp tuned to the two-column measure. */
.landing-h1 {
  font-size: clamp(2.75rem, 3.4vw + 1.5rem, 4.75rem);
}
.landing-h1-line {
  overflow: hidden;
}
.landing-h1-word {
  animation: landing-line-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.landing-h1-line:nth-child(2) .landing-h1-word {
  animation-delay: 0.09s;
}

@keyframes landing-line-rise {
  from {
    transform: translateY(110%);
  }
  to {
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-h1-word {
    animation: none;
  }
}
</style>

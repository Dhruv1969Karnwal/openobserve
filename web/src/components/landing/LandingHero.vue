<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Hero: the product performs. The headline states the claim; below it the real
// log-search UI runs live on the page (example stream data, real controls).
import { useI18nTyped } from "@/types/i18n";
import LogFragment from "./LogFragment.vue";

const { t } = useI18nTyped();

function reduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
}
</script>

<template>
  <section aria-labelledby="hero-lead" class="mx-auto max-w-7xl px-6 pt-16 pb-24 md:px-10 md:pt-24">
    <div class="max-w-3xl">
      <h1 id="hero-lead" class="landing-h1 text-text-heading" data-test="landing-h1">
        <span class="landing-h1-line block">
          <span class="landing-h1-word block">{{ t("welcome.hero.line1") }}</span>
        </span>
        <span class="landing-h1-line block">
          <span class="landing-h1-word block">{{ t("welcome.hero.line2") }}</span>
        </span>
      </h1>
      <p
        class="text-text-body mt-6 max-w-xl text-lg leading-relaxed md:text-xl"
        data-reveal
        data-reveal-step="1"
      >
        {{ t("welcome.hero.sub") }}
      </p>
      <div class="mt-10 flex flex-wrap items-center gap-6" data-reveal data-reveal-step="2">
        <RouterLink to="/login" custom v-slot="{ navigate }">
          <button
            type="button"
            class="rounded-default bg-button-primary text-button-primary-foreground hover:bg-button-primary-hover active:bg-button-primary-active focus-visible:outline-focus-ring-accent inline-flex h-12 items-center px-6 text-base font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
            data-landing-cta="get-started"
            data-test="landing-hero-cta"
            @click="navigate"
          >
            {{ t("welcome.hero.cta") }}
          </button>
        </RouterLink>
        <a
          href="#how-it-works"
          class="rounded-default text-text-body hover:text-text-heading focus-visible:outline-focus-ring-accent text-base underline underline-offset-4 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4"
          data-test="landing-hero-secondary"
          @click.prevent="scrollToSection('how-it-works')"
          >{{ t("welcome.hero.secondary") }}</a
        >
      </div>
    </div>

    <div class="mt-16" data-reveal data-reveal-step="1">
      <LogFragment />
      <p class="text-compact text-text-secondary mt-3" data-test="landing-fragment-caption">
        {{ t("welcome.hero.caption") }}
      </p>
    </div>
  </section>
</template>

<style scoped>
/* keep(keyframes): the hero line-mask entrance (clipped rise) is this page’s signature
   motion; the display scale is a fluid vw clamp with no app utility step. */

/* Display type: marketing scale, brand face. The clamp floors keep the
   two-line headline within two lines from 390px up (copy arithmetic). */
.landing-h1 {
  font-size: clamp(2.75rem, 7vw, 5.75rem);
  line-height: 0.98;
  letter-spacing: var(--tracking-tight);
  font-weight: var(--font-semibold);
}

/* Masked-line entrance: each line rises out of its own clip band. */
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

<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Landing navigation: wordmark, section anchors, the sign-in action, and a
// full-screen sheet on phones (Escape closes, focus returns to the button).
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18nTyped } from "@/types/i18n";
import BrandWordmark from "@/components/BrandWordmark.vue";
import { getPath } from "@/utils/queryUtils";

const { t } = useI18nTyped();
const base = getPath();
const scrolled = ref(false);
const open = ref(false);

const LINKS = [
  { href: "#capabilities", key: "welcome.nav.capabilities" },
  { href: "#how-it-works", key: "welcome.nav.ingestion" },
  { href: "#one-line", key: "welcome.nav.logLine" },
  { href: "#open-source", key: "welcome.nav.openSource" },
];

function onScroll() {
  scrolled.value = window.scrollY > 8;
}

function reduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function go(href: string) {
  open.value = false;
  const el = document.querySelector(href);
  if (el) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) open.value = false;
}

onMounted(() => {
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("keydown", onKey);
  onScroll();
});
onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <header
    class="sticky top-0 z-100 transition-colors duration-200"
    :class="scrolled || open ? 'bg-surface-panel' : 'bg-surface-base'"
    data-test="landing-nav"
  >
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10">
      <a
        :href="`${base}welcome`"
        class="rounded-default focus-visible:outline-focus-ring-accent focus-visible:outline-2 focus-visible:outline-offset-4"
        :aria-label="t('welcome.nav.home')"
      >
        <BrandWordmark test-id="landing-wordmark" />
      </a>

      <nav :aria-label="t('welcome.nav.sections')" class="hidden items-center gap-8 md:flex">
        <a
          v-for="l in LINKS"
          :key="l.href"
          :href="l.href"
          class="rounded-default text-text-secondary hover:text-text-heading focus-visible:outline-focus-ring-accent text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4"
          data-test="landing-nav-link"
          @click.prevent="go(l.href)"
          >{{ t(l.key) }}</a
        >
      </nav>

      <div class="flex items-center gap-2">
        <a
          :href="`${base}login`"
          class="rounded-default bg-button-primary text-button-primary-foreground hover:bg-button-primary-hover focus-visible:outline-focus-ring-accent hidden h-10 items-center px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 md:inline-flex"
          data-landing-cta="signin"
          data-test="landing-nav-signin"
          >{{ t("welcome.nav.signin") }}</a
        >
        <button
          type="button"
          class="rounded-default border-border-control text-text-heading focus-visible:outline-focus-ring-accent inline-flex h-10 w-10 items-center justify-center border focus-visible:outline-2 focus-visible:outline-offset-2 md:hidden"
          :aria-expanded="open"
          aria-controls="landing-sheet"
          :aria-label="t('welcome.nav.menu')"
          data-test="landing-nav-menu"
          @click="open = !open"
        >
          <span class="relative block h-3 w-4.5" aria-hidden="true">
            <span
              class="absolute inset-x-0 h-0.5 bg-current transition-transform duration-200 motion-reduce:transition-none"
              :class="open ? 'top-1.5 rotate-45' : 'top-0'"
            />
            <span
              class="absolute inset-x-0 h-0.5 bg-current transition-transform duration-200 motion-reduce:transition-none"
              :class="open ? 'top-1.5 -rotate-45' : 'top-3'"
            />
          </span>
        </button>
      </div>
    </div>

    <div
      id="landing-sheet"
      class="grid overflow-hidden transition-[grid-template-rows] duration-200 md:hidden"
      :class="open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    >
      <div class="min-h-0">
        <nav :aria-label="t('welcome.nav.sections')" class="flex flex-col gap-1 px-6 pb-6">
          <a
            v-for="l in LINKS"
            :key="l.href"
            :href="l.href"
            class="rounded-default text-text-heading focus-visible:outline-focus-ring-accent px-2 py-3 text-lg focus-visible:outline-2 focus-visible:outline-offset-2"
            data-test="landing-sheet-link"
            @click.prevent="go(l.href)"
            >{{ t(l.key) }}</a
          >
          <a
            :href="`${base}login`"
            class="rounded-default bg-button-primary text-button-primary-foreground focus-visible:outline-focus-ring-accent mt-2 inline-flex h-12 items-center justify-center px-6 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
            data-landing-cta="signin-sheet"
            data-test="landing-sheet-signin"
            >{{ t("welcome.nav.signin") }}</a
          >
        </nav>
      </div>
    </div>
  </header>
</template>

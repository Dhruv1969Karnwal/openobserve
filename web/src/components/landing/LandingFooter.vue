<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Footer as the closing board of tiles (direction: "a footer of tiles").
// The dealt email/city/time tiles were dropped - no honest content for them -
// and replaced by the attribution and legal facts that must be on page.
import { useI18nTyped } from "@/types/i18n";
import { getPath } from "@/utils/queryUtils";

const { t } = useI18nTyped();
const base = getPath();

const LINKS = [
  { href: "#capabilities", key: "welcome.nav.capabilities" },
  { href: "#how-it-works", key: "welcome.nav.ingestion" },
  { href: "#open-source", key: "welcome.nav.openSource" },
] as const;

function reduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function go(href: string) {
  const el = document.querySelector(href);
  if (el) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
}
</script>

<template>
  <footer class="p-2" :aria-label="t('welcome.footer.aria')" data-test="landing-footer">
    <div class="grid grid-cols-1 gap-2 md:grid-cols-12">
      <div
        class="rounded-surface bg-surface-panel flex flex-col justify-between p-6 md:col-span-4 md:p-8"
      >
        <p class="text-text-heading text-xl leading-snug font-medium">
          {{ t("welcome.footer.statement") }}
        </p>
        <p class="text-compact text-text-secondary mt-10 leading-relaxed" data-test="landing-legal">
          {{ t("welcome.footer.legal") }}
        </p>
      </div>

      <nav
        :aria-label="t('welcome.footer.aria')"
        class="rounded-surface bg-surface-panel p-6 md:col-span-3 md:p-8"
      >
        <ul class="flex flex-col gap-3 text-base">
          <li v-for="l in LINKS" :key="l.href">
            <a
              :href="l.href"
              class="rounded-default text-text-body hover:text-text-heading focus-visible:outline-focus-ring-accent transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
              data-test="landing-footer-link"
              @click.prevent="go(l.href)"
              >{{ t(l.key) }}</a
            >
          </li>
          <li>
            <a
              :href="`${base}login`"
              class="rounded-default text-text-body hover:text-text-heading focus-visible:outline-focus-ring-accent underline underline-offset-4 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
              data-test="landing-footer-signin"
              >{{ t("welcome.nav.signin") }}</a
            >
          </li>
        </ul>
      </nav>

      <div
        class="rounded-surface bg-surface-panel flex flex-col justify-between p-6 md:col-span-5 md:p-8"
      >
        <p class="text-text-heading text-xl font-medium" data-test="landing-author">
          {{ t("welcome.footer.author") }}
        </p>
        <p class="text-compact text-text-secondary mt-10 max-w-sm leading-relaxed">
          {{ t("welcome.footer.authorNote") }}
        </p>
      </div>

      <div
        class="rounded-surface bg-text-heading col-span-12 flex h-64 items-center justify-center md:h-80"
      >
        <svg
          viewBox="14 72 96 96"
          class="inline-block h-14 w-16 md:h-20 md:w-24"
          role="img"
          :aria-label="t('welcome.footer.wordmark')"
        >
          <rect x="14" y="72" width="96" height="96" rx="22" class="fill-surface-base" />
          <path
            d="M36 120h14l10-26 12 52 10-26h16"
            fill="none"
            class="stroke-text-heading"
            stroke-width="10"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="wordmark-big-text text-surface-base ms-4">{{
          t("welcome.footer.wordmark")
        }}</span>
      </div>

      <RouterLink to="/login" custom v-slot="{ navigate }">
        <button
          type="button"
          class="group rounded-surface bg-text-heading hover:bg-text-body focus-visible:outline-focus-ring-accent col-span-12 flex h-48 items-start justify-between p-6 text-start transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 md:h-64 md:p-8"
          data-landing-cta="footer-tile"
          data-test="landing-footer-invite"
          @click="navigate"
        >
          <span class="text-surface-base text-2xl font-medium md:text-3xl">{{
            t("welcome.footer.invite")
          }}</span>
          <svg
            viewBox="0 0 40 40"
            class="text-surface-base mt-8 h-8 w-8 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:translate-x-0 motion-reduce:transition-none md:mt-12 md:h-10 md:w-10"
            fill="none"
            stroke="currentColor"
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M8 20h22" />
            <path d="m22 10 10 10-10 10" />
          </svg>
        </button>
      </RouterLink>
    </div>
  </footer>
</template>

<style scoped>
/* keep(brand): the footer wordmark carries the page’s display scale (a fluid vw clamp).
   Marketing type steps exist only here, not as app utilities. */

.wordmark-big-text {
  font-size: clamp(2.5rem, 9vw, 7.5rem);
  line-height: 1;
  letter-spacing: var(--tracking-tight);
  font-weight: var(--font-medium);
  white-space: nowrap;
}
</style>

<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Footer as the closing board of tiles (direction: "a footer of tiles").
// The dealt email/city/time tiles were dropped - no honest content for them -
// and replaced by the attribution, source link and legal facts that must be
// on page.
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
        class="rounded-surface bg-surface-panel flex flex-col justify-between gap-12 p-6 md:col-span-4 md:p-8"
      >
        <p class="text-text-heading text-xl leading-snug font-medium">
          {{ t("welcome.footer.statement") }}
        </p>
        <p class="text-compact text-text-body leading-relaxed" data-test="landing-legal">
          {{ t("welcome.footer.legal") }}
        </p>
      </div>

      <nav
        :aria-label="t('welcome.footer.navAria')"
        class="rounded-surface bg-surface-panel p-6 md:col-span-3 md:p-8"
      >
        <ul class="flex flex-col gap-3 text-base">
          <li v-for="l in LINKS" :key="l.href">
            <a
              :href="l.href"
              class="rounded-default text-text-body hover:text-text-heading focus-visible:ring-text-heading transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              data-test="landing-footer-link"
              @click.prevent="go(l.href)"
              >{{ t(l.key) }}</a
            >
          </li>
          <li>
            <a
              href="https://github.com/openobserve/openobserve"
              class="rounded-default text-text-body hover:text-text-heading focus-visible:ring-text-heading underline underline-offset-4 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              rel="noopener"
              target="_blank"
              data-test="landing-footer-source"
              >{{ t("welcome.footer.source") }}</a
            >
          </li>
          <li>
            <a
              :href="`${base}login`"
              class="rounded-default text-text-body hover:text-text-heading focus-visible:ring-text-heading underline underline-offset-4 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              data-test="landing-footer-signin"
              >{{ t("welcome.nav.signin") }}</a
            >
          </li>
        </ul>
      </nav>

      <div
        class="rounded-surface bg-surface-panel flex flex-col justify-between gap-12 p-6 md:col-span-5 md:p-8"
      >
        <p class="text-text-heading text-xl font-medium" data-test="landing-author">
          {{ t("welcome.footer.author") }}
        </p>
        <p class="text-compact text-text-body mt-4 max-w-sm leading-relaxed">
          {{ t("welcome.footer.authorNote") }}
        </p>
      </div>

      <div
        class="rounded-surface bg-text-heading col-span-12 flex h-20 items-center gap-4 px-6 py-6 md:h-32 md:px-8"
        data-test="landing-wordmark-strip"
      >
        <svg
          viewBox="14 72 96 96"
          class="h-8 w-9 shrink-0 md:h-9 md:w-10"
          role="img"
          :aria-label="t('welcome.footer.wordmark')"
        >
          <rect x="14" y="72" width="96" height="96" rx="18" class="fill-surface-base" />
          <path
            d="M36 120h14l10-26 12 52 10-26h16"
            fill="none"
            class="stroke-text-heading"
            stroke-width="10"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="wordmark-big-text text-surface-base min-w-0 truncate">{{
          t("welcome.footer.wordmark")
        }}</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
/* keep(brand): the footer wordmark carries the page's display scale (a fluid
   vw clamp). Marketing type steps exist only here, not as app utilities. */
.wordmark-big-text {
  font-size: clamp(2rem, 6vw, 4.5rem);
  line-height: 1;
  letter-spacing: var(--tracking-tight);
  font-weight: var(--font-medium);
  white-space: nowrap;
}
</style>

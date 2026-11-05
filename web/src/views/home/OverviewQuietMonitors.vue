<!-- Copyright 2026 OpenObserve Inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
-->

<!--
  OverviewQuietMonitors — the anomaly monitors that answered "nothing outside the
  band" in the selected range, so one active anomaly does not read as the whole of
  what the org watches. Their configs are already fetched to name the active ones,
  and a monitor with a card above is not repeated here.
-->
<template>
  <section class="min-w-0" data-test="overview-anomaly-monitors-section">
    <div class="mb-2 flex items-center ps-1">
      <h3 class="text-compact text-text-body font-medium tracking-[0.01em]">
        {{ t("overview.quietMonitors") }}
        <OTag
          type="countChip"
          value="neutral"
          :aria-label="t('overview.quietMonitorsAria', { count: rows.length })"
          >{{ rows.length }}</OTag
        >
      </h3>
    </div>
    <div
      class="border-border-subtle bg-surface-panel rounded-default flex flex-col overflow-hidden border border-[0.0625em]"
    >
      <div
        v-for="row in rows"
        :key="row.id"
        class="border-b-border-subtle flex min-w-0 items-center gap-2 border-b border-b-[0.0625em] px-2.5 py-2 last:border-b-0"
      >
        <OTag type="alertLevel" value="ok" class="shrink-0" />
        <div class="flex min-w-0 flex-1 flex-col">
          <OTruncatedText class="text-text-body text-compact">{{ row.name }}</OTruncatedText>
          <!-- Two short fragments that wrap as units: an identifier cut mid-word, or
               a sentence cut before its point count, both say less than nothing. -->
          <span class="text-text-secondary flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span class="text-text-body text-compact font-mono">{{
              t("overview.quietMonitorStream", { stream: row.streamName ?? "—" })
            }}</span>
            <span class="text-compact">{{
              t("overview.quietMonitorPoints", { count: row.points })
            }}</span>
          </span>
        </div>
      </div>
    </div>
    <!-- The roster the rows are drawn from, so a short null list is not read as the whole org. -->
    <p v-if="watched !== null" class="text-text-secondary mt-2 ps-1 text-xs">
      {{ t("overview.quietMonitorsRoster", { quiet: rows.length, watched }) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import OTag from "@/lib/core/Badge/OTag.vue";
import OTruncatedText from "@/lib/core/Typography/OTruncatedText.vue";
import { useI18nTyped } from "@/types/i18n";

defineProps<{
  rows: Array<{ id: string; name: string; streamName: string | null; points: number }>;
  /** Configs the anomaly list returned, or null while that request is unanswered. */
  watched?: number | null;
}>();

const { t } = useI18nTyped();
</script>

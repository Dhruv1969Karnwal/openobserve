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
  <section class="mb-5" data-test="overview-anomaly-monitors-section">
    <div class="mb-2 flex items-center ps-1">
      <OText variant="card-title" class="tracking-[0.01em]">
        {{ t("overview.quietMonitors") }}
        <OTag type="countChip" value="neutral">{{ rows.length }}</OTag>
      </OText>
    </div>
    <div
      class="border-border-default rounded-default bg-surface-base flex flex-col overflow-hidden border border-[0.0625em]"
    >
      <div
        v-for="row in rows"
        :key="row.id"
        class="border-b-border-default flex items-center gap-3 border-b border-b-[0.0625em] px-3.5 py-2 last:border-b-0"
      >
        <OTruncatedText class="text-text-heading max-w-[14em] min-w-[7.5em] shrink-0 font-medium">{{
          row.name
        }}</OTruncatedText>
        <OTruncatedText class="text-text-secondary flex-1">{{
          t("overview.anomalyDetectedDescription", {
            stream: row.streamName ?? "—",
            count: row.points,
          })
        }}</OTruncatedText>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import OTag from "@/lib/core/Badge/OTag.vue";
import OTruncatedText from "@/lib/core/Typography/OTruncatedText.vue";
import OText from "@/lib/core/Typography/OText.vue";
import { useI18nTyped } from "@/types/i18n";

defineProps<{
  rows: Array<{ id: string; name: string; streamName: string | null; points: number }>;
}>();

const { t } = useI18nTyped();
</script>

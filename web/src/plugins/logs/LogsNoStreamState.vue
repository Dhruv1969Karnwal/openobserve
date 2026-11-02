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
  LogsNoStreamState — the ONE screen-level state for "streams exist, none chosen".
  Lists the streams the page already fetched so the primary job (see events) is a
  single click from the canvas, which is also the only path on the phone where the
  stream rail lives in a drawer.
-->
<template>
  <OEmptyState size="hero" :hide-action="true">
    <template #title>{{ t("logs.noStream.title") }}</template>

    <template #actions>
      <div class="w-full max-w-2xl min-w-0" data-test="logs-no-stream-quick-list">
        <div class="text-text-secondary flex items-end justify-between gap-2 px-2 pb-1 text-xs">
          <span>{{ t("logStream.name") }}</span>
          <span class="flex shrink-0 items-center gap-3">
            <span class="w-20 text-right max-sm:hidden">{{ t("logStream.docNum") }}</span>
            <span class="w-24 text-right">{{ t("logStream.lastIngested") }}</span>
          </span>
        </div>
        <OButton
          v-for="stream in streams"
          :key="stream.name"
          :data-test="`logs-no-stream-pick-${stream.name}`"
          variant="ghost"
          size="sm"
          class="border-border-subtle w-full justify-between border-b py-2 last:border-b-0"
          @click="emit('pick-stream', stream.name)"
        >
          <OTruncatedText
            class="text-text-heading min-w-0 flex-1 text-left font-mono"
            :tooltip="stream.name"
          >
            {{ stream.name }}
          </OTruncatedText>
          <span class="flex shrink-0 items-center gap-3">
            <span class="text-text-secondary w-20 text-right text-xs tabular-nums max-sm:hidden">
              {{ stream.events == null ? "—" : addCommasToNumber(stream.events) }}
            </span>
            <span class="text-text-secondary w-24 text-right text-xs">
              <OTimeCell
                :value="stream.lastUs"
                unit="us"
                mode="relative"
                :timezone="timezone"
                :empty-label="t('logStream.neverIngested')"
              />
            </span>
          </span>
        </OButton>
      </div>
    </template>

    <template #extra>
      <div class="flex flex-wrap items-center justify-center gap-1">
        <OButton
          variant="ghost"
          size="sm"
          data-test="logs-no-stream-select-stream-card"
          @click="emit('select-stream')"
        >
          {{ t("logs.noStream.selectStream") }}
        </OButton>
        <span class="text-text-secondary text-xs" aria-hidden="true">·</span>
        <OButton
          variant="ghost"
          size="sm"
          data-test="logs-no-stream-query-guide-link"
          @click="openQueryGuide"
        >
          {{ t("logs.noStream.queryGuide") }}
        </OButton>
      </div>
    </template>
  </OEmptyState>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "vuex";
import { useI18nTyped } from "@/types/i18n";
import OEmptyState from "@/lib/core/EmptyState/OEmptyState.vue";
import OButton from "@/lib/core/Button/OButton.vue";
import OTimeCell from "@/lib/core/Table/cells/OTimeCell.vue";
import OTruncatedText from "@/lib/core/Typography/OTruncatedText.vue";
import { addCommasToNumber } from "@/utils/formatters";
import type { LogsStreamPick } from "@/plugins/logs/logsStreamPicks";

withDefaults(
  defineProps<{
    /** Streams the page already has, most recently ingested first. */
    streams?: LogsStreamPick[];
  }>(),
  { streams: () => [] },
);

const emit = defineEmits<{
  "select-stream": [];
  "pick-stream": [stream: string];
}>();

const { t } = useI18nTyped();
const store = useStore();

const timezone = computed(() => store.state.timezone);

const openQueryGuide = () => {
  window.open("https://openobserve.ai/docs/example-queries/", "_blank", "noopener,noreferrer");
};
</script>

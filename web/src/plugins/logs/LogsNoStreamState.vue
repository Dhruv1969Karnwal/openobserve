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

<!-- LogsNoStreamState — the ONE screen-level state for "streams exist, none chosen".
     The streams the page already fetched are the answer to the question, so they are
     the composition and the instruction is their caption. -->
<template>
  <section class="flex h-full min-h-0 flex-col" data-test="logs-no-stream-state">
    <header
      class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-2.5 pt-1 pb-2"
      data-test="logs-no-stream-heading"
    >
      <h2 class="text-text-heading text-sm font-semibold">{{ t("logs.noStream.title") }}</h2>
      <span class="text-text-secondary text-xs tabular-nums">
        {{ t("logs.noStream.streamCount", { count: streams.length }) }}
      </span>
    </header>

    <div
      class="border-t-border-subtle bg-surface-base min-h-0 flex-1 overflow-y-auto border-t border-t-[0.0625em]"
      data-test="logs-no-stream-quick-list"
    >
      <div
        v-if="!isMobile"
        class="border-b-border-subtle bg-surface-panel text-text-body sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-b-[0.0625em] px-2.5 py-1.5 text-xs font-medium"
      >
        <span class="min-w-0 flex-1">{{ t("logStream.name") }}</span>
        <span class="flex shrink-0 items-center gap-3">
          <span class="w-24 text-right">{{ t("logStream.docNum") }}</span>
          <span class="w-28 text-right">{{ t("logStream.lastIngested") }}</span>
        </span>
      </div>

      <p
        v-if="streams.length === 0"
        class="text-text-secondary text-compact px-2.5 py-3"
        data-test="logs-no-stream-none-listed"
      >
        {{ t("logs.noStream.noneListed") }}
      </p>

      <OButton
        v-for="stream in streams"
        :key="stream.name"
        :data-test="`logs-no-stream-pick-${stream.name}`"
        variant="ghost"
        :size="isMobile ? 'md' : 'sm'"
        :class="[
          'border-b-border-subtle hover:bg-table-row-hover-bg w-full rounded-none border-b border-b-[0.0625em] px-2.5 py-2 text-left last:border-b-0',
          isMobile ? 'h-auto! min-h-11 flex-col items-start gap-0.5' : 'justify-between',
        ]"
        @click="emit('pick-stream', stream.name)"
      >
        <template v-if="isMobile">
          <OTruncatedText
            class="text-text-heading max-w-full min-w-0 font-mono text-sm"
            :tooltip="raw(stream.name)"
          >
            {{ stream.name }}
          </OTruncatedText>
          <span class="text-text-secondary flex items-center gap-1.5 text-xs">
            <span>{{ t("logStream.docNum") }}</span>
            <span class="text-text-body tabular-nums">{{
              stream.events == null ? "—" : addCommasToNumber(stream.events)
            }}</span>
            <span aria-hidden="true">·</span>
            <OTimeCell
              :value="stream.lastUs"
              unit="us"
              mode="relative"
              :timezone="timezone"
              :empty-label="t('logStream.neverIngested')"
            />
          </span>
        </template>
        <template v-else>
          <OTruncatedText
            class="text-text-heading text-compact min-w-0 flex-1 text-left font-mono"
            :tooltip="raw(stream.name)"
          >
            {{ stream.name }}
          </OTruncatedText>
          <span class="flex shrink-0 items-center gap-3">
            <span class="text-text-body text-compact w-24 text-right tabular-nums">
              {{ stream.events == null ? "—" : addCommasToNumber(stream.events) }}
            </span>
            <span class="text-text-secondary text-compact w-28 text-right">
              <OTimeCell
                :value="stream.lastUs"
                unit="us"
                mode="relative"
                :timezone="timezone"
                :empty-label="t('logStream.neverIngested')"
              />
            </span>
          </span>
        </template>
      </OButton>
    </div>

    <footer
      class="border-t-border-subtle flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-t-[0.0625em] px-2.5 py-2"
    >
      <OButton
        variant="outline"
        size="sm"
        icon-left="expand-more"
        data-test="logs-no-stream-select-stream-card"
        class="shrink-0"
        @click="emit('select-stream')"
      >
        {{ t("logs.noStream.selectStream") }}
      </OButton>
      <!-- A real anchor with a standing underline: colour is never the only thing saying "link". -->
      <a
        href="https://openobserve.ai/docs/example-queries/"
        target="_blank"
        rel="noopener noreferrer"
        data-test="logs-no-stream-query-guide-link"
        class="text-text-body hover:text-text-heading text-compact inline-flex shrink-0 items-center gap-1.5 underline decoration-[0.0625em] underline-offset-2"
      >
        <OIcon name="open-in-new" size="xs" class="shrink-0" />
        {{ t("logs.noStream.queryGuide") }}
      </a>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "vuex";
import { useI18nTyped, raw } from "@/types/i18n";
import useBreakpoint from "@/composables/useBreakpoint";
import OButton from "@/lib/core/Button/OButton.vue";
import OIcon from "@/lib/core/Icon/OIcon.vue";
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
const { isMobile } = useBreakpoint();

const timezone = computed(() => store.state.timezone);
</script>

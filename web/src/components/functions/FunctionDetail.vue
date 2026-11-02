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

<template>
  <aside
    ref="panelEl"
    tabindex="-1"
    data-test="function-detail-panel"
    :aria-label="t('function.header')"
    :aria-busy="loading ? 'true' : undefined"
    class="border-border-subtle bg-surface-panel rounded-surface text-text-body max-md:bg-surface-base flex min-h-0 w-full flex-col overflow-hidden border outline-none max-md:absolute max-md:inset-0 max-md:z-20 max-md:rounded-none max-md:border-0"
  >
    <header class="border-border-subtle flex shrink-0 items-start gap-2 border-b px-3 py-2.5">
      <OButton
        v-if="pushed"
        variant="ghost"
        size="icon-sm"
        icon-left="arrow-back"
        :aria-label="t('common.back')"
        data-test="function-detail-back"
        class="mt-px shrink-0"
        @click="emit('back')"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <template v-if="view">
          <h2
            :title="view.name"
            data-test="function-detail-name"
            class="text-text-heading truncate font-mono text-base leading-tight font-medium"
          >
            {{ view.name }}
          </h2>
          <OText variant="meta">{{ languageLabel }}</OText>
        </template>
        <template v-else-if="loading">
          <OSkeleton class="h-5 w-40" />
          <OSkeleton class="h-3 w-20" />
        </template>
      </div>
      <div v-if="view" class="flex shrink-0 items-center gap-1">
        <OButton
          variant="outline"
          size="xs"
          icon-left="edit"
          data-test="function-detail-edit-btn"
          @click="emit('edit')"
        >
          {{ t("common.edit") }}
        </OButton>
        <ODropdown side="bottom" align="end">
          <template #trigger>
            <OButton
              :aria-label="t('common.moreActions')"
              variant="ghost"
              size="icon-xs-sq"
              data-test="function-detail-more-actions"
              @click.stop
            >
              <OIcon name="more-vert" size="sm" />
              <OTooltip :content="t('common.moreActions')" side="left" />
            </OButton>
          </template>
          <ODropdownItem
            icon-left="account-tree"
            data-test="function-detail-associated-pipelines"
            @select="emit('pipelines')"
          >
            <span>{{ t("function.associatedPipelines") }}</span>
          </ODropdownItem>
          <ODropdownItem
            icon-left="download"
            data-test="function-detail-export-btn"
            @select="emit('export')"
          >
            <span>{{ t("common.export") }}</span>
          </ODropdownItem>
          <ODropdownItem
            icon-left="delete"
            variant="destructive"
            data-test="function-detail-delete-btn"
            @select="emit('delete')"
          >
            <span>{{ t("function.delete") }}</span>
          </ODropdownItem>
        </ODropdown>
      </div>
    </header>

    <div v-if="!view && loading" class="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <OSkeleton class="h-3 w-28" />
      <OSkeleton class="h-24 w-full" />
      <OSkeleton class="h-3 w-24" />
      <OSkeleton class="h-4 w-full" />
      <OSkeleton class="h-4 w-3/4" />
    </div>

    <div v-else-if="!view" class="min-h-0 flex-1 overflow-y-auto">
      <OEmptyState
        size="inline"
        icon="function"
        preset="no-functions"
        :filtered="filtered"
        hide-action
        data-test="function-detail-empty"
      />
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
      <section class="flex min-w-0 flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <OText variant="card-title">{{ t("function.function_definition") }}</OText>
          <span
            v-if="view.functionCount !== null"
            class="text-text-secondary text-xs tabular-nums"
            data-test="function-detail-count"
            >{{ view.functionCount }}</span
          >
        </div>
        <OCodeBlock
          v-if="view.body"
          :code="view.body"
          :lang="view.codeLang"
          wrap
          :max-lines="14"
          padded
          :data-test="`function-detail-body-${view.name}`"
        />
        <OText v-else variant="meta">{{ raw("—") }}</OText>
      </section>

      <section class="border-border-subtle flex min-w-0 flex-col gap-1.5 border-t pt-3">
        <OText variant="card-title">{{ t("function.import.paramsLabel") }}</OText>
        <ODescriptionList v-if="view.params.length" dense>
          <ODescriptionItem
            v-for="param in view.params"
            :key="param.name"
            :data-test="`function-detail-param-${param.name}`"
          >
            <template #label>
              <span class="min-w-0 truncate font-mono">{{ param.name }}</span>
            </template>
            <OCode v-if="param.value">{{ param.value }}</OCode>
            <span v-else class="text-text-secondary">{{ raw("—") }}</span>
          </ODescriptionItem>
        </ODescriptionList>
        <OText v-else variant="meta">{{ t("common.noParameters") }}</OText>
      </section>

      <section class="border-border-subtle flex min-w-0 flex-col gap-1.5 border-t pt-3">
        <OText variant="card-title">{{ t("logStream.header") }}</OText>
        <div v-if="view.streams.length" class="flex flex-wrap gap-1">
          <OTag
            v-for="stream in view.streams"
            :key="stream"
            :label="raw(stream)"
            variant="default-soft"
            size="xs"
            class="font-mono"
            :data-test="`function-detail-stream-${stream}`"
          />
        </div>
        <OText v-else variant="meta">{{ raw("—") }}</OText>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { raw, useI18nTyped } from "@/types/i18n";
import OButton from "@/lib/core/Button/OButton.vue";
import OCode from "@/lib/core/Code/OCode.vue";
import OCodeBlock from "@/lib/core/Code/OCodeBlock.vue";
import ODropdown from "@/lib/overlay/Dropdown/ODropdown.vue";
import ODropdownItem from "@/lib/overlay/Dropdown/ODropdownItem.vue";
import OIcon from "@/lib/core/Icon/OIcon.vue";
import OTooltip from "@/lib/overlay/Tooltip/OTooltip.vue";
import OTag from "@/lib/core/Badge/OTag.vue";
import OText from "@/lib/core/Typography/OText.vue";
import OEmptyState from "@/lib/core/EmptyState/OEmptyState.vue";
import ODescriptionList from "@/lib/lists/DescriptionList/ODescriptionList.vue";
import ODescriptionItem from "@/lib/lists/DescriptionList/ODescriptionItem.vue";
import OSkeleton from "@/lib/feedback/Skeleton/OSkeleton.vue";
import type { FunctionRowView } from "./functionRows";

const props = withDefaults(
  defineProps<{
    view?: FunctionRowView | null;
    loading?: boolean;
    /** The list is filtered and matched nothing, as opposed to holding no functions. */
    filtered?: boolean;
    /** The pane covers the list on a phone, so it owes the user a way back. */
    pushed?: boolean;
  }>(),
  { view: null, loading: false, filtered: false, pushed: false },
);

const emit = defineEmits<{
  (e: "back"): void;
  (e: "edit"): void;
  (e: "pipelines"): void;
  (e: "export"): void;
  (e: "delete"): void;
}>();

const { t } = useI18nTyped();
const panelEl = ref<HTMLElement | null>(null);

const languageLabel = computed(() => (props.view?.isJs ? raw("JavaScript") : t("function.vrl")));

onMounted(() => {
  if (props.pushed) panelEl.value?.focus({ preventScroll: true });
});
</script>

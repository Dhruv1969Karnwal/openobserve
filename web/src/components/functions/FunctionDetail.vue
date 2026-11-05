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
        class="mt-px shrink-0 max-md:min-h-11 max-md:min-w-11"
        @click="emit('back')"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <template v-if="view">
          <h2
            :title="view.name"
            data-test="function-detail-name"
            class="text-text-heading truncate text-base leading-tight font-medium"
          >
            {{ view.name }}
          </h2>
          <div class="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-xs">
            <OText variant="meta">{{ languageLabel }}</OText>
            <span v-if="view.updatedUs" class="text-text-label" aria-hidden="true">·</span>
            <OTimeCell
              v-if="view.updatedUs"
              :value="view.updatedUs"
              unit="us"
              :timezone="store.state.timezone"
              :empty-label="raw('—')"
              class="min-w-0"
              data-test="function-detail-updated"
            />
          </div>
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
      <section class="flex min-w-0 flex-col gap-1.5" data-test="function-detail-section-source">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <OText variant="card-title">{{ t("function.definitionTitle") }}</OText>
          <span
            class="text-text-secondary text-xs tabular-nums"
            data-test="function-detail-source-facts"
            >{{ sourceFacts }}</span
          >
        </div>
        <!-- The source is the function. A gutter numbers it and the block ends with its
             last line, so a one-line body reads as complete rather than as a stub. -->
        <OCodeBlock
          v-if="view.body"
          :code="view.body"
          :lang="view.codeLang"
          line-numbers
          padded
          :data-test="`function-detail-body-${view.name}`"
        />
        <OText v-else variant="meta" data-test="function-detail-body-empty">{{
          t("function.sourceEmpty")
        }}</OText>
      </section>

      <section
        class="border-border-subtle flex min-w-0 flex-col gap-1 border-t pt-3"
        data-test="function-detail-section-params"
      >
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <OText variant="card-title">{{ t("function.argumentsTitle") }}</OText>
          <span
            v-if="view.params.length"
            class="text-text-secondary text-xs tabular-nums"
            data-test="function-detail-params-count"
            >{{
              t("function.argumentsCount", { count: view.params.length }, view.params.length)
            }}</span
          >
        </div>
        <table v-if="view.params.length" class="w-full border-collapse text-xs">
          <thead>
            <tr class="text-text-label text-left">
              <th scope="col" class="py-1 pe-2 text-start font-normal">
                {{ t("function.order") }}
              </th>
              <th scope="col" class="py-1 pe-2 text-start font-normal">
                {{ t("function.argumentColumn") }}
              </th>
              <th scope="col" class="py-1 text-start font-normal">
                {{ t("function.valueColumn") }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(param, index) in view.params"
              :key="param.name"
              class="border-border-subtle border-t align-top"
              :data-test="`function-detail-param-${param.name}`"
            >
              <td class="text-text-secondary py-1.5 pe-2 tabular-nums">{{ index + 1 }}</td>
              <td class="py-1.5 pe-2">
                <span class="text-text-heading font-mono">{{ param.name }}</span>
                <span
                  v-if="param.type"
                  class="text-text-secondary block"
                  data-test="function-detail-param-type"
                  >{{ param.type }}</span
                >
                <!-- Required is a word whenever the payload has a state to report; a bare
                     `*` was read as a required marker, and the payload carries no such flag. -->
                <span
                  v-if="param.required !== undefined"
                  class="text-text-body block"
                  data-test="function-detail-param-required"
                  >{{
                    param.required ? t("function.requiredWord") : t("function.optionalWord")
                  }}</span
                >
              </td>
              <td class="py-1.5">
                <OCode v-if="param.value">{{ param.value }}</OCode>
                <span
                  v-else
                  class="text-text-secondary"
                  data-test="function-detail-param-no-value"
                  >{{ t("function.noValueWord") }}</span
                >
              </td>
            </tr>
          </tbody>
        </table>
        <OText v-else variant="meta">{{ t("common.noParameters") }}</OText>
      </section>

      <section
        class="border-border-subtle flex min-w-0 flex-col gap-1 border-t pt-3"
        data-test="function-detail-section-runs"
      >
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <OText variant="card-title">{{ t("function.whereItRuns") }}</OText>
          <span
            v-if="destinations.length"
            class="text-text-secondary text-xs tabular-nums"
            data-test="function-detail-runs-count"
            >{{ runsFacts }}</span
          >
        </div>
        <ul v-if="destinations.length" class="m-0 flex list-none flex-col p-0">
          <li
            v-for="destination in destinations"
            :key="destination.key"
            class="border-border-subtle flex items-baseline gap-2 border-t py-1.5 first:border-t-0"
            :data-test="destination.testId"
          >
            <span class="text-text-secondary w-14 shrink-0 text-xs">{{ destination.kind }}</span>
            <span class="text-text-heading min-w-0 truncate font-mono">{{ destination.name }}</span>
            <span
              v-if="destination.state"
              class="text-text-body ms-auto shrink-0 text-xs"
              data-test="function-detail-run-state"
              >{{ destination.state }}</span
            >
          </li>
        </ul>
        <OText v-else variant="meta" data-test="function-detail-runs-empty">{{
          t("function.runsNowhere")
        }}</OText>
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
import OText from "@/lib/core/Typography/OText.vue";
import OEmptyState from "@/lib/core/EmptyState/OEmptyState.vue";
import OSkeleton from "@/lib/feedback/Skeleton/OSkeleton.vue";
import OTimeCell from "@/lib/core/Table/cells/OTimeCell.vue";
import { useStore } from "vuex";
import type { FunctionRowView } from "./functionRows";

const props = withDefaults(
  defineProps<{
    view?: FunctionRowView | null;
    loading?: boolean;
    /** The list is filtered and matched nothing, as opposed to holding no functions. */
    filtered?: boolean;
    /** The pane covers the list on a phone, so it owes the user a way back. */
    pushed?: boolean;
    /** Pipelines that call this function — the blast radius of editing it. */
    usedByPipelines?: Array<{ pipeline_id: string; name: string; enabled: boolean }>;
  }>(),
  { view: null, loading: false, filtered: false, pushed: false, usedByPipelines: () => [] },
);

const emit = defineEmits<{
  (e: "back"): void;
  (e: "edit"): void;
  (e: "pipelines"): void;
  (e: "export"): void;
  (e: "delete"): void;
}>();

const { t } = useI18nTyped();
const store = useStore();
const panelEl = ref<HTMLElement | null>(null);

const languageLabel = computed(() => (props.view?.isJs ? raw("JavaScript") : t("function.vrl")));

// Facts about the source itself, so a one-character body is legibly the whole function.
const sourceFacts = computed(() => {
  const view = props.view;
  if (!view) return "";
  const lines = t("function.sourceLines", { count: view.sourceLines }, view.sourceLines);
  if (view.functionCount === null) return lines;
  return `${lines} · ${t(
    "function.definitionCount",
    { count: view.functionCount },
    view.functionCount,
  )}`;
});

// Pipelines and streams are one question — where does this run — so they are one list.
const destinations = computed(() => {
  const pipelines = (props.usedByPipelines ?? []).map((pipe) => ({
    key: `pipeline-${pipe.pipeline_id}`,
    kind: t("function.pipelineKind"),
    name: pipe.name,
    state: pipe.enabled ? t("function.runningWord") : t("function.pausedWord"),
    testId: `function-detail-pipeline-${pipe.pipeline_id}`,
  }));
  const streams = (props.view?.streams ?? []).map((stream) => ({
    key: `stream-${stream}`,
    kind: t("function.streamKind"),
    name: stream,
    state: "",
    testId: `function-detail-stream-${stream}`,
  }));
  return [...pipelines, ...streams];
});

// A back-link that never arrived is unknown, not zero, so only a non-empty kind is stated.
const runsFacts = computed(() => {
  const parts: string[] = [];
  const pipelines = props.usedByPipelines?.length ?? 0;
  if (pipelines) parts.push(t("function.pipelinesCount", { count: pipelines }, pipelines));
  const streams = props.view?.streams.length ?? 0;
  if (streams) parts.push(t("function.streamsCount", { count: streams }, streams));
  return parts.join(" · ");
});

onMounted(() => {
  if (props.pushed) panelEl.value?.focus({ preventScroll: true });
});
</script>

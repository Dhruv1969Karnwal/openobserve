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

<!-- eslint-disable vue/v-on-event-hyphenation -->
<!-- eslint-disable vue/attribute-hyphenation -->
<template>
  <div data-test="function-list-page" class="flex h-full min-h-0 flex-col">
    <OPageLayout
      v-if="!showAddJSTransformDialog"
      :title="t('function.header')"
      icon="function"
      :subtitle="t('function.subtitle')"
      tabs-below
      bleed
    >
      <template #header-tabs>
        <PipelineSectionTabs />
      </template>
      <template #actions>
        <OButton
          variant="outline"
          size="sm"
          icon-left="upload-file"
          data-test="function-list-import-function-btn"
          @click="goToImportFunction"
        >
          {{ t("dashboard.import") }}
        </OButton>
        <OButton
          variant="primary"
          size="sm"
          data-test="function-list-add-function-btn"
          @click="showAddUpdateFn({})"
        >
          {{ t(`function.add`) }}
        </OButton>
      </template>
      <div class="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div
          class="relative flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto xl:flex-row xl:gap-6 xl:overflow-hidden"
        >
          <div
            class="flex min-w-0 shrink-0 flex-col xl:min-h-0 xl:flex-1 xl:shrink"
            data-test="function-list-cell"
          >
            <OTable
              ref="oTableRef"
              :frame="false"
              :data="visibleRows"
              :columns="columns"
              row-key="name"
              :loading="loading"
              :forbidden="forbidden"
              :error="loadError"
              pagination="client"
              :current-page="currentPage"
              @update:current-page="onPageChange"
              :page-size="pageSize"
              :page-size-options="pageSizeOptions"
              @update:page-size="pageSize = $event"
              :sort-by="sortBy"
              :sort-order="sortOrder"
              @update:sort-by="sortBy = $event"
              @update:sort-order="sortOrder = $event"
              selection="multiple"
              v-model:selected-ids="selectedFunctionIds"
              fill-height="auto"
              :row-class="focusedRowClass"
              @row-click="onRowClick"
              :show-global-filter="false"
              :default-columns="false"
              width="100%"
              class="w-full"
            >
              <template #toolbar>
                <div class="flex w-full min-w-0 items-center gap-2 max-md:contents">
                  <OSearchInput
                    data-test="functions-list-search-input"
                    v-model="filterQuery"
                    class="max-w-96 min-w-0 flex-1"
                    :placeholder="t('function.search')"
                  />
                </div>
              </template>
              <template #toolbar-trailing>
                <ORefreshButton
                  layout="inline"
                  variant="outline"
                  :last-run-at="lastUpdatedAt"
                  :loading="fetching"
                  shortcut-id="functionsRefresh"
                  data-test="functions-list-refresh-btn"
                  @click="refreshJSTransforms"
                />
              </template>
              <template #error>
                <div data-test="function-list-error">
                  <OEmptyState size="hero" preset="load-error" @action="refreshJSTransforms" />
                </div>
              </template>

              <template #empty>
                <OEmptyState
                  size="hero"
                  preset="no-functions"
                  :filtered="!!filterQuery"
                  @action="
                    (id) => (id === 'clear-filters' ? (filterQuery = '') : showAddUpdateFn({}))
                  "
                />
              </template>

              <template #cell-name="{ row, value }">
                <div class="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    class="text-text-heading focus-visible:ring-focus-ring-accent min-w-0 cursor-pointer truncate rounded-none text-start font-medium outline-none focus-visible:ring-2"
                    :aria-current="selectionShown && row?.name === focusedName ? 'true' : undefined"
                    :data-test="`function-list-name-cell-${row?.name ?? value}`"
                    @click="focusFunction(row)"
                  >
                    {{ value }}
                  </button>
                  <!-- The payload's default language is VRL, so only the exception is marked. -->
                  <OTag
                    v-if="row?.transType === '1'"
                    :label="raw('JavaScript')"
                    variant="amber-soft"
                    size="xs"
                    class="shrink-0"
                    data-test="function-list-type-badge-js"
                  />
                  <!-- The row pushes the detail pane; a touch screen shows no hover, so the chevron is the affordance. -->
                  <OIcon
                    v-if="isMobile"
                    name="chevron-right"
                    size="xs"
                    class="text-text-secondary ms-auto shrink-0"
                    data-test="function-list-row-open"
                    aria-hidden="true"
                  />
                </div>
                <!-- A dropped column is a defect on every band: applied-in rides line 2 of the phone row. -->
                <div
                  v-if="isMobile"
                  class="min-w-0 truncate text-xs"
                  data-test="function-list-applied-in-line"
                >
                  <span
                    v-if="row?.view?.streams.length"
                    data-test="function-list-applied-in"
                    data-o2-cell-clip
                    class="text-text-secondary"
                    >{{ row.view.streams.join(streamSeparator) }}</span
                  >
                  <span
                    v-else
                    class="text-text-secondary"
                    data-test="function-list-applied-in-none"
                    >{{ raw("—") }}</span
                  >
                </div>
              </template>

              <template #cell-appliedIn="{ row }">
                <span
                  v-if="row?.view?.streams.length"
                  data-test="function-list-applied-in"
                  data-o2-cell-clip
                  >{{ row.view.streams.join(streamSeparator) }}</span
                >
                <span
                  v-else
                  class="text-text-secondary"
                  data-test="function-list-applied-in-none"
                  >{{ raw("—") }}</span
                >
              </template>

              <template #cell-actions="{ row }">
                <!-- One labelled frequent job plus the rest grouped, so no row is four anonymous glyphs. -->
                <div class="actions-container flex items-center gap-1">
                  <OButton
                    v-if="!isMobile"
                    variant="ghost"
                    size="xs"
                    icon-left="edit"
                    :title="t('function.updateTitle')"
                    data-test="function-list-edit-function-btn"
                    data-row-action="edit"
                    @click="showAddUpdateFn({ row })"
                  >
                    {{ t("common.edit") }}
                  </OButton>
                  <ODropdown side="bottom" align="end">
                    <template #trigger>
                      <OButton
                        :aria-label="t('common.moreActions')"
                        variant="ghost"
                        size="icon-xs-sq"
                        data-test="function-list-row-more-actions"
                        data-row-action="more"
                        @click.stop
                      >
                        <OIcon name="more-vert" size="sm" />
                        <OTooltip :content="t('common.moreActions')" side="left" />
                      </OButton>
                    </template>
                    <ODropdownItem
                      v-if="isMobile"
                      icon-left="edit"
                      data-test="function-list-edit-function-btn-menu"
                      @select="showAddUpdateFn({ row })"
                    >
                      <span>{{ t("function.updateTitle") }}</span>
                    </ODropdownItem>
                    <ODropdownItem
                      icon-left="account-tree"
                      data-test="function-list-associated-pipelines-menu"
                      data-row-action="view"
                      @select="getAssociatedPipelines({ row })"
                    >
                      <span>{{ t("function.associatedPipelines") }}</span>
                    </ODropdownItem>
                    <ODropdownItem
                      icon-left="download"
                      data-test="function-list-export-function-btn"
                      data-row-action="export"
                      @select="exportFunction(row)"
                    >
                      <span>{{ t("common.export") }}</span>
                    </ODropdownItem>
                    <ODropdownItem
                      icon-left="delete"
                      variant="destructive"
                      data-test="function-list-delete-function-btn"
                      data-row-action="delete"
                      @select="showDeleteDialogFn({ row })"
                    >
                      <span>{{ t("function.delete") }}</span>
                    </ODropdownItem>
                  </ODropdown>
                </div>
              </template>

              <template #selection-actions>
                <OButton
                  data-test="function-list-export-functions-btn"
                  variant="outline"
                  size="sm"
                  :loading="exportLoading"
                  @click="exportSelectedFunctions"
                  icon-left="download"
                >
                  {{ t("common.export") }}
                </OButton>
                <OButton
                  data-test="function-list-delete-functions-btn"
                  variant="outline-destructive"
                  size="sm"
                  :loading="bulkDeleteLoading"
                  @click="openBulkDeleteDialog"
                  icon-left="delete"
                >
                  {{ t("common.delete") }}
                </OButton>
              </template>
            </OTable>
          </div>
          <FunctionDetail
            v-if="paneVisible"
            :view="focusedView"
            :loading="loading"
            :filtered="!!filterQuery"
            :pushed="isMobile"
            class="w-full shrink-0 xl:w-104 xl:self-start"
            @back="closePhoneDetail"
            @edit="showAddUpdateFn({ row: focusedRow })"
            @pipelines="getAssociatedPipelines({ row: focusedRow })"
            @export="exportFunction(focusedRow)"
            @delete="showDeleteDialogFn({ row: focusedRow })"
          />
        </div>
      </div>
    </OPageLayout>
    <div v-else class="min-h-0 flex-1">
      <AddFunction
        v-model="formData"
        :isUpdated="isUpdated"
        class="p-2"
        @update:list="refreshList"
        @cancel:hideform="hideForm"
        @sendToAiChat="sendToAiChat"
      />
    </div>
    <ConfirmDialog
      :title="t('function.deleteTransformDialogTitle')"
      :message="t('function.deleteTransformConfirmMessage')"
      @update:ok="deleteFn"
      @update:cancel="confirmDelete = false"
      v-model="confirmDelete"
    />

    <ConfirmDialog
      :title="t('function.deleteFunctionsDialogTitle')"
      :message="t('functions.confirmDeleteFunctions', { count: selectedFunctions.length })"
      @update:ok="bulkDeleteFunctions"
      @update:cancel="confirmBulkDelete = false"
      v-model="confirmBulkDelete"
    />

    <ODialog
      data-test="function-list-force-delete-dialog"
      v-model:open="confirmForceDelete"
      persistent
      size="md"
      :title="t('common.pipelinesAssociatedWith', { name: selectedDelete?.name })"
    >
      <div v-if="transformedPipelineList.length > 0" class="max-h-50 overflow-y-auto">
        <ul class="scrollable-list m-0 flex list-none flex-col p-0">
          <li
            v-for="(pipeline, index) in transformedPipelineList"
            :key="pipeline.value"
            @click="onPipelineSelect(pipeline)"
            class="hover:bg-muted/50 flex cursor-pointer items-center px-3 py-2"
            :data-test="`function-list-pipeline-item-${pipeline.value}`"
          >
            <span class="text-sm">{{ index + 1 }}. {{ pipeline.label }}</span>
          </li>
        </ul>
      </div>
      <div v-else>
        <div class="text-center text-xl font-semibold">
          {{ t("function.noPipelinesAssociated") }}
        </div>
      </div>
    </ODialog>
  </div>
</template>

<script lang="ts">
import { defineAsyncComponent, defineComponent, ref, computed, watch } from "vue";
import { useStore } from "vuex";
import { useRoute, useRouter } from "vue-router";
import { useListViewState } from "@/composables/useListViewState";
import { useI18nTyped, raw } from "@/types/i18n";

import OTable from "@/lib/core/Table/OTable.vue";
import type { OTableColumnDef } from "@/lib/core/Table/OTable.types";
import jsTransformService from "../../services/jstransform";
import OEmptyState from "@/lib/core/EmptyState/OEmptyState.vue";
import ConfirmDialog from "../ConfirmDialog.vue";
import analytics from "../../services/product_analytics";
import { getImageURL, verifyOrganizationStatus } from "../../utils/zincutils";
import { useReo } from "@/services/reodotdev_analytics";
import searchState from "@/composables/useLogs/searchState";
import OButton from "@/lib/core/Button/OButton.vue";
import OTag from "@/lib/core/Badge/OTag.vue";
import OIcon from "@/lib/core/Icon/OIcon.vue";
import OTooltip from "@/lib/overlay/Tooltip/OTooltip.vue";
import ODialog from "@/lib/overlay/Dialog/ODialog.vue";
import ODropdown from "@/lib/overlay/Dropdown/ODropdown.vue";
import ODropdownItem from "@/lib/overlay/Dropdown/ODropdownItem.vue";
import OSearchInput from "@/lib/forms/SearchInput/OSearchInput.vue";
import OPageLayout from "@/lib/core/PageLayout/OPageLayout.vue";
import PipelineSectionTabs from "@/components/pipeline/PipelineSectionTabs.vue";
import FunctionDetail from "./FunctionDetail.vue";
import { functionRowView } from "./functionRows";
import ORefreshButton from "@/lib/core/RefreshButton/ORefreshButton.vue";
import { toast } from "@/lib/feedback/Toast/useToast";
import { useShortcuts } from "@/lib/vue-shortcut-manager";
import { focusSearchInput, isInputFocused } from "@/utils/keyboardShortcuts";
import { downloadFile } from "@/utils/dom";
import { useMutation, useQuery } from "@tanstack/vue-query";
import {
  bulkDeleteFunctionsMutation,
  deleteFunctionMutation,
  functionsQuery,
} from "@/services/jstransform.queries";
import { useOrgId } from "@/composables/query/useOrgId";
import useBreakpoint from "@/composables/useBreakpoint";

/** Query key the focused function is mirrored to, so a selection is linkable. */
const FOCUSED_QUERY = "function";

export default defineComponent({
  name: "functionList",
  components: {
    OEmptyState,
    OPageLayout,
    PipelineSectionTabs,
    FunctionDetail,
    OTable,
    AddFunction: defineAsyncComponent(() => import("./AddFunction.vue")),
    ConfirmDialog,
    OButton,
    OTag,
    OIcon,
    OTooltip,
    ODialog,
    ODropdown,
    ODropdownItem,
    OSearchInput,
    ORefreshButton,
  },
  emits: [
    "updated:fields",
    "update:changeRecordPerPage",
    "update:maxRecordToReturn",
    "sendToAiChat",
  ],
  setup(props, { emit }) {
    const store = useStore();
    const { t } = useI18nTyped();
    const router = useRouter();
    const route = useRoute();
    const { isMobile } = useBreakpoint();
    const formData: any = ref({});
    const showAddJSTransformDialog: any = ref(false);
    const selectedDelete: any = ref(null);
    const isUpdated: any = ref(false);
    const confirmDelete = ref<boolean>(false);
    const confirmForceDelete = ref<boolean>(false);
    const confirmBulkDelete = ref<boolean>(false);
    const bulkDeleteLoading = ref<boolean>(false);
    const { searchObj } = searchState();
    const pipelineList = ref([]);
    const selectedPipeline = ref("");
    const viewState = useListViewState("functions", {
      filterQuery: "",
      pageSize: 20,
      currentPage: 1,
      sortBy: "",
      sortOrder: "asc" as "asc" | "desc",
    });
    const filterQuery = ref(viewState.filterQuery);
    const { track } = useReo();
    const nameColumn = (mobile: boolean): OTableColumnDef => ({
      id: "name",
      accessorKey: "name",
      header: t("common.name"),
      sortable: true,
      // A content-derived measure, never the leftover of a full-bleed frame.
      size: mobile ? 200 : 340,
      minSize: mobile ? 160 : 220,
      maxSize: mobile ? 260 : 460,
      meta: { align: "left", mono: true, isName: true },
    });

    const actionsColumn: OTableColumnDef = {
      id: "actions",
      header: t("function.actions"),
      isAction: true,
      meta: { align: "center", cellClass: "actions-column", actionCount: 3 },
    };

    const columns = computed<OTableColumnDef[]>(() =>
      // On a phone the row is a button into the pane, which carries every row
      // action; a lone kebab column is the stranded band.
      isMobile.value
        ? [nameColumn(true)]
        : [
            nameColumn(false),
            {
              id: "appliedIn",
              header: t("logStream.header"),
              accessorFn: (row: any) => row?.view?.streams ?? [],
              // Stream lists are the longest values, so the filler takes the canvas slack.
              meta: { align: "left", autoWidth: true, mono: true },
            },
            actionsColumn,
          ],
    );

    const onPipelineSelect = (pipeline: any) => {
      const routeUrl = router.resolve({
        name: "pipelineEditor",
        query: {
          id: pipeline.value,
          name: pipeline.label,
          org_identifier: store.state.selectedOrganization.identifier,
        },
      }).href;

      window.open(routeUrl, "_blank");
    };

    const orgId = useOrgId();

    // View-state seeded because the import route destroys the whole list, not just the OTable branch.
    const currentPage = ref(viewState.currentPage);
    const onPageChange = (page: number) => {
      currentPage.value = page;
    };
    const oTableRef: any = ref(null);
    // setTimeout(0) is a macrotask, so it runs after TanStack's own deferred auto-reset-on-data-change (its own microtask queue), letting the restored page win.
    const restorePageIndex = () => {
      setTimeout(() => {
        oTableRef.value?.restorePage?.(currentPage.value);
      }, 0);
    };

    // The list is the query, not a copy of it. Anything that invalidates
    // ["org", id, "functions"] — this page's writes, the two in the Logs search
    // bar, the function form — repaints these rows with no wiring here.
    // `Object.assign` rather than a spread: `queryOptions()` brands its key with
    // the result type, and spreading into a fresh literal drops the brand (data
    // degrades to `unknown`). Assigning onto the returned object keeps it.
    const functions = useQuery(() =>
      Object.assign(functionsQuery(orgId.value), { enabled: !!orgId.value }),
    );

    // TanStack's own distinction, bound straight to the two UI affordances:
    // `isPending` is the cold read (OTable swaps in its skeleton), `isFetching`
    // is any request in flight, including one with rows already on screen.
    const loading = functions.isPending;
    // A 403 lands in the query's error rather than a loader's catch, so derive the no-access state from it.
    const forbidden = computed(() => {
      const e: any = functions.error.value;
      return e?.status === 403 || e?.response?.status === 403;
    });
    const fetching = functions.isFetching;
    // Epoch ms of the last successful read — drives the button's "1m ago" label.
    const lastUpdatedAt = functions.dataUpdatedAt;
    // main restored the page inside the old chain's `.finally`; the query has no
    // such hook, so the same restore rides the cold read settling instead.
    watch(
      loading,
      (isLoading) => {
        if (isLoading) return;
        restorePageIndex();
      },
      { once: true },
    );

    const jsTransforms = computed(() =>
      (functions.data.value ?? []).map((data: any) => ({
        name: data.name,
        function: data.function,
        params: data.params,
        transType: data.transType.toString(),
        view: functionRowView(data),
        actions: "",
      })),
    );

    // Was a manual `.catch` on every read. The query owns its own error now, so
    // this fires once per failure however the read was triggered.
    watch(functions.error, (err: any) => {
      if (!err) return;
      console.error("Error while pulling function", err);
      // With no rows on screen the table's own error block names the failure; the
      // toast is for the refresh that could not confirm rows already being read.
      if (err?.response?.status && err?.response?.status != 403 && jsTransforms.value.length) {
        toast({
          variant: "error",
          message: t("toastMessages.functions.errorWhilePullingFunction"),
        });
      }
    });

    // Bridge for consumers still reading `searchObj.data.transforms`.
    watch(jsTransforms, (rows) => (searchObj.data.transforms = rows), { immediate: true });

    // The ?action= deep links open a dialog off the first non-empty result, so
    // they are latched: a cached paint followed by a fresh one must not open it
    // twice. Was folded into the row mapping, which ran on every paint.
    let deepLinkOpened = false;
    watch(
      functions.data,
      (list) => {
        if (!list || deepLinkOpened) return;
        const { action, name } = router.currentRoute.value.query;
        if (action == "add") {
          deepLinkOpened = true;
          showAddUpdateFn({ row: undefined });
        } else if (action == "update") {
          const row = list.find((data: any) => data.name == name);
          if (row) {
            deepLinkOpened = true;
            showAddUpdateFn({ row });
          }
        }
      },
      { immediate: true },
    );

    // Bound to the refresh button: always reaches the server.
    const refreshJSTransforms = () => functions.refetch();

    const pageSize = ref(viewState.pageSize);
    const sortBy = ref(viewState.sortBy);
    const sortOrder = ref<"asc" | "desc">(viewState.sortOrder);
    watch(filterQuery, () => (currentPage.value = 1));
    watch([filterQuery, pageSize, currentPage, sortBy, sortOrder], () => {
      Object.assign(viewState, {
        filterQuery: filterQuery.value,
        pageSize: pageSize.value,
        currentPage: currentPage.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
      });
    });
    const pageSizeOptions = [20, 50, 100, 250, 500];
    const streamSeparator = " · ";

    const selectedFunctionIds = ref<string[]>([]);
    const selectedFunctions = computed({
      get: () =>
        (jsTransforms.value || []).filter((row: any) =>
          selectedFunctionIds.value.includes(row.name),
        ),
      set: (val) => {
        selectedFunctionIds.value = val.map((row: any) => row.name);
      },
    });

    const addTransform = () => {
      showAddJSTransformDialog.value = true;
    };

    const transformedPipelineList = computed(() => {
      return pipelineList.value.map((pipeline: any) => ({
        label: pipeline.name,
        value: pipeline.id,
      }));
    });

    const showAddUpdateFn = (props: any) => {
      formData.value = props.row;
      let action;
      if (!props.row) {
        isUpdated.value = false;
        action = "Add Function";
        router.push({
          name: "functionList",
          query: {
            action: "add",
            org_identifier: store.state.selectedOrganization.identifier,
          },
        });
        track("Button Click", {
          button: "Add Function",
          page: "Functions",
        });
      } else {
        isUpdated.value = true;
        action = "Update Function";
        router.push({
          name: "functionList",
          query: {
            action: "update",
            name: props.row.name,
            org_identifier: store.state.selectedOrganization.identifier,
          },
        });
        track("Button Click", {
          button: "Update Function",
          page: "Functions",
        });
      }
      addTransform();

      analytics.track("Button Click", {
        button: action,
        user_org: store.state.selectedOrganization.identifier,
        user_id: store.state.userInfo.email,
        page: "Functions",
      });
    };

    const refreshList = () => {
      router.push({
        name: "functionList",
        query: {
          org_identifier: store.state.selectedOrganization.identifier,
        },
      });
      showAddJSTransformDialog.value = false;
      // No reload call: the save mutation invalidated the scope, so the mounted
      // query has already refetched.
    };

    const hideForm = () => {
      showAddJSTransformDialog.value = false;
      router.replace({
        name: "functionList",
        query: {
          org_identifier: store.state.selectedOrganization.identifier,
        },
      });
    };

    const deleteFunction = useMutation(() => deleteFunctionMutation(orgId.value));

    const deleteFn = () => {
      deleteFunction
        .mutateAsync(selectedDelete.value.name)
        .then((res: any) => {
          if (res.data.code == 200) {
            toast({
              variant: "success",
              message: res.data.message,
            });
          } else {
            toast({
              variant: "error",
              message: res.data.message,
            });
          }
        })
        .catch((err) => {
          if (err.response.data.code == 409) {
            toast({
              variant: "error",
              message: t("toastMessages.functions.functionDeletionAssociatedPipelines"),
              timeout: 10000,
              action: {
                label: t("toastMessages.functions.view"),
                handler: () => {
                  forceRemoveFunction(err.response.data["message"]);
                },
              },
            });
            return;
          }
          if (err.response.status != 403) {
            toast({
              variant: "error",
              message:
                raw(JSON.stringify(err.response.data["message"])) ||
                t("functions.functionDeletionFailed"),
            });
          }
        });

      analytics.track("Button Click", {
        button: "Delete Function",
        user_org: store.state.selectedOrganization.identifier,
        user_id: store.state.userInfo.email,
        function_name: selectedDelete.value.name,
        is_ingest_func: selectedDelete.value.ingest,
        page: "Functions",
      });
    };

    const showDeleteDialogFn = (props: any) => {
      selectedDelete.value = props.row;
      confirmDelete.value = true;
    };

    const getAssociatedPipelines = (props: any) => {
      selectedDelete.value = props.row;
      jsTransformService
        .getAssociatedPipelines(store.state.selectedOrganization.identifier, props.row.name)
        .then((res: any) => {
          pipelineList.value = res.data.list;
          confirmForceDelete.value = true;
        })
        .catch((err) => {
          console.log(err);
        });
    };

    const forceRemoveFunction = (message: any) => {
      const match = message.match(/\[([^\]]+)\]/);
      if (match) {
        // Convert the matched string to an array of pipeline names
        pipelineList.value = JSON.parse(match[0].replace(/'/g, '"'));
      }

      confirmForceDelete.value = true;
    };

    const closeDialog = () => {
      confirmForceDelete.value = false;
    };

    const forceDeleteFn = () => {};

    const sendToAiChat = (value: any) => {
      emit("sendToAiChat", value);
    };

    const filterData = (rows: any, terms: any) => {
      var filtered = [];
      terms = terms.toLowerCase();
      for (var i = 0; i < rows.length; i++) {
        if (rows[i]["name"].toLowerCase().includes(terms)) {
          filtered.push(rows[i]);
        }
      }
      return filtered;
    };

    const visibleRows = computed(() => {
      if (!filterQuery.value) return jsTransforms.value || [];
      return filterData(jsTransforms.value || [], filterQuery.value);
    });
    const hasVisibleRows = computed(() => visibleRows.value.length > 0);

    // Deep links and reloads restore the selection the URL names.
    const urlFunctionName = () => String(route.query[FOCUSED_QUERY] ?? "");
    const syncFocusedName = (name: string) => {
      const query = { ...route.query };
      if (name) query[FOCUSED_QUERY] = name;
      else delete query[FOCUSED_QUERY];
      void router.replace({ query });
    };

    // The pane shows one row at a time, so the first visible row is its subject
    // until the operator picks another.
    const focusedName = ref("");
    const focusedRow = computed(() => {
      const rows = visibleRows.value;
      if (!rows.length) return null;
      return rows.find((row: any) => row.name === focusedName.value) ?? rows[0];
    });
    watch(
      focusedRow,
      (row) => {
        focusedName.value = row?.name ?? "";
        const linked = urlFunctionName();
        // A link to a function that has gone must not keep naming it while the
        // pane shows somebody else.
        if (row && linked && linked !== row.name) syncFocusedName(row.name);
      },
      { immediate: true },
    );
    const focusedView = computed(() => focusedRow.value?.view ?? null);

    // A tap pushes the pane over the list on a phone; wider it just stacks.
    const phoneDetailOpen = ref(false);
    const closePhoneDetail = () => {
      phoneDetailOpen.value = false;
    };
    watch(isMobile, (mobile) => {
      if (!mobile) phoneDetailOpen.value = false;
    });

    const focusFunction = (row: any) => {
      if (!row?.name) return;
      if (row.name !== focusedName.value) {
        focusedName.value = row.name;
        syncFocusedName(row.name);
      }
      // The first row is focused by default, so refusing to act on it strands the
      // pane: a tap on any row must push the detail on a phone.
      if (isMobile.value) phoneDetailOpen.value = true;
    };
    const onRowClick = (row: any) => focusFunction(row);
    // A read that failed is not an empty list. Rows already on screen stay: they
    // are stale-but-true, and the toast names the refresh that could not confirm them.
    const readFailed = computed(() => !!functions.error.value && !forbidden.value);
    const loadError = computed(() =>
      readFailed.value && !jsTransforms.value.length ? t("functions.fetchFunctionsError") : null,
    );
    const paneVisible = computed(
      () => !forbidden.value && !loadError.value && (!isMobile.value || phoneDetailOpen.value),
    );
    // A row is marked only while its detail is actually on screen: a phone shows
    // the list alone until a row is chosen, and a marked row with nothing to read
    // is a promise the screen has not kept.
    const selectionShown = computed(() => !isMobile.value || phoneDetailOpen.value);
    const focusedRowClass = (row: any) =>
      selectionShown.value && row?.name === focusedName.value ? "bg-table-row-selected-bg" : "";
    watch(
      () => route.query[FOCUSED_QUERY],
      (value) => {
        const name = String(value ?? "");
        if (name && name !== focusedName.value) {
          focusedName.value = name;
          // A shared link on a phone must open the pane it names, not preselect a
          // row that is never revealed without a second tap.
          if (isMobile.value) phoneDetailOpen.value = true;
        }
      },
      { immediate: true },
    );

    const openBulkDeleteDialog = () => {
      confirmBulkDelete.value = true;
    };

    // No dialog: the provider has no function resource, so a preview would pick between one format.

    // `streams` names streams the target org lacks; `numArgs` the server derives from `params`.
    const exportPayload = (name: string) => {
      const fn: any = (functions.data.value ?? []).find((item: any) => item.name === name);
      if (!fn) return null;
      return {
        name: fn.name,
        function: fn.function,
        params: fn.params,
        transType: fn.transType,
      };
    };

    const exportLoading = ref(false);

    // The row came from this list, so a miss means the cache moved on: re-read once before giving up.
    const collectForExport = async (names: string[]) => {
      let payloads = names.map(exportPayload);
      if (payloads.some((payload) => !payload)) {
        await functions.refetch();
        payloads = names.map(exportPayload);
      }
      return {
        payloads: payloads.filter(Boolean) as Record<string, unknown>[],
        missing: names.filter((_, i) => !payloads[i]),
      };
    };

    // One function keeps its name; a bundle is dated, as the other lists name theirs.
    const exportFileName = (payloads: Record<string, unknown>[]) => {
      if (payloads.length !== 1) {
        return `functions-${new Date().toISOString().slice(0, 10)}.json`;
      }
      const name = String(payloads[0]?.name ?? "").replace(/[^A-Za-z0-9._-]+/g, "-");
      return `${name || "function"}.json`;
    };

    const runExport = async (names: string[]) => {
      if (exportLoading.value) return;
      exportLoading.value = true;
      try {
        const { payloads, missing } = await collectForExport(names);
        if (!payloads.length) throw new Error("no exportable function");
        // A selection outlives its rows, and the file would be short by names nobody mentioned.
        if (missing.length) {
          toast({
            variant: "info",
            message: t(
              "toastMessages.functions.functionsMissingFromExport",
              { names: raw(missing.join(", ")) },
              missing.length,
            ),
          });
        }
        // Object for one, array for several: both import, and the object form is hand-editable.
        const written = downloadFile(
          exportFileName(payloads),
          JSON.stringify(payloads.length === 1 ? payloads[0] : payloads, null, 2),
          "application/json",
        );
        if (!written) throw new Error("download refused");
        toast({
          variant: "success",
          message: t(
            "toastMessages.functions.successfullyExportedFunctions",
            { count: payloads.length },
            payloads.length,
          ),
        });
        selectedFunctionIds.value = [];
      } catch (error) {
        toast({
          variant: "error",
          message: t("toastMessages.functions.errorExportingFunctions"),
        });
      } finally {
        exportLoading.value = false;
      }
    };

    const exportFunction = (row: any) => runExport([row.name]);

    const exportSelectedFunctions = () => runExport([...selectedFunctionIds.value]);

    const goToImportFunction = () => {
      router.push({
        name: "importFunction",
        query: { org_identifier: store.state.selectedOrganization.identifier },
      });
    };

    const bulkDelete = useMutation(() => bulkDeleteFunctionsMutation(orgId.value));

    const bulkDeleteFunctions = async () => {
      bulkDeleteLoading.value = true;
      const dismiss = toast({
        variant: "loading",
        message: t("toastMessages.functions.deletingFunctions"),
        timeout: 0,
      });

      try {
        if (selectedFunctions.value.length === 0) {
          toast({
            variant: "error",
            message: t("toastMessages.functions.noFunctionsSelectedForDeletion"),
          });
          dismiss();
          return;
        }

        // Extract function names for the API call (BE supports names)
        const payload = {
          ids: selectedFunctions.value.map((f: any) => f.name),
        };

        const response = await bulkDelete.mutateAsync(payload.ids);

        dismiss();

        // Handle response based on successful/unsuccessful arrays
        if (response.data) {
          const { successful = [], unsuccessful = [] } = response.data;
          const successCount = successful.length;
          const failCount = unsuccessful.length;

          if (failCount > 0 && successCount > 0) {
            // Partial success
            toast({
              variant: "warning",
              message: t("toastMessages.functions.functionsDeletedWithFailures", {
                count: successCount,
                failed: failCount,
              }),
              timeout: 5000,
            });
          } else if (failCount > 0) {
            // All failed
            toast({
              variant: "error",
              message: t("toastMessages.functions.failedToDeleteFunctions", { count: failCount }),
            });
          } else {
            // All successful
            toast({
              variant: "success",
              message: t("toastMessages.functions.functionsDeletedSuccessfully", {
                count: successCount,
              }),
            });
          }
        } else {
          // Fallback success message
          toast({
            variant: "success",
            message: t("toastMessages.functions.functionsDeletedSuccessfully", {
              count: selectedFunctions.value.length,
            }),
          });
        }

        selectedFunctions.value = [];
      } catch (error: any) {
        dismiss();
        console.error("Error deleting functions:", error);

        // Show error message from response if available
        const errorMessage =
          error.response?.data?.message ||
          error?.message ||
          t("functions.bulkDeleteFunctionsFailed");
        if (error.response?.status != 403 || error?.status != 403) {
          toast({
            variant: "error",
            message: errorMessage,
          });
        }
      } finally {
        bulkDeleteLoading.value = false;
      }

      confirmBulkDelete.value = false;
    };

    // ── Keyboard shortcuts ────────────────────────────────────────────────
    useShortcuts([
      {
        id: "functionsAdd",
        handler: () => {
          if (!isInputFocused()) showAddUpdateFn({});
        },
      },
      {
        id: "functionsImport",
        handler: () => {
          if (!isInputFocused()) goToImportFunction();
        },
      },
      {
        id: "functionsRefresh",
        handler: () => {
          if (!isInputFocused()) refreshJSTransforms();
        },
      },
      {
        id: "functionsFocusSearch",
        handler: () => {
          focusSearchInput("functions-list-search-input");
        },
      },
    ]);
    return {
      t,
      raw,
      store,
      router,
      jsTransforms,
      columns,
      formData,
      hideForm,
      confirmDelete,
      selectedDelete,
      loading,
      fetching,
      lastUpdatedAt,
      refreshJSTransforms,
      forbidden,
      refreshList,
      pageSize,
      pageSizeOptions,
      sortBy,
      sortOrder,
      addTransform,
      deleteFn,
      isUpdated,
      showAddUpdateFn,
      showDeleteDialogFn,
      showAddJSTransformDialog,
      forceDeleteFn,
      confirmForceDelete,
      pipelineList,
      selectedPipeline,
      closeDialog,
      onPipelineSelect,
      transformedPipelineList,
      getAssociatedPipelines,
      filterQuery,
      filterData,
      getImageURL,
      verifyOrganizationStatus,
      sendToAiChat,
      visibleRows,
      hasVisibleRows,
      focusedName,
      focusedRow,
      focusedView,
      focusFunction,
      focusedRowClass,
      selectionShown,
      paneVisible,
      loadError,
      onRowClick,
      phoneDetailOpen,
      closePhoneDetail,
      isMobile,
      streamSeparator,
      openBulkDeleteDialog,
      exportLoading,
      exportFunction,
      exportSelectedFunctions,
      goToImportFunction,
      bulkDeleteFunctions,
      bulkDeleteLoading,
      confirmBulkDelete,
      selectedFunctions,
      selectedFunctionIds,
      currentPage,
      onPageChange,
      oTableRef,
      restorePageIndex,
    };
  },
  computed: {
    // selectedOrg() {
    //   return this.store.state.selectedOrganization.identifier;
    // },
  },
  watch: {
    // selectedOrg(newVal: any, oldVal: any) {
    //   this.verifyOrganizationStatus(
    //     this.store.state.organizations,
    //     this.router
    //   );
    //   if (
    //     (newVal != oldVal || this.jsTransforms.value == undefined) &&
    //     this.router.currentRoute.value.name == "AppFunctions"
    //   ) {
    //     this.resultTotal = 0;
    //     this.jsTransforms = [];
    //     this.getJSTransforms();
    //   }
    // },
  },
});
</script>

<style scoped>
/* keep(scrollbar): custom webkit scrollbar for the function list */
.scrollable-list::-webkit-scrollbar {
  width: 0.5rem;
}

.scrollable-list::-webkit-scrollbar-thumb {
  background-color: var(--color-border-strong);
  border-radius: 0.25rem;
}

.scrollable-list::-webkit-scrollbar-thumb:hover {
  background-color: var(--color-text-muted);
}

.scrollable-list::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>

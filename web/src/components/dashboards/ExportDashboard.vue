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
  <OButton
    :variant="variant"
    :size="size"
    :class="buttonClass"
    @click="downloadDashboard()"
    data-test="export-dashboard"
    icon-left="download"
  >
    <template v-if="showLabel">{{ t("dashboard.export") }}</template>
    <OTooltip v-else :content="t('dashboard.export')" shortcut-id="dashboardExport" />
  </OButton>
</template>
<script lang="ts">
// @ts-nocheck
import { defineComponent } from "vue";
import OButton from "@/lib/core/Button/OButton.vue";
import OTooltip from "@/lib/overlay/Tooltip/OTooltip.vue";
import { useI18nTyped } from "@/types/i18n";
import { getDashboard } from "../../utils/commons.ts";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import analytics from "@/services/product_analytics";

/**
 * Download the dashboard as a JSON file. Lives here so the toolbar row, the
 * overflow row and the keyboard shortcut all run the same export.
 */
export const downloadDashboardJson = async (store: any, dashboardId: any, folder: any) => {
  const dashboard = await getDashboard(store, dashboardId, folder);
  dashboard.owner = "";

  const data =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dashboard, null, 2));
  const htmlA = document.createElement("a");
  htmlA.setAttribute("href", data);
  const fileName = dashboard.title || "dashboard";
  htmlA.setAttribute("download", fileName + ".dashboard.json");
  htmlA.click();
  analytics.track("dashboard_exported", { format: "json" });
};

export default defineComponent({
  name: "ExportDashboard",
  components: { OButton, OTooltip },
  props: {
    dashboardId: { type: String, default: "" },
    // A labelled row in an overflow menu; the inline toolbar stays icon-only.
    showLabel: { type: Boolean, default: false },
    variant: { type: String, default: "outline" },
    size: { type: String, default: "icon-xs" },
    buttonClass: { type: String, default: "" },
  },
  setup(props) {
    const { t } = useI18nTyped();
    const store = useStore();
    const route = useRoute();
    const downloadDashboard = () =>
      downloadDashboardJson(store, props.dashboardId, route.query.folder);

    return {
      downloadDashboard,
      t,
    };
  },
});
</script>

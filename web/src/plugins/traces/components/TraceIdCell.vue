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
  <span
    class="text-text-body hover:text-text-heading cursor-pointer font-mono text-xs"
    data-test="trace-row-trace-id"
    @click.stop="navigateToTrace"
  >
    {{ item.trace_id }}
  </span>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import useTraces from "@/composables/useTraces";

const props = defineProps<{
  item: Record<string, any>;
}>();

const router = useRouter();
const store = useStore();
const { searchObj } = useTraces();

const navigateToTrace = () => {
  const mode = searchObj.meta.searchMode;
  const stream = String(
    router.currentRoute.value.query.stream || searchObj.data.stream.selectedStream.value || "",
  );
  const traceId = String(props.item.trace_id ?? "");
  const orgId = String(store.state.selectedOrganization.identifier ?? "");

  // start_time / end_time are nanoseconds — convert to microseconds like the
  // pre-migration table did via expandRowDetail.
  const startTime = Number(props.item.start_time ?? 0);
  const endTime = Number(props.item.end_time ?? props.item.start_time ?? 0);
  const from = startTime / 1000 - 60_000_000;
  const to = endTime / 1000 + 3_600_000_000;

  router.push({
    name: "traceDetails",
    query: {
      stream,
      trace_id: traceId,
      org_identifier: orgId,
      from: String(from),
      to: String(to),
      ...(mode === "spans" ? { span_id: String(props.item.span_id ?? "") } : {}),
    },
  });
};
</script>

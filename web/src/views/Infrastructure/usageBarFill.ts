// Copyright 2026 OpenObserve Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import type { ProgressBarVariant } from "@/lib/data/ProgressBar/OProgressBar.types";

/**
 * Fill override for a utilization bar.
 *
 * The shared `progress-bar-warning` step measured 1.92:1 against the page
 * ground and 1.52:1 against its own track on the hosts table — below the 3:1
 * floor for a graphic that carries state, so the loudest message on the
 * screen painted as the faintest ink. `row-rail-warning` is the sheet's
 * separable amber (3:1 on both grounds in both themes, same family as the
 * percentage ink beside the bar), so a bar crossing the utilization threshold
 * stays amber without re-inking a shared palette step.
 */
export const usageBarFill = (variant: ProgressBarVariant): string | undefined =>
  variant === "warning" ? "var(--color-row-rail-warning)" : undefined;

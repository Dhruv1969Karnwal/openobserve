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

/** Hysteresis band, in px: below it the two states are indistinguishable, so do not flip. */
export const FILL_HYSTERESIS_PX = 24;

/**
 * Whether a table should stretch to the height its parent offers.
 *
 * A four-row list stretched to a viewport leaves half a screen of empty frame and
 * reads as unfinished; a forty-row list needs every pixel it can scroll through.
 * The difference is content height versus available height, so decide it from the
 * measurement instead of from a per-page guess. An unknown height (before layout,
 * or in a test environment without one) fills, which is the historical behaviour.
 */
export function shouldFillHeight(
  availablePx: number,
  contentPx: number,
  currentlyFilling: boolean,
  hysteresisPx: number = FILL_HYSTERESIS_PX,
): boolean {
  if (!availablePx || availablePx <= 0 || !Number.isFinite(contentPx))
    return currentlyFilling || true;
  if (currentlyFilling) return contentPx > availablePx - hysteresisPx;
  return contentPx > availablePx + hysteresisPx;
}

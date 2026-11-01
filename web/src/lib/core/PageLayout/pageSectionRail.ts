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

import type { ComputedRef, InjectionKey, VNode } from "vue";

/** Whatever renders the rail: the host's own `#sidebar` slot, or the hub's. */
export type RailRenderer = () => VNode[];

/**
 * A section-hub page (IAM, Settings) owns the rail but hosts routed section pages
 * that own the header, so the rail is handed down and rendered under the hosted
 * page's own header instead of beside it.
 */
export interface PageSectionRailSource {
  /** The hub's `#sidebar` content, rendered by whichever layout holds the claim. */
  render: RailRenderer;
  width: ComputedRef<number>;
  /** True when this subtree must not take the rail: claimed below us, hidden, or a nearer rail exists. */
  blocked: ComputedRef<boolean>;
  owner: ComputedRef<symbol | null>;
  /** Claiming moves the token to the top of the stack, so the page most recently shown wins. */
  claim: (token: symbol) => void;
  release: (token: symbol) => void;
}

export const PAGE_SECTION_RAIL_KEY: InjectionKey<PageSectionRailSource> = Symbol("PageSectionRail");

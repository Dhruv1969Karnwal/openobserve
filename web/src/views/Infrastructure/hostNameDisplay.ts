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

/** Trailing dot-separated segments every listed host shares before it is worth printing once. */
const MIN_SHARED_SEGMENTS = 2;

export interface HostNameDisplay {
  /** Display name → label to print. Names with no shareable suffix map to themselves. */
  labels: Map<string, string>;
  /** The withheld suffix including its leading dot, or null when nothing is shared. */
  sharedSuffix: string | null;
}

const NOTHING: HostNameDisplay = { labels: new Map(), sharedSuffix: null };

/**
 * Shortens host labels by withholding the longest dot-separated suffix the WHOLE
 * list carries (`ip-10-0-20.eu-west-1.compute.internal` → `ip-10-0-20`), so the
 * part that tells two hosts apart keeps the column instead of being ellipsised
 * away. The withheld text is printed once beside the column, never dropped: a
 * suffix every row repeats is boilerplate, and the row keeps its identity.
 */
export function shortenHostNames(names: string[]): HostNameDisplay {
  const unique = [...new Set(names.map((name) => name?.trim() ?? "").filter(Boolean))];
  if (unique.length < 2) return NOTHING;

  const parts = unique.map((name) => name.split("."));
  const shortest = Math.min(...parts.map((segments) => segments.length));

  for (let shared = shortest - 1; shared >= MIN_SHARED_SEGMENTS; shared -= 1) {
    const suffix = parts[0].slice(-shared).join(".");
    if (!parts.every((segments) => segments.slice(-shared).join(".") === suffix)) continue;
    return {
      labels: new Map(
        unique.map((name, i) => [
          name,
          parts[i].slice(-shared).join(".") === suffix
            ? parts[i].slice(0, parts[i].length - shared).join(".")
            : name,
        ]),
      ),
      sharedSuffix: `.${suffix}`,
    };
  }

  return NOTHING;
}

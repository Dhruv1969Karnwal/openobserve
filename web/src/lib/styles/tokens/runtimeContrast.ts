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

/**
 * The ONE model of what a browser paints under a runtime theme, shared by the
 * spec-side gate (tokens/themeRuntimeContrast.spec.ts) and the census
 * (scripts/check-runtime-contrast.mjs), which imports this file through node's
 * built-in type stripping.
 *
 * A "scope" is the token map a page actually resolves: the parsed sheets
 * (base/semantic/component/dark.css) with `utils/themePalette`'s injection map written
 * over them, exactly as `applyThemeColors` writes it onto <html>/<body>. Six themes × two
 * modes = the twelve scopes every booked number in this repo is measured against.
 *
 * Nothing here transcribes production: the palette, the injected inks, the `--color-theme-*`
 * values and the semanticColors overlay all come from the functions the app runs, so a
 * booking can never describe a state the UI does not show.
 */
// Relative imports (not the @/ alias) so node's type-stripping loader can resolve this
// module from scripts/check-runtime-contrast.mjs without a bundler.
import { PREDEFINED_THEME_COLORS } from "../../../constants/themeRegistry";
import {
  generatePrimaryPalette,
  libraryForegroundTokens,
  PALETTE_SHADES,
  runtimeInjectedTokens,
  runtimePageBackground,
  runtimeSemanticTokens,
  type ThemeMode,
} from "../../../utils/themePalette";

import type { CensusPair, DynamicBinding, ScanContext, ScanInput } from "./runtimeContrastScan";
import { pairKey, scanSources, unattributedRuntimeLiterals } from "./runtimeContrastScan";

import {
  composite,
  contrastRatio,
  parseColor,
  relativeLuminance,
  resolveColor,
  resolveTokens,
  type Rgba,
} from "./colorMath";

export type { ThemeMode };
export { composite, contrastRatio, parseColor, relativeLuminance, resolveColor, resolveTokens };
export type { Rgba };

export const TEXT_MIN = 4.5;
export const NON_TEXT_MIN = 3;

export interface Scope {
  mode: ThemeMode;
  theme: string;
  themeColor: string;
  tokens: Map<string, string>;
  /** Memoised token → pixel for this scope. */
  color(name: string): Rgba | null;
  /** The <body> paint, opaque — what a translucent plate is finally laid over. */
  page: Rgba;
}

export interface PairOptions {
  /** What the ground is painted over (a translucent wash needs a plate). */
  under?: string;
  /** Element opacity (`hover:opacity-85`): fades ink AND ground toward the plate. */
  alpha?: number;
}

export interface RuntimeModel {
  sheets: Record<ThemeMode, Map<string, string>>;
  scopes: Scope[];
  darkScopes: Scope[];
  lightScopes: Scope[];
  /** Tokens whose painted pixel moves between the six themes of one mode. */
  runtimeVarying: Set<string>;
  side(value: string, scope: Scope): Rgba | null;
  hexOf(value: string, scope: Scope): string;
  measurePair(fg: string, bg: string, scope: Scope, options?: PairOptions): number | null;
}

/** Pseudo-token the census uses for the <body> paint itself (no utility produces it). */
export const PAGE_GROUND = "--census-page-bg";

/** A token name, a literal colour, or a colour expression resolved against `scope`. */
const literalSide = (value: string, scope: Map<string, string>): Rgba | null => {
  const direct = resolveColor(value, scope) ?? parseColor(value);
  if (direct) return direct;
  // An expression (`color-mix(in oklab, var(--color-x) 10%, transparent)`) is resolved by
  // inlining every var() reference, because colorMath only folds vars through a scope map.
  const expanded = value.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (match, token: string) => {
    const color = resolveColor(token, scope);
    if (!color) return match;
    return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`;
  });
  return expanded === value ? null : parseColor(expanded);
};

/** Element opacity: `alpha` of the layer, the plate behind it for the rest. */
const blend = (layer: Rgba, plate: Rgba, alpha: number): Rgba => ({
  r: layer.r * alpha + plate.r * (1 - alpha),
  g: layer.g * alpha + plate.g * (1 - alpha),
  b: layer.b * alpha + plate.b * (1 - alpha),
  a: 1,
});

const opaquePage = (mode: ThemeMode, themeColor: string): Rgba => {
  const parsed = parseColor(runtimePageBackground(themeColor, mode)) ?? {
    r: 255,
    g: 255,
    b: 255,
    a: 1,
  };
  return parsed.a < 1 ? composite(parsed, { r: 255, g: 255, b: 255, a: 1 }) : parsed;
};

/**
 * Build the twelve scopes over already-read sheet sources. Pure and synchronous: the
 * caller owns file I/O so the same call works in vitest, in node, and over fixtures.
 */
export const createRuntimeModel = (cssSources: string[]): RuntimeModel => {
  const parsed = resolveTokens(cssSources);
  const sheets: Record<ThemeMode, Map<string, string>> = {
    light: parsed.light,
    dark: parsed.dark,
  };

  const build = (theme: (typeof PREDEFINED_THEME_COLORS)[number], mode: ThemeMode): Scope => {
    const themeColor = theme[mode].themeColor;
    const palette = generatePrimaryPalette(themeColor);
    const tokens = new Map(sheets[mode]);
    for (const shade of PALETTE_SHADES) tokens.set(`--color-primary-${shade}`, palette[shade]);
    for (const [token, value] of Object.entries(runtimeInjectedTokens(themeColor, mode))) {
      tokens.set(token, value);
    }
    for (const [token, hex] of Object.entries(libraryForegroundTokens(mode, palette))) {
      tokens.set(token, hex);
    }
    for (const [token, hex] of Object.entries(
      runtimeSemanticTokens(
        theme[mode].semanticColors as unknown as Record<string, string | undefined> | undefined,
      ),
    )) {
      tokens.set(token, hex);
    }
    const cache = new Map<string, Rgba | null>();
    return {
      mode,
      theme: theme.name,
      themeColor,
      tokens,
      page: opaquePage(mode, themeColor),
      color: (name: string) => {
        if (!cache.has(name)) cache.set(name, resolveColor(name, tokens) ?? null);
        return cache.get(name) ?? null;
      },
    };
  };

  const scopes = PREDEFINED_THEME_COLORS.flatMap((theme) => [
    build(theme, "dark"),
    build(theme, "light"),
  ]);

  const runtimeVarying = new Set<string>();
  const names = new Set<string>();
  for (const scope of scopes) for (const key of scope.tokens.keys()) names.add(key);
  for (const name of names) {
    for (const mode of ["dark", "light"] as ThemeMode[]) {
      const values = new Set<string>();
      for (const scope of scopes) {
        if (scope.mode !== mode) continue;
        const color = scope.color(name);
        if (color)
          values.add(`${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)}`);
      }
      if (values.size > 1) runtimeVarying.add(name);
    }
  }

  const side = (value: string, scope: Scope): Rgba | null => {
    if (value === PAGE_GROUND) return scope.page;
    if (/^--[\w-]+$/.test(value)) return scope.color(value);
    return literalSide(value, scope.tokens);
  };

  const measurePair = (
    fg: string,
    bg: string,
    scope: Scope,
    options: PairOptions = {},
  ): number | null => {
    const plateToken = options.under ?? "--color-surface-base";
    const plateColor = side(plateToken, scope);
    if (!plateColor) return null;
    let ground = side(bg, scope);
    let ink = side(fg, scope);
    if (!ground || !ink) return null;
    const plate = plateColor.a < 1 ? composite(plateColor, scope.page) : plateColor;
    if (ground.a < 1) ground = composite(ground, plate);
    if (ink.a < 1) ink = composite(ink, ground);
    if (options.alpha !== undefined) {
      ground = blend(ground, plate, options.alpha);
      ink = blend(ink, plate, options.alpha);
    }
    if (ink.a < 1 || ground.a < 1) return null;
    return contrastRatio(ink, ground);
  };

  const hexOf = (value: string, scope: Scope): string => {
    const color = side(value, scope);
    if (!color) throw new Error(`${value} does not resolve`);
    return `#${[color.r, color.g, color.b]
      .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
      .join("")}`;
  };

  return {
    sheets,
    scopes,
    darkScopes: scopes.filter((scope) => scope.mode === "dark"),
    lightScopes: scopes.filter((scope) => scope.mode === "light"),
    runtimeVarying,
    side,
    hexOf,
    measurePair,
  };
};

/** Per-theme label so a booked key reads like the ledger's ("dark O2 Lens rest"). */
export const scopeKey = (scope: Scope): string => `${scope.mode} ${scope.theme}`;

/** One booked (site, ground, ink) residual, number-locked across the twelve scopes. */
export interface LedgerRow {
  id: string;
  /** The WCAG bar the site is measured at; a non-text row must be justified per entry. */
  kind?: "text" | "non-text";
  reason?: string;
  /** A row delegated to ANOTHER ledger names it here instead of carrying a reason. */
  bookedIn?: string;
  /** Plate the ground composites over (defaults to the ledger's plate). */
  plate?: string;
  /** Every scope's measured ratio, 2dp — an improvement is as loud as a regression. */
  at: Record<string, number>;
}

export interface CensusLedger {
  version: number;
  textMin: number;
  nonTextMin: number;
  /** Equality lock: the census fails when the residue grows OR heals without the lock moving. */
  maxUnbooked: number;
  maxDynamic: number;
  plate: string;
  bodyInk: string;
  pageGround: string;
  bookings: LedgerRow[];
  delegated?: LedgerRow[];
  dynamicBindings: Array<{ file: string; literal: string; reason: string }>;
}

export interface CensusRow {
  pair: CensusPair;
  id: string;
  pairId: string;
  bar: number;
  numbers: Record<string, number>;
  failing: Array<[string, number]>;
  unresolved: number;
  booking?: LedgerRow;
  delegated: boolean;
}

export interface CensusReport {
  files: number;
  pairs: number;
  measuredPass: number;
  booked: number;
  unbooked: number;
  fixable: number;
  driftCount: number;
  staleCount: number;
  dynamicCount: number;
  rows: CensusRow[];
  unbookedRows: CensusRow[];
  driftRows: string[];
  staleRows: LedgerRow[];
  staleDelegations: LedgerRow[];
  unbookedDynamic: DynamicBinding[];
  suggestions: Array<{ row: CensusRow; ink: string | null }>;
  exitCode: number;
  overCap: boolean;
  underRatchet: boolean;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Inks a failing site could simply bind: stable foreground tokens that hold the bar everywhere. */
const SUGGESTION_INKS = ["--color-text-heading", "--color-text-body", "--color-text-secondary"];

/**
 * The census pipeline BOTH gates run: scan the sources, measure every runtime pair in all twelve
 * injected scopes, and classify each as measured-pass / booked / delegated / unbooked / drift.
 * The ledger is the only way a pair may fail its bar, and its numbers are equality-checked, so a
 * booking that stops describing the source is as loud as a brand-new failure.
 */
export const runRuntimeCensus = (
  model: RuntimeModel,
  ledger: CensusLedger,
  sources: ScanInput[],
): CensusReport => {
  const context: ScanContext = {
    isToken: (token) => model.sheets.light.has(token) || model.sheets.dark.has(token),
    isRuntime: (token) => {
      if (token === ledger.pageGround) return true;
      if (token.startsWith("--")) return model.runtimeVarying.has(token);
      return [...token.matchAll(/--[\w-]+/g)].some((match) =>
        model.runtimeVarying.has(match[0] ?? ""),
      );
    },
    bodyInk: ledger.bodyInk,
    pageGround: ledger.pageGround,
  };
  const vueSources = sources.filter((source) => source.path.endsWith(".vue"));
  const scan = scanSources(vueSources, context);
  const cited = new Set(
    scan.pairs.flatMap((pair) => [pair.ground, pair.ink]).filter((value) => value.startsWith("--")),
  );
  const unattributed = unattributedRuntimeLiterals(sources, context, cited);

  const bookings = new Map(ledger.bookings.map((row) => [row.id, row]));
  const delegatedRows = new Map((ledger.delegated ?? []).map((row) => [row.id, row]));
  const dynamicBooked = new Set(
    (ledger.dynamicBindings ?? []).map((row) => row.file + " " + row.literal),
  );

  const rows: CensusRow[] = scan.pairs.map((pair) => {
    const id = pairKey(pair);
    const pairId = pair.ground + " " + pair.ink;
    const bar = pair.bar === "non-text" ? ledger.nonTextMin : ledger.textMin;
    const booking = bookings.get(id) ?? delegatedRows.get(pairId);
    const plate = booking?.plate ?? ledger.plate;
    const numbers: Record<string, number> = {};
    const failing: Array<[string, number]> = [];
    let unresolved = 0;
    for (const scope of model.scopes) {
      const value = model.measurePair(pair.ink, pair.ground, scope, {
        under: plate,
        alpha: pair.alpha,
      });
      if (value === null) {
        unresolved++;
        continue;
      }
      numbers[scopeKey(scope)] = round2(value);
      if (value < bar) failing.push([scopeKey(scope), round2(value)]);
    }
    return {
      pair,
      id,
      pairId,
      bar,
      numbers,
      failing,
      unresolved,
      booking,
      delegated: !bookings.has(id) && Boolean(booking),
    };
  });

  const measuredPass = rows.filter((row) => row.failing.length === 0 && row.unresolved === 0);
  const problems = rows.filter((row) => row.failing.length > 0 || row.unresolved > 0);
  const booked = problems.filter((row) => row.booking);
  const unbooked = problems.filter((row) => !row.booking);

  const driftRows: string[] = [];
  for (const row of booked) {
    const booking = row.booking;
    if (!booking) continue;
    const kind = row.pair.bar === "non-text" ? "non-text" : "text";
    if (booking.kind !== undefined && booking.kind !== kind) {
      driftRows.push(row.id + ": booked as " + booking.kind + ", the source paints " + kind);
    }
    if (row.delegated && !booking.bookedIn) {
      driftRows.push(row.pairId + ": a delegated row must name the ledger that carries it");
    }
    if (!row.delegated && !(booking.reason ?? "").includes("palette-decision")) {
      driftRows.push(
        row.id + ": a booked pair needs a reason carrying the palette-decision marker",
      );
    }
    for (const [scope, value] of Object.entries(row.numbers)) {
      const at = booking.at[scope];
      if (at === undefined)
        driftRows.push(row.id + " @ " + scope + ": measures " + value + ", nothing booked");
      else if (round2(at) !== value)
        driftRows.push(row.id + " @ " + scope + ": measures " + value + ", booked " + at);
    }
    for (const scope of Object.keys(booking.at)) {
      if (row.numbers[scope] === undefined) {
        driftRows.push(
          row.id +
            " @ " +
            scope +
            ": booked " +
            booking.at[scope] +
            ", the pair no longer resolves there",
        );
      }
    }
    if (row.unresolved > 0) {
      driftRows.push(row.id + ": pair does not resolve in " + row.unresolved + " scopes");
    }
  }

  const staleRows = ledger.bookings.filter((entry) => !rows.some((row) => row.id === entry.id));
  const staleDelegations = (ledger.delegated ?? []).filter(
    (entry) => !rows.some((row) => row.pairId === entry.id),
  );
  const unbookedDynamic = unattributed.filter(
    (binding) => !dynamicBooked.has(binding.file + " " + binding.literal),
  );
  const suggestions = unbooked.map((row) => ({
    row,
    ink:
      SUGGESTION_INKS.find((ink) =>
        model.scopes.every((scope) => {
          const value = model.measurePair(ink, row.pair.ground, scope, {
            under: ledger.plate,
            alpha: row.pair.alpha,
          });
          return value !== null && value >= row.bar;
        }),
      ) ?? null,
  }));

  const counts = {
    files: scan.files,
    pairs: rows.length,
    measuredPass: measuredPass.length,
    booked: booked.length,
    unbooked: unbooked.length,
    fixable: suggestions.filter((entry) => entry.ink).length,
    driftCount: driftRows.length,
    staleCount: staleRows.length + staleDelegations.length,
    dynamicCount: unbookedDynamic.length,
  };
  const overCap = counts.unbooked > ledger.maxUnbooked;
  const underRatchet = counts.unbooked < ledger.maxUnbooked;
  const maxDynamic = ledger.maxDynamic ?? 0;
  const exitCode =
    overCap ||
    underRatchet ||
    counts.dynamicCount > maxDynamic ||
    counts.dynamicCount < maxDynamic ||
    counts.driftCount ||
    counts.staleCount
      ? 1
      : 0;
  return {
    ...counts,
    rows,
    unbookedRows: unbooked,
    driftRows,
    staleRows,
    staleDelegations,
    unbookedDynamic,
    suggestions,
    exitCode,
    overCap,
    underRatchet,
  };
};

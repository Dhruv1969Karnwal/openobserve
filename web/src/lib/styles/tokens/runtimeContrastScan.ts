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
 * The SCANNER behind the runtime-contrast census (`scripts/check-runtime-contrast.mjs`).
 *
 * Pure — it takes `{ path, source }` pairs and returns every (ground, ink) pair the source can
 * paint, so the CLI and the spec-side enforcer (`themeRuntimeContrast.spec.ts`) run the SAME
 * enumeration: a shape this file cannot see is invisible to BOTH gates instead of silently passing
 * one of them. The shapes it exists to see (each covered by a fixture in the census' `--selftest`):
 *
 *   • ink on a DESCENDANT of the filled element, and ink INHERITED from an ancestor or falling back
 *     to the body default (`--color-text-body`) — the documented cascade approximation,
 *   • `/NN` alpha modifiers, modelled as the `color-mix(… transparent)` Tailwind v4 compiles them
 *     to, then composited over the plate behind,
 *   • classes coming from `<script>`: string-literal assignments are resolved and substituted into
 *     the binding; a runtime class literal that no measured pair cites is reported by
 *     `unattributedRuntimeLiterals` (the ledger has to explain it),
 *   • `<style>` rules declaring `color` together with `background`,
 *   • gradient fills, measured at their accent stop (the worst one for a light ink),
 *   • element opacity (`opacity-NN` / `hover:opacity-NN`), stored as the pair's `alpha` and fading
 *     BOTH ink and ground toward the plate — the state the rest-only ledgers never measured.
 *
 * PAINT STATES. A class only paints while its binding lets it: `hover:` chains, `{ 'bg-x': on }`
 * guards and ternary arms are all separate states. Ground and ink are reported as a pair only when
 * they are reachable in the SAME state, which is what keeps a conditional accent label from being
 * measured against the element's resting background (that artefact reads as a false 1.00:1).
 *
 * Nesting is a tag stack; `{{interp}}` counts as text; an element whose children are only icons is
 * classified `non-text` (SC 1.4.11's 3:1 bar) and every such classification must be booked with a
 * justification, so the cheaper bar can never be quietly assumed.
 */

export type Bar = "text" | "non-text";
export type InkVia = "self" | "descendant" | "inherit" | "style";

export interface ScanInput {
  path: string;
  source: string;
}

export interface CensusPair {
  file: string;
  line: number;
  /** Token name (`--color-x`), colour literal, or colour expression (`color-mix(...)`). */
  ground: string;
  groundClass: string;
  ink: string;
  inkClass: string;
  /** Variant chain the pair paints under: "" (rest), "hover", "group-hover", … */
  state: string;
  /** Element opacity applied to both sides in that state (0.85 for `hover:opacity-85`). */
  alpha?: number;
  bar: Bar;
  via: InkVia;
  /** What the element paints (a text snippet, or "icon"), for the report. */
  sample: string;
}

export interface DynamicBinding {
  file: string;
  line: number;
  /** The class string as written, e.g. "bg-theme-accent text-white". */
  literal: string;
  /** Runtime colour tokens that string paints, which NO measured pair cites. */
  tokens: string[];
  /** The (ground, ink) the literal paints with itself — the numbers its row must book. */
  pairs?: LiteralPair[];
  /** Class fragments no registered family can expand; prose can never cover these. */
  unexpandableStems?: string[];
}

/** One (ground, ink) pairing a single class string paints with itself. */
export interface LiteralPair {
  ground: string;
  groundClass: string;
  ink: string;
  inkClass: string;
  bar: Bar;
}

export interface ScanResult {
  pairs: CensusPair[];
  files: number;
}

export interface ScanContext {
  /** Is `--color-<name>` a registered token? (this filters text-3xs / text-bold out of text-*). */
  isToken: (token: string) => boolean;
  /** Does the token's painted pixel move between the themes of one mode? */
  isRuntime: (token: string) => boolean;
  /** Ink a page falls back to with no bound class (styles/base-elements.css `body`). */
  bodyInk: string;
  /** Ground a page falls back to with no bound class. */
  pageGround: string;
}

/**
 * One paint state of one element. A class inside `{ 'bg-theme-accent!': isFocused }` or
 * `isFocused ? 'bg-theme-accent! text-button-primary-foreground!' : ''` only paints while THAT
 * condition holds, so ground and ink are a real pair only inside a shared state.
 */
interface ElBucket {
  chain: string;
  classes: string[];
  ground?: string;
  ink?: string;
  alpha?: number;
  gradient?: boolean;
}

interface ElFrame {
  name: string;
  line: number;
  states: Map<string, ElBucket>;
  unresolved: string[];
  text: string;
  glyph: boolean;
  /** An icon somewhere below: the control carries state, so the 3:1 (SC 1.4.11) bar applies. */
  hasGlyphDescendant: boolean;
}

/** The state key of a class: its variant chain plus the condition its binding puts it under. */
export const stateKey = (chain: string, condition: string): string =>
  condition ? `${chain}|${condition}` : chain;

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Children that carry meaning as a glyph rather than as text. */
const ICON_ELEMENTS = new Set(["i", "svg", "img", "path", "use", "canvas", "picture"]);

/**
 * Children that carry meaning as a glyph rather than as text. The NAME test is the part that
 * matters: this app's icon component is <OIcon>, and a scan that only recognised <QIcon> measured
 * NO icon-only control at all — which is how the booked hover:opacity sites stayed out of
 * every census for three waves.
 */
export const isGlyphElement = (name: string): boolean =>
  ICON_ELEMENTS.has(name) ||
  /(?:icon|icons|glyph|image|img|avatar|spinner|logo|symbol|svg)$/.test(name);

/** Chains the census models as painted states; anything else stays on the resting chain. */
const STATE_CHAINS = new Set([
  "",
  "hover",
  "group-hover",
  "active",
  "focus",
  "focus-visible",
  "aria-selected",
  "data-[state=checked]",
]);

const ALPHA_SUFFIX = /^(.+)\/(\d{1,3})$/;

/** Variant chain of a utility: `hover:opacity-85` -> `hover`. */
export const chainOf = (klass: string): string => {
  const parts = klass.split(":");
  return parts.length > 1 ? parts.slice(0, -1).join(":") : "";
};

const stripChain = (klass: string): string => klass.replace(/^[a-z0-9[-]+:/g, "");

/** Class-name-shaped tokens of a class value, chain intact (JS syntax drops out). */
export const classesIn = (value: string): string[] =>
  [...new Set(value.split(/[\s,]+/).map((token) => token.trim()))].filter((token) =>
    /^[a-z][a-z0-9[-]*(?:\/\d{1,3})?!?$/.test(stripChain(token)),
  );

const stringLiterals = (value: string): string[] =>
  [...value.matchAll(/(["'`])([^"'`]*)\1/g)]
    .map((m) => m[2] ?? "")
    .filter((text) => text.trim().length > 0);

const RESERVED_IDENTS = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "props",
  "item",
  "items",
  "index",
  "row",
  "rows",
  "theme",
  "mode",
  "col",
  "cols",
  "value",
  "values",
  "option",
  "options",
  "tab",
  "tabs",
  "step",
  "size",
  "type",
  "state",
  "color",
  "colors",
  "tone",
  "length",
  "class",
  "cls",
  "name",
]);

/** Identifiers a dynamic binding reads, i.e. the candidates for script-literal resolution. */
export const identifiersIn = (value: string): string[] =>
  [...new Set([...value.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)].map((m) => m[1] ?? ""))].filter(
    (name) =>
      !RESERVED_IDENTS.has(name) &&
      !/^(?:bg|text|border|ring|opacity|group|hover|focus|dark)-/.test(name),
  );

/** The `color-mix(… transparent)` Tailwind v4 compiles a `/NN` modifier into. */
const withAlpha = (token: string, alpha: number): string =>
  "color-mix(in oklab, var(" + token + ") " + alpha + "%, transparent)";

/**
 * The accent stops of a CSS gradient, each as the expression it really paints. A tinted stop
 * (`color-mix(in srgb, var(--color-theme-accent) 8%, transparent)`) must be measured AS that tint:
 * collapsing every mention of the accent token to the raw fill invented 1.00:1 "invisible text"
 * rows on wash-gradient buttons whose ground is an 8 % tint, not the accent. A gradient with several
 * accent stops yields one pair per stop, because a gradient has no single ground pixel anywhere.
 */
/** The balanced call beginning at `start` (whose first `(` sits at `open`), name included. */
const balancedCall = (value: string, start: number, open: number): string | null => {
  let depth = 0;
  for (let index = open; index < value.length; index++) {
    if (value[index] === "(") depth++;
    else if (value[index] === ")") {
      depth--;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }
  return null;
};

export const gradientStops = (value: string): string[] => {
  if (!/gradient\(/.test(value)) return [];
  const stops: string[] = [];
  const call = /(?:color-mix|var)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = call.exec(value))) {
    const start = match.index ?? 0;
    const open = start + match[0].length - 1;
    const expression = balancedCall(value, start, open);
    if (!expression) break;
    call.lastIndex = start + expression.length;
    if (/theme-accent|accent|button-primary/.test(expression)) stops.push(expression);
  }
  if (stops.length) return [...new Set(stops)];
  const stop = /--color-(theme-accent|accent|button-primary)/.exec(value);
  return stop ? ["--color-" + stop[1]] : [];
};

/** The single worst accent stop of a gradient, for the one-expression call sites. */
const gradientStop = (value: string): string | null => gradientStops(value)[0] ?? null;

/** The colour expression a utility paints, or null when the utility is not a colour. */
export const expressionFor = (
  klass: string,
  kind: "ground" | "ink",
  context: ScanContext,
): string | null => {
  const bare = stripChain(klass).replace(/!$/, "");
  const prefix = kind === "ground" ? "bg-" : "text-";
  if (!bare.startsWith(prefix)) return null;
  const utility = bare.slice(prefix.length);
  const arbitrary = /^\[([^\]]+)\]$/.exec(utility);
  if (arbitrary) {
    const inner = arbitrary[1] ?? "";
    if (kind === "ground") {
      const stop = gradientStop(inner);
      if (stop) return stop;
    }
    return /^(?:var\(|#|rgba?\(|oklch\(|hsla?\()/.test(inner) ? inner : null;
  }
  const alpha = ALPHA_SUFFIX.exec(utility);
  const name = (alpha ? alpha[1] : utility) ?? utility;
  const token = `--color-${name}`;
  if (!context.isToken(token)) return null;
  return alpha ? withAlpha(token, Number(alpha[2])) : token;
};

/** Every class attribute value of a start tag, with the attribute name (binding kind). */
const classAttributes = (body: string): Array<[string, string]> =>
  [...body.matchAll(/(^|\s)(:?class|v-bind:class)([^=]*)=\s*(["'])([\s\S]*?)\4/g)].map((m) => [
    m[2] ?? "",
    m[5] ?? "",
  ]);

/** Comma split that ignores commas inside quotes, parens or nested braces. */
const splitTopLevel = (text: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(" || char === "{" || char === "[") depth++;
    else if (char === ")" || char === "}" || char === "]") depth--;
    else if (char === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
};

/** `key: guard` pairs of an object binding (`{ "bg-x hover:bg-y": on }` keys may hold several). */
const objectEntries = (value: string): Array<{ klasses: string; condition: string }> => {
  const body = /^\{([\s\S]*)\}$/.exec(value.trim());
  if (!body) return [];
  return splitTopLevel(body[1] ?? "")
    .map((part) =>
      /^\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([A-Za-z_$][\w$]*))\s*:\s*([\s\S]+)$/.exec(part),
    )
    .filter((pair): pair is RegExpExecArray => pair !== null)
    .map((pair) => ({
      klasses: pair[1] ?? pair[2] ?? pair[3] ?? pair[4] ?? "",
      condition: (pair[5] ?? "").trim(),
    }))
    .filter((entry) => entry.klasses.length > 0);
};

/**
 * Classes of a class binding, each paired with the CONDITION it paints under: "" for a static
 * attribute or an array member (always applied), the arm text for a ternary, the guard expression
 * for an object key, the identifier name for a script-resolved binding.
 */
export const dynamicClassEntries = (
  value: string,
  scriptClasses: Map<string, string[]>,
): Array<{ klass: string; condition: string }> => {
  const out: Array<{ klass: string; condition: string }> = [];
  const trimmed = value.trim();
  const pushAll = (text: string, condition: string): void => {
    for (const klass of classesIn(text)) out.push({ klass, condition });
  };
  if (trimmed.startsWith("[")) {
    for (const literal of stringLiterals(trimmed)) pushAll(literal, "");
    for (const id of identifiersIn(trimmed)) pushAll((scriptClasses.get(id) ?? []).join(" "), id);
    return out;
  }
  const entries = objectEntries(trimmed);
  for (const entry of entries) pushAll(entry.klasses, entry.condition);
  const consumed = new Set(entries.map((entry) => entry.klasses));
  for (const literal of stringLiterals(trimmed)) {
    if (consumed.has(literal)) continue;
    pushAll(literal, literal);
  }
  for (const id of identifiersIn(trimmed)) {
    const known = scriptClasses.get(id);
    if (known) pushAll(known.join(" "), id);
  }
  return out;
};

const bucketOf = (el: ElFrame, key: string, chain: string): ElBucket => {
  const existing = el.states.get(key);
  if (existing) return existing;
  const bucket: ElBucket = { chain, classes: [] };
  el.states.set(key, bucket);
  return bucket;
};

/** Read an element's class attributes into paint-state buckets. */
const readClasses = (
  el: ElFrame,
  body: string,
  context: ScanContext,
  scriptClasses: Map<string, string[]>,
): void => {
  for (const [attribute, value] of classAttributes(body)) {
    const dynamic = attribute !== "class";
    const items = dynamic
      ? dynamicClassEntries(value, scriptClasses)
      : classesIn(value).map((klass) => ({ klass, condition: "" }));
    if (dynamic) {
      const unknown = identifiersIn(value).filter((id) => !scriptClasses.has(id));
      if (unknown.length) el.unresolved.push(...unknown);
    }
    for (const { klass, condition } of items) {
      const chain = chainOf(klass);
      const bucket = bucketOf(el, stateKey(chain, condition), chain);
      if (!bucket.classes.includes(klass)) bucket.classes.push(klass);
    }
    // Classify per bucket rather than per class: a gradient ground may be written as
    // bg-gradient-to-b from-theme-accent in either order.
    for (const bucket of el.states.values()) classifyBucket(bucket, context);
  }
};

const classifyBucket = (bucket: ElBucket, context: ScanContext): void => {
  bucket.ground = undefined;
  bucket.ink = undefined;
  bucket.alpha = undefined;
  let gradient = false;
  let solid: string | null = null;
  let stop: string | null = null;
  let ink: string | null = null;
  for (const klass of bucket.classes) {
    const bare = stripChain(klass).replace(/!$/, "");
    const opacity = /(?::|^)opacity-(\d{1,3})!?$/.exec(klass);
    if (opacity) {
      bucket.alpha = Number(opacity[1]) / 100;
      continue;
    }
    if (/^(?:bg|from)-(?:linear|radial|conic|repeating-linear)-to-/.test(bare)) {
      gradient = true;
      continue;
    }
    const ground = expressionFor(klass, "ground", context);
    if (ground) {
      solid = ground;
      continue;
    }
    if (gradient || /^(?:from|via|to)-/.test(bare)) {
      const stopExpression = expressionFor(
        "bg-" + bare.replace(/^(?:from|via|to)-/, ""),
        "ground",
        context,
      );
      if (stopExpression) stop = stopExpression;
    }
    const inkExpression = expressionFor(klass, "ink", context);
    if (inkExpression) ink = inkExpression;
  }
  bucket.gradient = gradient;
  // A gradient is measured at its accent-ish stop (the brightest one for a light ink),
  // which is what the booked hero rows in the ledger describe.
  bucket.ground = solid ?? stop ?? undefined;
  bucket.ink = ink ?? undefined;
};

/** `const X = "…"`, `ref("…")`, `computed(() => "…")`, `{ X: "…" }` → the classes X can hold. */
export const scriptClassMap = (script: string): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  const add = (name: string | undefined, value: string | undefined): void => {
    if (!name || !value) return;
    const list = map.get(name) ?? [];
    for (const klass of classesIn(value.replace(/^["'`]|["'`]$/g, ""))) {
      if (!list.includes(klass)) list.push(klass);
    }
    if (list.length) map.set(name, list);
  };
  for (const re of [
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*([`'"][^`'"]*[`'"])/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:ref|computed)\s*\(\s*\(\s*\)\s*=>\s*([`'"][^`'"]*[`'"])/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:ref|computed)\s*\(\s*([`'"][^`'"]*[`'"])/g,
    /(?:^|[,{(])\s*([A-Za-z_$][\w$]*)\s*:\s*([`'"][^`'"]*[`'"])/g,
  ]) {
    for (const match of script.matchAll(re)) add(match[1], match[2]);
  }
  return map;
};

/** Class literals in code that paint a runtime colour (attribute-or-book, never ignore). */
export const scriptRuntimeClassLiterals = (
  code: string,
  context: ScanContext,
): Array<{ literal: string; tokens: string[] }> => {
  const out: Array<{ literal: string; tokens: string[] }> = [];
  for (const match of code.matchAll(/(["'`])([^"'`]*)\1/g)) {
    const literal = match[2] ?? "";
    const klasses = classesIn(literal);
    if (!klasses.length) continue;
    const tokens = klasses
      .map(
        (klass) => expressionFor(klass, "ground", context) ?? expressionFor(klass, "ink", context),
      )
      .filter(
        (expression): expression is string => expression !== null && context.isRuntime(expression),
      );
    if (tokens.length) out.push({ literal, tokens });
  }
  return out;
};

/**
 * INTERPOLATED CLASS FRAGMENTS (F-153/F-EDGE-1 attack S4).
 *
 * `'bg-stepper-indicator-' + state` and `` bg-stepper-indicator-${state} `` name no complete
 * utility, so neither the pair scan nor the string-literal backstop could see them: the census
 * stayed green over a shape that paints any member of the family. A fragment is therefore a
 * first-class finding. When the script knows the enum a variable ranges over — registered below,
 * one reviewed line per family — the fragment is EXPANDED into its members and measured like any
 * other class string; when it does not, the binding is reported `unexpandableStems` and can never
 * be quieted by a ledger row, which is what keeps the shape inside the MAX-DYNAMIC hard pin.
 *
 * A family is registered by its state suffixes, never derived from the token sheet: enumerating
 * `--color-stepper-indicator-*` would invent `bg-stepper-indicator-fg` (the white ink as a ground)
 * and book phantoms the UI cannot paint.
 */
export const CLASS_FRAGMENT_FAMILIES: Record<string, string[]> = {
  "bg-stepper-indicator-": ["default", "active", "done", "error"],
  "text-stepper-indicator-": ["fg", "default-text"],
};

/**
 * An interpolated class fragment ('bg-x-' + state, or bg-x-${state}) names no complete utility, so
 * neither the pair scan nor the literal backstop sees the classes it paints. A fragment must START
 * a class value: the `:data-test` identifiers scattered through the templates interpolate
 * hyphen-runs too and are not classes, so the boundary set below is load-bearing.
 */
const FRAGMENT_UTILITY = "(?:bg|text|border|ring)";
const FRAGMENT_QUOTE = "[\\'\\\"`]";
const FRAGMENT_BOUNDARY = "[\\s\\'\\\"`({,=]";
/** concat, template hole, bare trailing stem; capture group 1 is always the family stem. */
const CLASS_FRAGMENT_PATTERNS: RegExp[] = [
  new RegExp(
    "(?:^|" +
      FRAGMENT_BOUNDARY +
      ")" +
      FRAGMENT_QUOTE +
      "((?:" +
      FRAGMENT_UTILITY +
      ")-[a-z0-9-]*-)" +
      FRAGMENT_QUOTE +
      "\\s*\\+",
    "g",
  ),
  new RegExp("(?:^|" + FRAGMENT_BOUNDARY + ")((?:" + FRAGMENT_UTILITY + ")-[a-z0-9-]*)\\$\\{", "g"),
  new RegExp(
    "(?:^|" +
      FRAGMENT_BOUNDARY +
      ")((?:" +
      FRAGMENT_UTILITY +
      ")-[a-z0-9-]*-)(?=$|" +
      FRAGMENT_QUOTE +
      ")",
    "g",
  ),
];

/** The family stems a class-bearing text builds at runtime. */
export const classFragmentsIn = (text: string): string[] => {
  const stems = new Set<string>();
  for (const pattern of CLASS_FRAGMENT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) stems.add(match[1] ?? "");
  }
  return [...stems].filter((stem) => stem.length > 5);
};

/** Every class a registered fragment family can paint (empty when the family is unknown). */
export const expandClassFragment = (stem: string): string[] =>
  (CLASS_FRAGMENT_FAMILIES[stem] ?? []).map((state) => stem + state);

/** Block and line comment runs, blanked at equal length so every index survives. */
export const blankComments = (code: string): string =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, (run) => " ".repeat(run.length))
    .replace(/^[ \t]*\/\/.*$/gm, (run) => " ".repeat(run.length));

/**
 * The (ground, ink) a class string paints ON ITS OWN ELEMENT, resolved the way `classifyBucket`
 * resolves one: the last utility per side wins, and only the REST chain counts (a `hover:` arm is
 * a different state, which the template walker books through its own chain key). A registered
 * interpolated fragment enumerates one pair per family member — that is the measurement of the
 * expanded family the ledger row has to carry.
 */
export const literalPaintPairs = (text: string, context: ScanContext): LiteralPair[] => {
  const fragments = classFragmentsIn(text);
  // Quotes are the JS around the class value, not part of it; `classesIn` would drop a token
  // written as `'bg-x'` and leave the fragment's neighbour invisible. Arbitrary values
  // (`text-[#fff]`) are equally invisible to `classesIn` and are exactly the hand-written ink
  // shape this scan exists to catch, so they are collected alongside it.
  const clean = text.replace(/["'`]/g, " ");
  const arbitrary = [...clean.matchAll(/(?:^|\s)((?:bg|text)-\[[^\]\s]+\])/g)].map(
    (m) => m[1] ?? "",
  );
  const rests = [...classesIn(clean), ...arbitrary]
    .filter((klass) => !klass.endsWith("-"))
    .filter((klass) => chainOf(klass) === "");
  const side = (
    kind: "ground" | "ink",
    fromFamily: (stem: string) => boolean,
  ): Array<{ expression: string; klass: string }> => {
    const family = fragments.filter(fromFamily);
    if (family.length) {
      return family
        .flatMap(expandClassFragment)
        .map((klass) => ({ expression: expressionFor(klass, kind, context) ?? "", klass }))
        .filter((entry) => entry.expression !== "");
    }
    const found: Array<{ expression: string; klass: string }> = [];
    for (const klass of rests) {
      const expression = expressionFor(klass, kind, context);
      if (expression) found.push({ expression, klass });
    }
    return found.slice(-1);
  };
  const out: LiteralPair[] = [];
  for (const ground of side("ground", (stem) => stem.startsWith("bg-"))) {
    for (const ink of side("ink", (stem) => stem.startsWith("text-"))) {
      if (!context.isRuntime(ground.expression) && !context.isRuntime(ink.expression)) continue;
      out.push({
        ground: ground.expression,
        groundClass: ground.klass,
        ink: ink.expression,
        inkClass: ink.klass,
        bar: "text",
      });
    }
  }
  return out;
};

/**
 * A utility that paints a hand-written colour instead of a design token: `text-white`, `text-black`
 * and their `/NN` alphas, or an arbitrary literal (`text-[#fff]`). An arbitrary value that points
 * at a token is NOT raw — the pairing is citable through that token like any other.
 */
const RAW_INK_UTILITY =
  /^text-(?:white|black)(?:\/\d{1,3})?!?$|^text-\[(?!var\()[^\]]+\]!?(?:\/\d{1,3})?$/i;

export const isRawInkUtility = (klass: string): boolean =>
  RAW_INK_UTILITY.test(stripChain(klass).replace(/!$/, ""));

/**
 * Class fragments a source builds at runtime, whether or not the family is registered. Template
 * fragments are read only inside class attributes — `:data-test` identifiers interpolate
 * hyphen-runs constantly and are not classes.
 */
export interface ClassFragmentSite {
  line: number;
  literal: string;
  stems: string[];
  expandable: string[];
  unexpandable: string[];
}

export const classFragmentSites = (input: ScanInput): ClassFragmentSite[] => {
  const sites: ClassFragmentSite[] = [];
  const seen = new Set<string>();
  const note = (source: string, index: number, text: string): void => {
    const stems = classFragmentsIn(text);
    if (!stems.length) return;
    const literal = text.replace(/\s+/g, " ").trim().slice(0, 120);
    const key = `|`;
    if (seen.has(key)) return;
    seen.add(key);
    sites.push({
      line: lineAt(source, index),
      literal,
      stems,
      expandable: stems.filter((stem) => (CLASS_FRAGMENT_FAMILIES[stem] ?? []).length > 0),
      unexpandable: stems.filter((stem) => !(CLASS_FRAGMENT_FAMILIES[stem] ?? []).length),
    });
  };
  const code = blankComments(codeOf(input));
  for (const match of code.matchAll(/(["'`])((?:[^"'`]|\$\{[^}]*\})*?)\1/g)) {
    note(input.source, match.index ?? 0, match[2] ?? "");
  }
  if (input.path.endsWith(".vue")) {
    const template = block(input.source, "template");
    for (const match of template.matchAll(/(?::class|v-bind:class)\s*=\s*(["'])([\s\S]*?)\1/g)) {
      note(template, match.index ?? 0, match[2] ?? "");
    }
  }
  return sites;
};

/** The code (non-template) of a source: SFC `<script>` blocks, or a whole .ts module. */
export const codeOf = (input: ScanInput): string => {
  if (!input.path.endsWith(".vue")) return input.source;
  return [...input.source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1] ?? "")
    .join("\n");
};

/**
 * Runtime class literals the code can paint but NO measured pair cites — the class-from-script
 * blind spot (E-2 shape #3). Every entry must be explained in the ledger's dynamicBindings, and
 * the explanation now carries the literal's measured numbers (see runRuntimeCensus).
 *
 * RAW INKS ARE ATTRIBUTED PER (GROUND, INK) PAIR (F-154 / A2). Token citation still governs a
 * literal that names only registered tokens — both sides cited means the ledger carries that
 * pairing somewhere. But a literal that paints a HAND-WRITTEN ink over a runtime fill can never
 * be cited by token, and that is exactly the shipped shape of F-EDGE-4: white on
 * `--color-badge-primary-soft-bg` is 1.19:1 in O2 Lens light while the same fill passes with its
 * designed ink, and the whole-`src` run filtered the literal out because the FILL was cited.
 */
export const unattributedRuntimeLiterals = (
  inputs: ScanInput[],
  context: ScanContext,
  cited: Set<string>,
  citedPairs: Set<string> = new Set(),
): DynamicBinding[] => {
  const out: DynamicBinding[] = [];
  for (const input of inputs) {
    const code = codeOf(input);
    const blanks = blankComments(code);
    // Comments are blanked for the whole walk: a doc example that quotes a real pair
    // (`bg-theme-accent text-white` in this very file) is prose, not paint.
    for (const entry of scriptRuntimeClassLiterals(blanks, context)) {
      const pairs = literalPaintPairs(entry.literal, context);
      const unattributed = entry.tokens.filter((token) => !cited.has(token));
      const rawPairs = pairs.filter(
        (pair) => isRawInkUtility(pair.inkClass) && !citedPairs.has(pair.ground + "|" + pair.ink),
      );
      if (!unattributed.length && !rawPairs.length) continue;
      out.push({
        file: input.path,
        line: lineAt(input.source, Math.max(0, code.indexOf(entry.literal)) + 1),
        literal: entry.literal,
        tokens: [...new Set(unattributed)],
        pairs: pairs.length ? pairs : undefined,
      });
    }
    // An interpolated fragment paints a whole family; the ledger row explains the expanded enum.
    for (const site of classFragmentSites(input)) {
      const pairs = literalPaintPairs(site.literal, context);
      const runtime = [...new Set(pairs.flatMap((pair) => [pair.ground, pair.ink]))].filter(
        (token) => context.isRuntime(token),
      );
      if (!site.unexpandable.length && !runtime.length) continue;
      out.push({
        file: input.path,
        line: lineAt(input.source, Math.max(0, blanks.indexOf(site.literal)) + 1),
        literal: site.literal,
        tokens: runtime,
        pairs: pairs.length ? pairs : undefined,
        unexpandableStems: site.unexpandable.length ? site.unexpandable : undefined,
      });
    }
  }
  return out;
};

const block = (source: string, tag: string): string => {
  const open = new RegExp(`<${tag}(?:\\s[^>]*)?>`, "i").exec(source);
  if (!open) return "";
  const scanner = new RegExp(`</?${tag}(?:\\s[^>]*)?>`, "gi");
  scanner.lastIndex = open.index + open[0].length;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(source))) {
    if (match[0].startsWith("</")) depth--;
    else if (!match[0].endsWith("/>")) depth++;
    if (depth === 0) return source.slice(open.index + open[0].length, match.index);
  }
  return source.slice(open.index + open[0].length);
};

const lineAt = (source: string, index: number): number => source.slice(0, index).split("\n").length;

interface Cascaded {
  ground: string;
  groundClass: string;
  groundDepth: number;
  ink: string;
  inkClass: string;
  inkDepth: number;
  alpha?: number;
}

/** Buckets reachable in `state`, best first: exact state, its chain, its condition, resting. */
const bucketsFor = (el: ElFrame, chain: string, condition: string): ElBucket[] => {
  const keys = [stateKey(chain, condition), stateKey(chain, ""), stateKey("", condition), ""];
  const found: ElBucket[] = [];
  for (const key of new Set(keys)) {
    const bucket = el.states.get(key);
    if (bucket) found.push(bucket);
  }
  return found;
};

/** Walk the stack INWARD-OUT for the ground, ink and opacity this element actually paints with. */
const cascade = (
  stack: ElFrame[],
  chain: string,
  condition: string,
  context: ScanContext,
): Cascaded => {
  let ground: string | null = null;
  let ink: string | null = null;
  let alpha: number | undefined;
  let groundDepth = -1;
  let inkDepth = -1;
  let groundClass = "";
  let inkClass = "";
  for (let index = stack.length - 1; index >= 0; index--) {
    const el = stack[index]!;
    const depth = stack.length - 1 - index;
    const buckets = bucketsFor(el, chain, condition);
    if (!buckets.length) continue;
    if (alpha === undefined) {
      const faded = buckets.find((bucket) => bucket.alpha !== undefined);
      if (faded) alpha = faded.alpha;
    }
    if (ground === null) {
      const holder = buckets.find((bucket) => bucket.ground);
      if (holder?.ground) {
        ground = holder.ground;
        groundDepth = depth;
        groundClass = labelFor(holder, holder.ground, "ground", context);
      }
    }
    if (ink === null) {
      const holder = buckets.find((bucket) => bucket.ink);
      if (holder?.ink) {
        ink = holder.ink;
        inkDepth = depth;
        inkClass = labelFor(holder, holder.ink, "ink", context);
      }
    }
    if (ground !== null && ink !== null) break;
  }
  return {
    ground: ground ?? context.pageGround,
    groundClass: ground === null ? "page" : groundClass,
    groundDepth,
    ink: ink ?? context.bodyInk,
    inkClass: ink === null ? "body default" : inkClass,
    inkDepth,
    alpha,
  };
};

const labelFor = (
  bucket: ElBucket,
  expression: string,
  kind: "ground" | "ink",
  context: ScanContext,
): string => {
  const found = bucket.classes.find((klass) => expressionFor(klass, kind, context) === expression);
  return found ?? `${kind === "ground" ? "bg-" : "text-"}${expression.replace("--color-", "")}`;
};

const isRuntimeExpression = (expression: string, context: ScanContext): boolean => {
  if (expression.startsWith("--")) return context.isRuntime(expression);
  return [...expression.matchAll(/--[\w-]+/g)].some((m) => context.isRuntime(m[0] ?? ""));
};

/** States worth modelling for one element: its own, plus the states its ground element knows. */
const statesFor = (stack: ElFrame[]): Set<string> => {
  const states = new Set<string>([""]);
  const el = stack[stack.length - 1];
  const groundEl = stack.find((frame) =>
    [...frame.states.values()].some((bucket) => bucket.ground),
  );
  for (const frame of [el, groundEl]) {
    if (!frame) continue;
    for (const key of frame.states.keys()) {
      const chain = key.split("|")[0] ?? "";
      if (STATE_CHAINS.has(chain)) states.add(key);
    }
  }
  return states;
};

/** The pairs one element paints: its own text/glyph content against the cascaded ground + ink. */
const pairsOfElement = (file: string, stack: ElFrame[], context: ScanContext): CensusPair[] => {
  const el = stack[stack.length - 1];
  if (!el) return [];
  const painted = el.text.trim().length > 0;
  const glyph = !painted && (el.glyph || el.hasGlyphDescendant);
  if (!painted && !glyph) return [];
  const out: CensusPair[] = [];
  for (const state of statesFor(stack)) {
    const chain = state.split("|")[0] ?? "";
    const condition = state.includes("|") ? state.slice(state.indexOf("|") + 1) : "";
    const casc = cascade(stack, chain, condition, context);
    if (!isRuntimeExpression(casc.ground, context) && !isRuntimeExpression(casc.ink, context)) {
      continue;
    }
    // An opacity-0 element is not perceivable, and WCAG contrast applies to what a user can see;
    // measuring it produced 1.00:1 "failures" on hidden overlays (OrganizationSelector's opacity-0
    // badge) that would have been booked as real debt.
    if (casc.alpha === 0) continue;
    // Bounding rules (documented approximations):
    //  • neither side is bound here — the page's own default pair, which the token matrix gates,
    //  • ink bound on an ANCESTOR of the filled element — that element paints its own label,
    //  • page-default text deeper than one level inside an unrelated ground.
    if (casc.groundDepth < 0 && casc.inkDepth < 0) continue;
    if (casc.groundDepth >= 0 && casc.inkDepth > 0) continue;
    if (casc.groundDepth > 1 && casc.inkDepth < 0) continue;
    const via: InkVia =
      casc.inkDepth === 0 && casc.groundDepth > 0
        ? "descendant"
        : casc.inkDepth === 0
          ? "self"
          : "inherit";
    out.push({
      file,
      line: el.line,
      ground: casc.ground,
      groundClass: casc.groundClass,
      ink: casc.ink,
      inkClass: casc.inkClass,
      state: chain,
      alpha: casc.alpha,
      bar: glyph ? "non-text" : "text",
      via,
      sample: painted ? el.text.trim().slice(0, 44) : "icon",
    });
  }
  return out;
};

/** Template walk: tag stack + text runs → painted pairs, plus unresolvable class bindings. */
export const scanTemplate = (
  file: string,
  template: string,
  context: ScanContext,
  scriptClasses: Map<string, string[]>,
): { pairs: CensusPair[]; unresolved: Array<{ line: number; ids: string[] }> } => {
  // Comments are blanked at equal length, so every index (and therefore line number) survives.
  const clean = template.replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length));
  const stack: ElFrame[] = [];
  const pairs: CensusPair[] = [];
  const unresolved: Array<{ line: number; ids: string[] }> = [];
  const scanner = /<(\/?)([a-zA-Z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;
  const noteText = (from: number, to: number): void => {
    const slice = clean.slice(from, to).replace(/\s+/g, " ").trim();
    const parent = stack[stack.length - 1];
    if (!slice || !parent) return;
    parent.text = `${parent.text} ${slice}`.slice(0, 80);
  };
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(clean))) {
    noteText(cursor, match.index);
    cursor = scanner.lastIndex;
    const closing = match[1] === "/";
    const name = (match[2] ?? "").toLowerCase();
    const body = match[3] ?? "";
    const selfClosing = match[4] === "/";
    if (closing) {
      const index = stack.map((frame) => frame.name).lastIndexOf(name);
      if (index === -1) continue;
      for (let j = stack.length - 1; j >= index; j--) {
        const frame = stack[j];
        if (!frame) continue;
        for (const id of frame.unresolved) unresolved.push({ line: frame.line, ids: [id] });
        pairs.push(...pairsOfElement(file, stack.slice(0, j + 1), context));
      }
      if (index > 0 && (stack[index]?.glyph || stack[index]?.hasGlyphDescendant))
        stack[index - 1]!.hasGlyphDescendant = true;
      stack.length = index;
      continue;
    }
    const parent = stack[stack.length - 1];
    if (parent && isGlyphElement(name)) parent.glyph = true;
    const el: ElFrame = {
      name,
      line: lineAt(template, match.index),
      states: new Map(),
      unresolved: [],
      text: "",
      glyph: false,
      hasGlyphDescendant: false,
    };
    readClasses(el, body, context, scriptClasses);
    if (selfClosing || VOID_ELEMENTS.has(name) || isGlyphElement(name)) {
      el.glyph = el.glyph || isGlyphElement(name);
      for (const id of el.unresolved) unresolved.push({ line: el.line, ids: [id] });
      pairs.push(...pairsOfElement(file, [...stack, el], context));
      if (!selfClosing && !VOID_ELEMENTS.has(name)) stack.push(el);
      continue;
    }
    stack.push(el);
  }
  noteText(cursor, clean.length);
  for (let j = stack.length - 1; j >= 0; j--) {
    pairs.push(...pairsOfElement(file, stack.slice(0, j + 1), context));
  }
  return { pairs, unresolved };
};

/** `color` + `background` declared in one `<style>` rule is a painted pair. */
export const scanStyleRule = (file: string, style: string, context: ScanContext): CensusPair[] => {
  const out: CensusPair[] = [];
  const stripped = style.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
  for (const rule of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (rule[1] ?? "").trim().replace(/\s+/g, " ");
    const body = rule[2] ?? "";
    if (!selector || selector.startsWith("@")) continue;
    // Trailing !important is a cascade flag, not part of the colour.
    const color = /(?:^|;)\s*(?:text-)?color\s*:\s*([^;]+)/
      .exec(body)?.[1]
      ?.replace(/!important$/i, "")
      .trim();
    const ground = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/
      .exec(body)?.[1]
      ?.replace(/!important$/i, "")
      .trim();
    if (!color || !ground) continue;
    // One pair per accent stop: a gradient has no single ground pixel, and measuring a 8 % wash as
    // if it were the raw accent produced 1.00:1 "invisible text" rows that never render.
    const stops = gradientStops(ground);
    const grounds = stops.length ? stops : [ground];
    for (const groundValue of grounds) {
      if (!isRuntimeExpression(color, context) && !isRuntimeExpression(groundValue, context))
        continue;
      out.push({
        file,
        line: lineAt(style, rule.index ?? 0),
        ground: groundValue,
        groundClass: selector,
        ink: color,
        inkClass: selector,
        state: "",
        bar: "text",
        via: "style",
        sample: "scoped css",
      });
    }
  }
  return out;
};

/** Scan one SFC (or fixture source). */
export const scanSource = (input: ScanInput, context: ScanContext): ScanResult => {
  const style = [...input.source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1] ?? "")
    .join("\n");
  const { pairs } = scanTemplate(
    input.path,
    block(input.source, "template"),
    context,
    scriptClassMap(codeOf(input)),
  );
  return { pairs: [...pairs, ...scanStyleRule(input.path, style, context)], files: 1 };
};

/** Scan every source, de-duplicating identical pairs. */
export const scanSources = (inputs: ScanInput[], context: ScanContext): ScanResult => {
  const pairs: CensusPair[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    if (!input.path.endsWith(".vue")) continue;
    for (const pair of scanSource(input, context).pairs) {
      const key = `${pair.file}:${pair.line}:${pair.ground}:${pair.ink}:${pair.state}:${pair.bar}:${pair.alpha ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(pair);
    }
  }
  return { pairs, files: inputs.filter((input) => input.path.endsWith(".vue")).length };
};

/** The ledger key of a pair: the site, both sides, and the state it paints under. */
export const pairKey = (pair: CensusPair): string =>
  `${pair.file}:${pair.line} ${pair.ground} ${pair.ink}${pair.state ? ` @${pair.state}` : ""}${
    pair.alpha !== undefined ? ` opacity-${Math.round(pair.alpha * 100)}` : ""
  }`;

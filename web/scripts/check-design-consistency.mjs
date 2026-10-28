#!/usr/bin/env node
// CI guard: ZERO occurrences of any design-token bypass category from
// O2_TOKEN_MIGRATION_PLAN.md §3 (A–R). One violation fails the build.
//
//   node scripts/check-design-consistency.mjs            # fail on any violation
//   node scripts/check-design-consistency.mjs --strict   # + guard-self-check
//   node scripts/check-design-consistency.mjs --list     # show every violation
//
// Replaced a ratchet against design-debt-baseline.json, which allowed debt to
// persist as long as it never grew — every non-zero entry was headroom a future
// bypass could refill silently. Zero tolerance already covers the bypass
// categories in both modes, so `--strict` adds the one class the default scan is
// blind to by construction: THIS guard's own pins. A MOTION_LEDGER entry whose file
// was deleted is never re-counted (the scan only walks files that exist), and an
// allowlist entry whose path is gone silently widens the exemption for whatever
// lands at that suffix next. Both drift states fail under `--strict`; CI runs
// `lint:design:strict`. px is owned by eslint's local/no-hardcoded-px.
//
// If this failed: do not add an exemption. Reach the token through its
// registered utility (register one in tokens/semantic.css or component.css if
// none exists), or move the rule to base-elements.css / utilities.css. The
// allowlists below are only for cases a utility physically CANNOT express.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "..", "src");

// Declared homes for literal hex in .ts (§12.3). Excluded from the `tsHex`
// category because their CONSUMER cannot resolve a CSS custom property, so a
// `var(--color-*)` is impossible there — the hex is the only option:
//   • ECharts option objects / canvas 2D contexts (dashboard chart converters)
//   • user-editable chart-template source strings (customChartTemplates/*)
//   • Monaco editor theme + language token colours (vrlLanguage*)
//   • SVG/canvas trace-tree rendering
//   • the theme source-of-truth itself (theme.ts defines the runtime palette)
//   • JS that builds styled log/status HTML from a fixed status→colour map
// Entries ending in "/" match by directory prefix; others by exact suffix.
const TS_HEX_ALLOWLIST = [
  // categorical / series palettes + theme source
  "utils/dashboard/colorPalette.ts",
  "constants/themes.ts",
  // The theme source was SPLIT, not widened: these two modules hold the exact hex literals
  // utils/theme.ts and constants/themes.ts carried before (48 + 61 before, 48 + 61 after), and a
  // pure module cannot read a CSS custom property — that is why they are pure.
  "constants/themeRegistry.ts",
  "utils/traces/traceColors.ts",
  "utils/theme.ts",
  "utils/themePalette.ts",
  "utils/themeManager.ts",
  "utils/chartTheme.ts", // sanctioned seam: light-theme fallback constants for jsdom/pre-CSS
  // ECharts / canvas / geo chart builders — options are serialised, no var() resolves
  "utils/dashboard/",
  "composables/dashboard/",
  "components/dashboards/addPanel/customChartExamples/",
  "utils/traces/convertTraceData.ts",
  "utils/traces/treeVisualizationEngine.ts",
  "composables/useServiceGraphTree.ts",
  "composables/useMetricsExplorer.ts",
  // Monaco editor language/theme definitions (colour strings the editor lib reads)
  "utils/query/vrlLanguageDefinition.ts",
  // JS that builds styled HTML/canvas from a fixed status→colour map
  "utils/logs/convertLogData.ts",
  "utils/logs/statusParser.ts",
  "utils/logs/keyValueParser.ts",
  // LLM / metric / latency chart-panel series palettes (ECharts, no var())
  "plugins/traces/llmTrendPanel.utils.ts",
  "plugins/traces/config/",
  "composables/useLatencyInsightsDashboard.ts",
  "composables/useMetricsCorrelationDashboard.ts",
  "utils/metrics/metricPalette.ts",
  "utils/traces/treeTooltipHelpers.ts",
  "utils/alerts/alertChartData.ts",
  "composables/useAlertForm.ts", // ECharts markLine colour
  // Ingestion vendor brand accents (D12-style fixed brand colour; `tone` is a
  // reserved-future field that is never read — see setup-card content types)
  "components/ingestion/setupCard/content/",
  "components/ingestion/ai/content/",
];

// The sanctioned dark-mode seams (§3.R.1) — the only files allowed to read theme /
// declare an isDark flag, so they are exempt from the darkMechanism count. useTheme +
// chartTheme are the JS *consumption* seams; themeManager is the theme *applier* — it
// resolves store.state.theme into the mode to apply (upstream of every token, so it
// cannot consume a token without circularity).
//   • ThemeSwitcher.vue is the toggle control — can't be written without naming
//     "dark" (a `darkMode` flag or `theme === 'dark'` compare), so it's the one
//     canonical home for that decision, not the fragmentation the category targets.
//   • convertLogData.ts reads --color-theme-accent to paint an ECharts canvas bar.
//     applyThemeColors (utils/theme.ts) sets that token on document.body in dark and
//     document.documentElement in light, so the consumer must know which element
//     carries it — a var() can't resolve on a <canvas>.
const DARK_SEAM_ALLOWLIST = [
  "composables/useTheme.ts",
  "utils/chartTheme.ts",
  "utils/themeManager.ts",
  "components/ThemeSwitcher.vue",
  "utils/logs/convertLogData.ts",
];

// Files allowed to keep an UNSCOPED <style> block. Unscoped leaks globally so it's
// debt by default — but a few blocks must reach past the component's own subtree,
// which `scoped` physically can't:
//   • ViewDashboard.vue: its @media print / fullscreen rules target external ancestors
//     (.o2-app-root, main, .o2-content-scroll, .scroll) outside the SFC — unscoped on
//     purpose (carries a keep(complex-state) note).
const UNSCOPED_STYLE_ALLOWLIST = ["views/Dashboards/ViewDashboard.vue"];

// Files allowed to carry a literal font stack. Email markup renders inside a mail
// client, which can load neither our webfont nor our custom properties, so a
// system stack is the correct choice there (FONT_AUDIT.md §5.2).
const FONT_ALLOWLIST = [
  "utils/prebuilt-templates/email.ts",
  "utils/fonts.ts", // defines the fallback stacks the tokens mirror
];

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PROPS = "text|bg|border|ring|fill|stroke|divide|outline|decoration|placeholder|from|via|to";

// Categories evaluated over the WHOLE file text.
const WHOLE = {
  rawPalette: new RegExp(
    `\\b(?:dark:|hover:|focus:|group-hover:|active:)*(?:${PROPS})-(?:${PALETTE})-\\d{2,3}\\b`,
    "g",
  ),
  // PROJECT raw-ramp utilities (Part B, Ring 3): feature code reaching for our own
  // primitives (grey-*/primary-*) instead of semantic tokens. The ramps stay
  // REGISTERED while these consumers exist (un-registering would break them, and
  // migrating is not value-preserving — e.g. accent flips 600→400 in dark), so
  // this ratchet freezes the count: it can only shrink toward the Part-B ideal.
  rawProjectRamp: new RegExp(
    `\\b(?:dark:|hover:|focus:|group-hover:|active:|focus-visible:)*(?:${PROPS}|ring)-(?:grey|primary)-\\d{2,3}\\b`,
    "g",
  ),
  hexClass: /-\[#[0-9a-fA-F]{3,8}\]/g,
  inlineHexStyle: /style="[^"]*#[0-9a-fA-F]{3,8}/g,
  inlineHexBind: /:style="[^"]*#[0-9a-fA-F]{3,8}/g,
  themeTernary: /theme\s*===?\s*['"]dark['"]/g,
  // A bare `rounded` utility is bounded by class-list separators on BOTH sides.
  // Requiring a trailing separator (space/quote/backtick/EOL) skips prose in
  // comments ("short, rounded, inset") and JS object keys (`rounded: "..."`).
  // Retired text-colour aliases (Tier 1): text-text-primary → text-text-heading,
  // text-text-caption → text-text-secondary. Baseline 0 after the codemod, so any
  // reintroduction of the class utility is a regression.
  retiredTextAlias: /\btext-text-(?:primary|caption)\b/g,
  bareRounded: /(?:^|[\s"'`])rounded(?=[\s"'`]|$)/gm,
  // Retired radius tiers: the app exposes exactly two corner radii —
  // rounded-default (controls) and rounded-surface (large surfaces) — plus
  // rounded-full. The old sm/md/lg/xl scale (and its var(--radius-*) refs) was a
  // set of same-value aliases that lied about being distinct; it was repointed
  // (small→default, large→surface) and the tokens deleted. Baseline 0 after the
  // codemod, so any reintroduction falls back to Tailwind's stock scale and is a
  // regression. Matches the class utility (incl. per-corner variants) and the var.
  retiredRadiusAlias:
    /\brounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?-(?:sm|md|lg|xl)\b|var\(--radius-(?:sm|md|lg|xl)\)/g,
  // Arbitrary radius VALUE — but not a CSS keyword (`rounded-[inherit]` etc.),
  // which is not a hardcoded dimension and has no scale-token equivalent.
  arbRadius: /rounded(?:-[a-z]+)*-\[(?!(?:inherit|initial|unset|revert|revert-layer)\])[^\]]+\]/g,
  unscopedStyle: /<style(?![^>]*\bscoped\b)[^>]*>/g,
  twPrefix: /\btw:/g,
  helperUtil: /\btext-weight-[a-z]+\b/g,
  arbZ: /\bz-\[[0-9]+\]/g,
  // Literal font stacks. The app ships exactly two families, reached only via
  // var(--font-sans) / var(--font-mono) (FONT_AUDIT.md). Anything else resolves
  // to whatever the visitor's OS happens to have, which is how the app came to
  // render in ~14 different stacks. Covers CSS declarations, Tailwind arbitrary
  // values (`[font-family:…]`), and `font-[…]` when the value looks like a
  // family rather than a weight (`font-[600]` stays legal).
  literalFontFamily: new RegExp(
    [
      // font-family: <anything that isn't our token / inherit>.
      // The lookahead absorbs the whitespace itself — if `\s*` were consumed
      // first it could backtrack to zero width and let ` var(--font-mono)` slip
      // through as a "literal" starting with a space.
      String.raw`font-family:(?!\s*(?:var\(--font-(?:sans|mono)\)|inherit))\s*[^;"'\`\n}]+`,
      // [font-family:<literal>]
      String.raw`\[font-family:(?!(?:var\(--font-(?:sans|mono)\)|inherit)\])[^\]]+\]`,
      // font-[<literal family>] — weights like font-[600] are not families
      String.raw`\bfont-\[(?!\d+\]|var\(--font-(?:sans|mono)\)\]|inherit\])[^\]]*(?:mono|serif|Menlo|Monaco|Consolas|Courier|Geist|Inconsolata|Fira|Ubuntu|Segoe|Roboto|apple-system)[^\]]*\]`,
    ].join("|"),
    "g",
  ),
  // Dark-mode mechanism fragmentation (§3.R.2 mechanisms 1,2,5,6,7)
  darkMechanism:
    /theme\s*[=!]==?\s*['"]dark['"]|const\s+(?:isDark|isDarkMode|darkMode)\s*=|\.body--(?:dark|light)|classList\.contains\(['"]body--|\.(?:light|dark)-mode\b/g,
};

// Categories evaluated ONLY inside <style>…</style> blocks (scoped AND unscoped —
// styleBlocks() collects every block regardless of the `scoped` attribute).
const STYLE_ONLY = {
  styleBlockHex: /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g,
  // NOTE: rawVarInComponent (F.6) is NOT a flat regex — it is context-aware and
  // computed by countRawVarInComponent() below. See that function for why.
};

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (extname(entry) === ".vue" || extname(entry) === ".ts") files.push(full);
  }
  return files;
}

function styleBlocks(text) {
  const out = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out.join("\n");
}

// ── rawVarInComponent (F.6), CONTEXT-AWARE ─────────────────────────────────
// A raw var(--color-*) in a <style> block is debt ONLY where a utility could
// replace it. Skipped where one physically cannot: inside :deep(), inside
// color-mix()/gradient, a pseudo-element rule, inside @keyframes, or a custom-
// property definition. Judged PER-OCCURRENCE — keep() is mandatory on every
// surviving block, so a block-level exemption would zero the category.

// Blank comment BODIES, preserving byte offsets so every index stays valid.
// Must run BEFORE the scan: a comment sits between the previous `}` and the next
// `{`, so its punctuation is read as selector structure. A keep() comment naming
// ::after / :deep( / @keyframes exempted the rule after it, and a stray `;` or
// `{` in prose reset the stack mid-sentence. Ten occurrences across seven files
// were invisible before this.
function blankComments(css) {
  let out = "";
  for (let i = 0; i < css.length;) {
    if (css[i] === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
    } else if (css[i] === "/" && css[i + 1] === "/" && css[i - 1] !== ":") {
      // SCSS line comment (`:` guard keeps `https://…` intact)
      const end = css.indexOf("\n", i);
      const stop = end === -1 ? css.length : end;
      out += " ".repeat(stop - i);
      i = stop;
    } else {
      out += css[i];
      i++;
    }
  }
  return out;
}

// selector-nesting stack (comment-free — see blankComments) at `target`
function selectorStackAt(css, target) {
  const stack = [];
  let pending = 0;
  for (let i = 0; i < target && i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      stack.push(css.slice(pending, i));
      pending = i + 1;
    } else if (ch === "}") {
      stack.pop();
      pending = i + 1;
    } else if (ch === ";") pending = i + 1;
  }
  return stack.join(" ");
}

// is the occurrence inside an unclosed color-mix()/…gradient() in its declaration?
function insideColourFn(css, idx) {
  let s = idx;
  while (s > 0 && !";{}".includes(css[s - 1])) s--;
  const chunk = css.slice(s, idx);
  const k = chunk.search(/(?:color-mix|[a-z-]*gradient)\(/);
  if (k === -1) return false;
  let bal = 0;
  for (let i = chunk.indexOf("(", k); i < chunk.length; i++) {
    if (chunk[i] === "(") bal++;
    else if (chunk[i] === ")") bal--;
  }
  return bal > 0;
}

// ── rawVarInTemplate ───────────────────────────────────────────────────────
// rawVarInComponent's twin on the template side. Only three shapes count,
// because only these are PROVABLY replaceable:
//   bg-[var(--color-x)]                          -> bg-x
//   bg-[color-mix(… var(--color-x) 12%, transparent)]  -> bg-x/12  (same bytes)
//   bg-[color-mix(… var(--color-x) 12%, var(--color-y))] -> a derived token
// Everything else is exempt — a gradient/mask stop or drop-shadow colour has no
// utility form. Comments are blanked first (a doc comment showing the bad
// pattern is not a violation — KpiCard.vue had one).
// The `(?:\s*,[^)\]]*)?` tails catch the FALLBACK form `bg-[var(--color-x,#fff)]`:
// the token is defined so the fallback never fires, it only hides the read.
// Shipped without that and two occurrences slipped past.
const BARE_READ =
  /[a-zA-Z][a-zA-Z0-9-]*-(?:\[\s*(?:[a-z]+:)?\s*var\(\s*--color-[a-z0-9-]+\s*(?:,[^)\]]*)?\)\s*\]|\(\s*(?:[a-z]+:)?\s*--color-[a-z0-9-]+\s*(?:,[^)\]]*)?\))/g;
const ALPHA_MIX =
  /[a-zA-Z][a-zA-Z0-9-]*-\[color-mix\(in[_ ]srgb,[_ ]?var\(\s*--color-[a-z0-9-]+\s*\)[_ ]+[0-9.]+%[_ ]?,[_ ]?transparent\)\]/g;
const BLEND_MIX =
  /[a-zA-Z][a-zA-Z0-9-]*-\[color-mix\(in[_ ]srgb,[_ ]?var\(\s*--color-[a-z0-9-]+\s*\)[_ ]+[0-9.]+%[_ ]?,[_ ]?var\(\s*--color-[a-z0-9-]+\s*\)\)\]/g;

function countRawVarInTemplate(text) {
  // template + script only; <style> is rawVarInComponent's job
  const cut = text.indexOf("<style");
  const head = blankComments(cut === -1 ? text : text.slice(0, cut)).replace(
    /<!--[\s\S]*?-->/g,
    (m) => m.replace(/[^\n]/g, " "),
  );
  return (
    (head.match(BARE_READ) || []).length +
    (head.match(ALPHA_MIX) || []).length +
    (head.match(BLEND_MIX) || []).length
  );
}

// ── arbShadow ──────────────────────────────────────────────────────────────
// A hand-written shadow in any of the three syntaxes it hides in. The app ships
// one scale (--shadow-xs/sm/md/lg + the sticky/rail/glow/scroll roles) and
// colour is a separate axis, so spelling out offsets/blur is never needed. A
// ring is ring-*. Mirrors arbRadius.
// Template-only scanning was not enough: a pass that fixed the template left 40
// literals in <style> blocks and JS boxShadow: objects, reporting zero throughout.
const ARB_SHADOW =
  /\b(?:inset-)?(?:drop-)?shadow-\[(?!(?:inherit|initial|unset|none)\])[^\]]+\]|\[box-shadow:[^\]]+\]/g;
// Accepted forms: var(--shadow-*), none/inherit/initial/unset, and an
// interpolated ${…} (already a token by then). The (?<![-\w]) lookbehind stops
// a vendor-prefixed -webkit-box-shadow being counted alongside its twin.
const CSS_SHADOW =
  /(?<![-\w])box-shadow:\s*(?!\s*(?:var\(|none|inherit|initial|unset|\$\{))[^;]+;/g;
// Three JS spellings occur here: `boxShadow:` literal, `x.boxShadow =`, and
// `"box-shadow":` as a quoted key. The first version had only the literal form,
// and the other two sat in OTableBodyCell/useStickyColumns reporting clean.
const JS_SHADOW =
  /(?:boxShadow\s*[:=]|["']box-shadow["']\s*:)\s*(["'`])(?!\s*(?:var\(|none|\$\{))[^"'`]+\1/g;

// Chart libraries and the email template serialise their own style strings —
// ECharts options and mail markup cannot resolve a CSS custom property, so a
// literal is the only option there. Same rationale as TS_HEX_ALLOWLIST.
const SHADOW_LITERAL_ALLOWLIST = [
  "utils/prebuilt-templates/email.ts",
  "utils/dashboard/",
  "components/dashboards/PanelSchemaRenderer.vue",
  "plugins/traces/ServiceGraph.vue",
];

function countArbShadow(text, rel = "") {
  if (SHADOW_LITERAL_ALLOWLIST.some((p) => (p.endsWith("/") ? rel.includes(p) : rel.endsWith(p)))) {
    return 0;
  }
  const blanked = blankComments(text).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  return (
    (blanked.match(ARB_SHADOW) || []).length +
    (blanked.match(CSS_SHADOW) || []).length +
    (blanked.match(JS_SHADOW) || []).length
  );
}

function countRawVarInComponent(rawStyleText) {
  const styleText = blankComments(rawStyleText);
  let n = 0;
  const reVar = /var\(\s*--color-[a-z0-9-]+/g;
  let m;
  while ((m = reVar.exec(styleText)) !== null) {
    const idx = m.index;
    // CSS custom-property definition: the declaration key starts with `--`
    let s = idx;
    while (s > 0 && !";{}".includes(styleText[s - 1])) s--;
    if (/^\s*--[\w-]+\s*:/.test(styleText.slice(s, idx))) continue;
    if (insideColourFn(styleText, idx)) continue;
    const sel = selectorStackAt(styleText, idx);
    if (/:deep\(/.test(sel)) continue; // child component internals
    if (/::[a-z-]/.test(sel)) continue; // pseudo-element
    if (/@keyframes/.test(sel)) continue; // keyframe step
    n++;
  }
  return n;
}

// Every surviving <style> block must justify its own existence: it opens with
//   /* keep(<tag>): <one line why this cannot be Tailwind> */
// Both `keep(<tag>)` and `keep: <tag>` are accepted — the punctuation is not the
// point, the stated reason is. Sanctioned tags: O2_STYLE_MIGRATION_PLAN.md §3.1
// step 5. `lib-override:<lib>` takes a free-form library suffix, matched by prefix.
const KEEP_TAG_NAMES =
  "lib-override(?::[\\w.-]+)?|generated-content|keyframes|print|scrollbar|complex-state|brand|third-party";
const KEEP_TAGS = new RegExp(
  `keep\\s*(?:\\(\\s*(?:${KEEP_TAG_NAMES})\\s*\\)|:\\s*(?:${KEEP_TAG_NAMES}))`,
);

// Counts style blocks that carry no keep-comment. A block with no justification
// is debt by definition — either it should have been migrated to utilities, or
// its author owes one line saying why it could not be.
function countUnjustifiedBlocks(text) {
  let n = 0;
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!KEEP_TAGS.test(m[1])) n++;
  }
  return n;
}

// ── motionNoCompanion ───────────────────────────────────────────────
// Hover motion needs an escape hatch: a class string that translates / rotates /
// scales on an interaction variant — or transitions those properties — must carry
// a `motion-reduce:` companion in the SAME string (or make the motion itself
// `motion-safe:`). The convention the dark-night wave follows: Header.vue:112,
// ServiceAccountsList.vue:481, ChangeRow.vue:31, OToggleGroup.vue:187.
//
// Whole-tree zero tolerance is not available: the legacy tree predates the
// convention (measured when the rule landed), and migrating it is not a token
// fix. So the rule ships as an EXACT per-file ledger: MOTION_LEDGER pins every
// file's current count, unlisted files must stay at zero, and a ledger entry may
// only shrink — a new unaccompanied hover-motion utility anywhere raises a count
// and fails, and so does improving without regenerating (`--dump-motion` prints
// the new map). Precedent for a pinned ledger: check-token-purity.mjs's baseline
// and contrast.spec.ts's ratchets. Drain entries by fixing sites, never by
// adding a file or raising a number.
//
// .spec. files are skipped like tsHex does: a spec quoting a class fragment is
// a fixture/assertion, not shipped UI.
// Snapshot when the rule landed: 302 unaccompanied utilities in 88 files,
// all pre-convention legacy. Shrink it; never grow it, never add a file.
const MOTION_LEDGER = {
  "components/CodeQueryEditor.vue": 1,
  "components/CustomDateTimePicker.vue": 1,
  "components/DateTime.vue": 1,
  "components/EnterpriseOfferFeatureGrid.vue": 21,
  "components/EnterpriseUpgradeDialog.vue": 9,
  "components/Header.vue": 2,
  "components/O2AIChat.vue": 3,
  "components/O2AIConfirmDialog.vue": 5,
  "components/OrganizationSelector.vue": 1,
  "components/QueryEditor.vue": 6,
  "components/RichTextInput.vue": 1,
  "components/about/FeatureComparisonTable.vue": 2,
  "components/ai-assistant/chat/O2AIChatInput.vue": 6,
  "components/ai-assistant/chat/O2AIChatMessage.vue": 3,
  "components/ai-assistant/chat/O2AIChatToolCallBlock.vue": 1,
  "components/ai-assistant/welcome/CapabilityCards.vue": 5,
  "components/ai-assistant/welcome/PromptSuggestions.vue": 4,
  "components/alerts/AlertSummary.vue": 4,
  "components/alerts/DedupSummaryCards.vue": 4,
  "components/alerts/IncidentDetailDrawer.vue": 8,
  "components/alerts/IncidentRCAAnalysis.vue": 1,
  "components/alerts/IncidentServiceGraph.vue": 4,
  "components/alerts/PrebuiltDestinationSelector.vue": 4,
  "components/alerts/QueryEditorDialog.vue": 2,
  "components/alerts/SemanticGroupItem.vue": 1,
  "components/autoobserve/v2/ProblemEntry.vue": 2,
  "components/common/O2AIContextAddBtn.vue": 2,
  "components/common/empty-states/QuickStartCard.vue": 3,
  "components/dashboards/ColorSwatchPicker.vue": 6,
  "components/dashboards/addPanel/DashboardQueryEditor.vue": 1,
  "components/dashboards/addPanel/customChartExamples/CustomChartTypeSelector.vue": 3,
  "components/dashboards/viewPanel/ViewPanel.vue": 3,
  "components/flow/NodePalette.vue": 6,
  "components/functions/FullViewContainer.vue": 1,
  "components/functions/FunctionsToolbar.vue": 1,
  "components/iam/roles/RoleSummary.vue": 1,
  "components/ingestion/recommended/AWSIntegrationTile.vue": 2,
  "components/pipeline/NodeForm/CreateDestinationForm.vue": 1,
  "components/pipeline/NodeForm/Query.vue": 1,
  "components/pipeline/PipelineEditor.vue": 2,
  "components/pipeline/PipelinesList.vue": 1,
  "components/pipelines/CreateBackfillJobDialog.vue": 3,
  "components/rum/errorTracking/view/PrettyStackTrace.vue": 3,
  "components/settings/AddRegexPattern.vue": 2,
  "components/settings/AnnouncementColorSwatches.vue": 2,
  "components/settings/General.vue": 7,
  "components/settings/License.vue": 2,
  "components/settings/OrgStorageEditor.vue": 2,
  "components/settings/OrgStorageSettings.vue": 2,
  "components/settings/ServiceIdentitySetup.vue": 4,
  "components/workflows/WorkflowNodeDrawer.vue": 2,
  "enterprise/components/billings/BillingGroup.vue": 6,
  "enterprise/components/onlineEvals/TraceScoreChips.vue": 4,
  "enterprise/components/onlineEvals/forms/EvalJobDetail.vue": 4,
  "lib/core/Collapsible/OCollapsible.vue": 3,
  "lib/core/EmptyState/EmptyStateActionCard.vue": 4,
  "lib/core/EmptyState/EmptyStateIngestionCard.vue": 2,
  "lib/core/Table/sub-components/OTableExpandButton.vue": 1,
  "lib/core/Table/sub-components/OTableHeader.vue": 4,
  "lib/core/ToggleGroup/OToggleGroupItem.vue": 1,
  "lib/data/StatStrip/OStatCard.vue": 1,
  "lib/data/Tree/OTreeNode.vue": 1,
  "lib/feedback/Toast/OToast.vue": 2,
  "lib/forms/DateTimeRange/ODateTimeRange.vue": 3,
  "lib/forms/Select/OSelect.vue": 6,
  "lib/forms/Switch/OSwitch.vue": 1,
  "lib/forms/TagInput/OTagInput.vue": 1,
  "lib/forms/Time/OTime.vue": 6,
  "lib/navigation/Tabs/OTabs.vue": 1,
  "plugins/logs/SearchJobInspector.vue": 1,
  "plugins/pipelines/CustomNode.vue": 3,
  "plugins/traces/SearchResult.vue": 2,
  "plugins/traces/SpanBlock.vue": 1,
  "plugins/traces/ThreadView.vue": 2,
  "plugins/traces/TraceDAG.vue": 2,
  "plugins/traces/TraceDetails.vue": 1,
  "plugins/traces/TraceDetailsSidebar.vue": 22,
  "plugins/workflows/WorkflowNode.vue": 10,
  "views/About.vue": 6,
  "views/AwsMarketplaceSetup.vue": 2,
  "views/AzureMarketplaceSetup.vue": 2,
  "views/HomeView.vue": 1,
  "views/Infrastructure/curated/CuratedPageView.vue": 2,
  "views/OverviewTab.vue": 8,
  "views/RUM/SourceMapDropzone.vue": 1,
  "views/UsageTab.vue": 16,
  "views/synthetics/MonitorStatusTimeline.vue": 3,
  "views/synthetics/RunDetail.vue": 1,
};

// A transform utility is motion only when a variant moves it: hover, focus,
// active, open/checked, data- or aria-state. A static `-translate-x-1/2` (or
// `before:-translate-…`) is centring, and reduced-motion would not affect it.
const MOTION_INTERACTION = /(?:hover|focus|active|open|checked|data-\[|aria-\[)/;
const MOTION_UTIL = /^-?(?:translate|rotate|scale|skew)-/;
// Bare `transition` (its DEFAULT property list includes transform) counts only
// when the string also carries a duration-* utility — prose that merely says
// the word "transition" inside a string must not match.
const MOTION_DURATION = /(?:^|\s)(?:[\w[\]()./=%-]+:)*duration-/;
// The convention has two idioms: a `motion-reduce:` companion in the string,
// or gating the motion itself behind `motion-safe:` (CoverageHexMap.vue:50).
// Either satisfies the rule; the companion must live in the SAME class string.
const MOTION_COMPANION = /(?:^|\s)(?:[\w[\]()./=%-]+:)*motion-(?:reduce|safe):/;

// Split a utility token into its variant chain and its utility. Splitting on
// the LAST colon at bracket depth zero — a regex over `[\w[…]]+:` swallows the
// arbitrary-value form `[transition:transform_0.6s_ease]` as if its colon were
// a variant boundary, and `group-[:hover:not(:disabled)]:translate-x-0.5`
// proves bracket contents can hold colons too.
function motionUtilOf(token) {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === "[") depth++;
    else if (c === "]") depth = Math.max(0, depth - 1);
    else if (c === ":" && depth === 0) cut = i;
  }
  const chain = cut === -1 ? "" : token.slice(0, cut + 1);
  return [chain, (cut === -1 ? token : token.slice(cut + 1)).replace(/^!/, "")];
}
function transformMotion(token) {
  const [chain, util] = motionUtilOf(token);
  if (!chain || !MOTION_INTERACTION.test(chain)) return false;
  return MOTION_UTIL.test(util) || /^\[transform:/.test(util);
}
function transitionMotion(token, str) {
  const util = motionUtilOf(token)[1];
  return (
    /^transition-(?:transform|all)\b/.test(util) ||
    /^transition-\[[^\]]*(?:transform|translate|rotate|scale)[^\]]*\]/.test(util) ||
    /^\[transition:[^\]]*(?:transform|translate|rotate|scale)[^\]]*\]/.test(util) ||
    (util === "transition" && MOTION_DURATION.test(str))
  );
}

// Returns ["rel:line token", ...] for unaccompanied motion utilities.
function motionViolations(text, rel) {
  const blanked = blankComments(text).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  const out = [];
  // Three independent passes so a quote nested inside a template literal is
  // still seen as its own class string (OTableHeader builds classes in arrays).
  for (const q of ['"', "'", "`"]) {
    const re = new RegExp(`${q}([\\s\\S]*?)${q}`, "g");
    let m;
    while ((m = re.exec(blanked)) !== null) {
      const str = m[1]; // the string CONTENT, enclosing quotes stripped — the
      // first and last tokens would otherwise wear a quote and slip past both the
      // trigger regexes and the artifact filter below (measured at landing).
      if (!MOTION_COMPANION.test(str)) {
        for (const token of str.split(/\s+/)) {
          // A token carrying a quote is a boundary artifact of THIS pass (a
          // double-quoted attribute whose value is a multi-line :class array —
          // the inner single-quoted strings are their own class strings and are
          // caught by their own pass). Counting it here would double-report.
          if (/["'`]/.test(token)) continue;
          if (!transformMotion(token) && !transitionMotion(token, str)) continue;
          const at = m.index + 1 + str.indexOf(token);
          const line = blanked.slice(0, at).split("\n").length;
          out.push(`${rel}:${line} ${token}`);
        }
      }
    }
  }
  return out;
}

function countFile(file, rel) {
  const text = readFileSync(file, "utf8");
  const counts = {};
  const isVue = rel.endsWith(".vue");
  const isSpec = rel.includes(".spec.");

  if (isVue) {
    // Per-category sanctioned exceptions (like the .ts allowlists): a file may carry
    // ONE specific bypass the category can't express, while every OTHER category
    // still applies in full.
    //   • darkMechanism → DARK_SEAM_ALLOWLIST (ThemeSwitcher, the toggle control).
    //   • unscopedStyle → UNSCOPED_STYLE_ALLOWLIST (selectors that must reach external
    //     ancestors — print / fullscreen — can't be scoped).
    const skip = (k) =>
      (k === "darkMechanism" && DARK_SEAM_ALLOWLIST.some((p) => rel.endsWith(p))) ||
      (k === "unscopedStyle" && UNSCOPED_STYLE_ALLOWLIST.some((p) => rel.endsWith(p)));
    // A component `shape="rounded"` prop (BadgeShape = "pill" | "rounded" |
    // "square") is a first-class API value, NOT a bare Tailwind `rounded` radius
    // class — strip these prop bindings before scanning so bareRounded doesn't
    // false-match them. Real `class="… rounded …"` violations are untouched.
    const scan = text.replace(/:?\bshape=(["'])[^"']*\1/g, "");
    for (const [k, re] of Object.entries(WHOLE)) {
      if (skip(k)) continue;
      const n = (scan.match(re) || []).length;
      if (n) counts[k] = n;
    }
    const sb = styleBlocks(text);
    for (const [k, re] of Object.entries(STYLE_ONLY)) {
      const n = (sb.match(re) || []).length;
      if (n) counts[k] = n;
    }
    const rawVar = countRawVarInComponent(sb);
    if (rawVar) counts.rawVarInComponent = rawVar;
    const rawTpl = countRawVarInTemplate(text);
    if (rawTpl) counts.rawVarInTemplate = rawTpl;
    const arbShadow = countArbShadow(text, rel);
    if (arbShadow) counts.arbShadow = arbShadow;
    const unjustified = countUnjustifiedBlocks(text);
    if (unjustified) counts.styleKeepComment = unjustified;
  } else {
    // .ts — only tsHex (non-spec, non-allowlisted) and darkMechanism apply.
    // Allowlist entry ending in "/" matches by directory prefix, else by suffix.
    const allowed = TS_HEX_ALLOWLIST.some((p) =>
      p.endsWith("/") ? rel.includes(p) : rel.endsWith(p),
    );
    if (!isSpec && !allowed) {
      // Strip comments first so a hex mentioned in prose ("e.g. #FF0000")
      // doesn't count as a real colour literal.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      const n = (code.match(/['"]#[0-9a-fA-F]{3,8}['"]/g) || []).length;
      if (n) counts.tsHex = n;
    }
    if (!isSpec) {
      const n = countArbShadow(text, rel);
      if (n) counts.arbShadow = n;
    }
    if (!isSpec && !DARK_SEAM_ALLOWLIST.some((p) => rel.endsWith(p))) {
      const n = (text.match(WHOLE.darkMechanism) || []).length;
      if (n) counts.darkMechanism = n;
    }
    // Literal font stacks also leak in via .ts that builds HTML/CSS strings
    // (trace tooltips, chart tooltips) — that surface was ~20 of the original hits.
    if (!isSpec && !FONT_ALLOWLIST.some((p) => rel.endsWith(p))) {
      const n = (text.match(WHOLE.literalFontFamily) || []).length;
      if (n) counts.literalFontFamily = n;
    }
  }
  // motionNoCompanion applies to .vue AND .ts (class strings live in both);
  // specs are fixtures, not shipped UI.
  if (!isSpec) {
    const motion = motionViolations(text, rel);
    const ledger = MOTION_LEDGER[rel] ?? 0;
    if (motion.length > ledger) {
      counts.motionNoCompanion = motion.length;
      motionDetails.set(rel, motion);
    } else if (motion.length < ledger) {
      // Exact pin, like contrast.spec.ts's MIN_MATCHED: an improvement must
      // shrink the ledger in the same commit (`--dump-motion`), so the map
      // stays the truth and a re-bypass cannot refill silently.
      counts.motionLedgerStale = ledger;
      motionDetails.set(rel, motion);
    }
  }
  return counts;
}

// file -> violations, for the failure message (file + line, per the rule's brief)
const motionDetails = new Map();

// ── --strict: the guard's OWN pins ──────────────────────────────────────────
// The categories above can only be evaluated over files the walk finds, so two
// drift classes are invisible to them by construction: a MOTION_LEDGER entry whose
// file has been deleted is never re-counted (its allowance outlives the file, and
// whatever lands on that path next is exempt until someone notices), and an
// allowlist entry whose path is gone stops exempting anything while still reading
// as a live exemption. Both are `--strict` failures, so the ledger and the
// allowlists stay the truth instead of an archive of what used to need excusing.
const GUARD_PINS = [
  ["MOTION_LEDGER", Object.keys(MOTION_LEDGER)],
  ["TS_HEX_ALLOWLIST", TS_HEX_ALLOWLIST],
  ["DARK_SEAM_ALLOWLIST", DARK_SEAM_ALLOWLIST],
  ["UNSCOPED_STYLE_ALLOWLIST", UNSCOPED_STYLE_ALLOWLIST],
  ["FONT_ALLOWLIST", FONT_ALLOWLIST],
  ["SHADOW_LITERAL_ALLOWLIST", SHADOW_LITERAL_ALLOWLIST],
];

function stalePins() {
  const problems = [];
  for (const [name, entries] of GUARD_PINS) {
    for (const entry of entries) {
      if (name === "MOTION_LEDGER" && !/\.(vue|ts)$/.test(entry)) {
        problems.push(name + " names a file this scan never reads: " + entry);
        continue;
      }
      if (!existsSync(join(SRC_DIR, entry.replace(/\/$/, "")))) {
        problems.push(name + " points at a path that no longer exists: " + entry);
      }
    }
  }
  return problems;
}

const files = walk(SRC_DIR);

// Dev aid: print the exact per-file motion ledger to paste over MOTION_LEDGER.
// Drain-only — re-dumping to accommodate a NEW violation is how the ledger
// grows, and review is supposed to catch that.
if (process.argv.includes("--dump-motion")) {
  const rows = [];
  let total = 0;
  for (const f of files) {
    const rel = relative(SRC_DIR, f).split("\\").join("/");
    if (rel.includes(".spec.")) continue;
    const n = motionViolations(readFileSync(f, "utf8"), rel).length;
    if (n) {
      total += n;
      rows.push(`  ${JSON.stringify(rel)}: ${n},`);
    }
  }
  console.log(rows.join("\n"));
  console.log(`// ${rows.length} file(s), ${total} unaccompanied motion utility(ies)`);
  process.exit(0);
}

const current = {};
for (const f of files) {
  const rel = relative(SRC_DIR, f).split("\\").join("/");
  const c = countFile(f, rel);
  if (Object.keys(c).length) current[rel] = c;
}

// Flatten to (file, category, count). Zero tolerance — any entry fails the build.
const violations = [];
for (const [rel, c] of Object.entries(current))
  for (const [k, n] of Object.entries(c)) violations.push({ rel, k, n });
violations.sort((a, b) => b.n - a.n || a.rel.localeCompare(b.rel));
const total = violations.reduce((sum, v) => sum + v.n, 0);
const fileCount = Object.keys(current).length;

const STRICT = process.argv.includes("--strict");
const pinProblems = STRICT ? stalePins() : [];

const detail = ({ rel, k, n }) => {
  if (k === "motionNoCompanion")
    return [
      `      ${rel} carries ${n} unaccompanied motion utilit(ies), ledger: ${MOTION_LEDGER[rel] ?? 0}`,
      ...[...(motionDetails.get(rel) ?? [])].slice(0, 8).map((d) => `      ${d}`),
    ];
  if (k === "motionLedgerStale")
    return [
      `      ${rel} is cleaner than its ledger entry (${n} pinned) — regenerate the line` +
        " with `node scripts/check-design-consistency.mjs --dump-motion`.",
    ];
  return [];
};

if (process.argv.includes("--list")) {
  for (const v of violations) {
    console.log(`  ${v.rel}  [${v.k}]  ${v.n}`);
    for (const d of detail(v)) console.log(d);
  }
  for (const p of pinProblems) console.log("  [guard-pin]  " + p);
  console.log(`\n${total} violation(s) across ${fileCount} file(s).`);
  process.exit(0);
}

if (violations.length) {
  console.error(
    `\ncheck-design-consistency: ${total} design-token bypass(es) in ${fileCount} file(s):\n`,
  );
  for (const v of violations.slice(0, 60)) {
    console.error(`  ${v.rel}  [${v.k}]  ${v.n}`);
    for (const d of detail(v)) console.error(d);
  }
  if (violations.length > 60) {
    console.error(`  …and ${violations.length - 60} more (--list to see all)`);
  }
  console.error(
    "\nReach the token through its registered utility (bg-x / text-x / border-x), or" +
      "\nmove the rule to src/styles/base-elements.css or src/styles/utilities.css." +
      "\nDo not add an exemption. See DESIGN_TOKEN_STANDARD.md §4.\n",
  );
  process.exit(1);
}

if (pinProblems.length) {
  console.error(
    "\ncheck-design-consistency --strict: " +
      pinProblems.length +
      " stale pin(s) in the guard itself:\n",
  );
  for (const p of pinProblems) console.error("  " + p);
  console.error(
    "\nDelete the entry: the file it justified is gone, and leaving it named would let\n" +
      "whatever lands there next inherit an exemption no review ever granted.\n",
  );
  process.exit(1);
}

const pinned = GUARD_PINS.reduce((n, [, entries]) => n + entries.length, 0);
console.log(
  `OK — no design-token bypasses (${files.length} files scanned` +
    (STRICT ? ", " + pinned + " guard pins verified" : "") +
    ").",
);

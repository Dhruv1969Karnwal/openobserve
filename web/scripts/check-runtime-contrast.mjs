#!/usr/bin/env node
// Copyright 2026 OpenObserve Inc.
//
// CI gate: the MECHANIZED runtime-contrast census (template scan + bookings ledger + selftest).
//
//   node scripts/check-runtime-contrast.mjs              # census over web/src
//   node scripts/check-runtime-contrast.mjs --selftest   # guard self-check (fixtures + mutations)
//   node scripts/check-runtime-contrast.mjs --strict     # FULL census, then the selftest
//   node scripts/check-runtime-contrast.mjs --list       # print every unbooked / drifted pair
//   node scripts/check-runtime-contrast.mjs --emit       # print ledger-row SHELLS for the unbooked
//                                                        # (reason is a TODO; pasting it back is RED)
//   node scripts/check-runtime-contrast.mjs --seal       # tighten MAX-UNBOOKED/MAX-DYNAMIC to the
//                                                        # measured residue — LOWERS ONLY, never raises
//   node scripts/check-runtime-contrast.mjs --seal --raise-cap
//                                                        # explicit human raise; the spec-side hard
//                                                        # pin fails until the pin is edited too
//
// WHAT IT MEASURES. utils/themePalette re-derives the whole --color-primary-* ramp, the
// --color-theme-* injections and a set of picked inks from the selected theme's themeColor, and
// applyThemeColors writes them INLINE on <html>/<body>, which beats every stylesheet rule. The
// sheet value of a token is therefore not what the page paints. This census enumerates every
// (site, ground, ink) co-occurrence the templates and scoped styles actually bind, resolves it in
// all twelve injected scopes (six predefined themes x both modes), and demands either a measured
// pass or a booked row in tokens/runtime-contrast-ledger.json. Composite states are in scope: an
// element opacity (opacity-NN / hover:opacity-NN) fades ink AND ground toward the plate behind it,
// which is the state the rest-only ledgers used to publish a number for.
//
// WHY IT EXISTS. This family escaped closure three times by hand-sampling, and the spec-side scan
// was provably bypassable by four source shapes. The enumeration lives in
// tokens/runtimeContrastScan.ts and the pixel model in tokens/runtimeContrast.ts — themeRuntimeContrast.spec.ts
// imports BOTH, so this CLI and the spec-side enforcer cannot disagree, and the colour arithmetic is
// colorMath.ts, the same file contrast.spec.ts measures with. Nothing is transcribed.
//
// If this failed: do not raise a number to make it green. Re-ink the site (a per-theme pick, or a
// stable token), or book it with its measured numbers and the reason it stays the palette owner's
// call. --emit prints row SHELLS whose reason is a registered-vocabulary-rejected TODO; writing the
// actual decision (a template from runtimeContrast.ts JUSTIFICATION_VOCABULARY) is the human part.
// --seal only tightens the MAX-UNBOOKED/MAX-DYNAMIC equality locks; raising one is a deliberate
// act: --raise-cap here plus the hard pin in themeRuntimeContrast.spec.ts in the same reviewed diff.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB = join(here, "..");
const SRC = join(WEB, "src");
const TOKEN_DIR = join(SRC, "lib", "styles", "tokens");
const LEDGER_FILE = join(TOKEN_DIR, "runtime-contrast-ledger.json");
const TOKEN_FILES = ["base.css", "semantic.css", "component.css", "dark.css"];

/** Production modules, imported verbatim: node strips the types, no bundler inside the gate. */
const PURE_MODULES = [
  ["src/utils/themePalette.ts", []],
  ["src/constants/themeRegistry.ts", []],
  ["src/lib/styles/tokens/colorMath.ts", []],
  [
    "src/lib/styles/tokens/runtimeContrast.ts",
    [
      ["../../../constants/themeRegistry", "../../../constants/themeRegistry.mjs"],
      ["./runtimeContrastScan", "./runtimeContrastScan.mjs"],
      ["../../../utils/themePalette", "../../../utils/themePalette.mjs"],
      ["./colorMath", "./colorMath.mjs"],
    ],
  ],
  [
    "src/lib/styles/tokens/runtimeContrastScan.ts",
    [["../../../utils/themePalette", "../../../utils/themePalette.mjs"]],
  ],
];

const loadProduction = async () => {
  const dir = mkdtempSync(join(tmpdir(), "runtime-contrast-"));
  for (const [path, rewrites] of PURE_MODULES) {
    const source = readFileSync(join(WEB, path), "utf8");
    let stripped = stripTypeScriptTypes(source, { mode: "strip" });
    for (const [from, to] of rewrites) stripped = stripped.split(from).join(to);
    const target = join(dir, path.replace(/\.ts$/, ".mjs"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, stripped, { mode: 0o600 });
  }
  const runtime = await import(
    pathToFileURL(join(dir, "src/lib/styles/tokens/runtimeContrast.mjs")).href
  );
  const scan = await import(
    pathToFileURL(join(dir, "src/lib/styles/tokens/runtimeContrastScan.mjs")).href
  );
  rmSync(dir, { recursive: true, force: true });
  return { ...runtime, ...scan };
};

const walkVue = (dir, found = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkVue(path, found);
    else if (entry.name.endsWith(".vue")) found.push(path);
  }
  return found;
};

const readSources = (root, ext = ".vue") =>
  (ext === ".vue" ? walkVue(root) : walkExt(root, ext)).map((path) => ({
    path: relative(root, path).split("\\").join("/"),
    source: readFileSync(path, "utf8"),
  }));

const round2 = (value) => Math.round(value * 100) / 100;

const walkExt = (dir, ext, found = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkExt(path, ext, found);
    else if (entry.name.endsWith(ext) && !entry.name.endsWith(".spec.ts")) found.push(path);
  }
  return found;
};

const emitRows = (report, placeholderReason) =>
  report.unbookedRows.map((row) => ({
    id: row.id,
    sites: row.sites,
    kind: row.pair.bar === "non-text" ? "non-text" : "text",
    where: `${row.pair.sample}`,
    reason: placeholderReason,
    at: row.numbers,
  }));

const printReport = (report, args, ledger, placeholderReason) => {
  console.log(
    `runtime contrast: ${report.files} .vue files → ${report.pairs} runtime (ground, ink) pairs × 12 injected scopes`,
  );
  console.log(
    `  measured-pass ${report.measuredPass} | booked ${report.booked} | unbooked ${report.unbooked} (fixable by an existing ink: ${report.fixable}) | booking drift ${report.driftCount} | stale bookings ${report.staleCount} | unattributed script class literals ${report.dynamicCount}`,
  );
  console.log(
    `  conditional pairs: ${report.conditionalCount} (measured when painted; guard rows do not promise they can never fail)`,
  );
  console.log(`  MAX-UNBOOKED (equality lock): ${ledger.maxUnbooked}`);
  if (args.has("--list") || args.has("--emit")) {
    for (const row of report.unbookedRows) {
      console.log(
        `  UNBOOKED ${row.id}  [${row.pair.inkClass} on ${row.pair.groundClass}; via ${row.pair.via}; bar ${row.bar}] ${row.failing.map(([scope, value]) => `${scope} ${value}`).join(", ")}`,
      );
    }
    for (const line of report.driftRows) console.log(`  DRIFT ${line}`);
    for (const row of report.staleRows) console.log(`  STALE booking with no live site: ${row.id}`);
    for (const row of report.staleDelegations)
      console.log(`  STALE delegation with no live pair: ${row.id}`);
    for (const row of report.staleDynamic)
      console.log(`  STALE dynamic row with no live literal: ${row.file} ${row.literal}`);
    for (const binding of report.unbookedDynamic) {
      const fragment = (binding.unexpandableStems ?? []).length
        ? ` — UNEXPANDABLE class fragment (${binding.unexpandableStems.join(", ")}): register ` +
          `its state enum in runtimeContrastScan.ts CLASS_FRAGMENT_FAMILIES or write the classes out`
        : "";
      console.log(
        `  LITERAL ${binding.file}:${binding.line} "${binding.literal}" paints ${binding.tokens.join(", ")} — no measured pair cites it${fragment}`,
      );
    }
  }
  if (args.has("--emit")) {
    console.log(JSON.stringify(emitRows(report, placeholderReason), null, 2));
  }
  if (report.exitCode) {
    console.log(
      `\nFAIL — every runtime pair must measure at or above its bar in all twelve scopes, or be booked in ${relative(WEB, LEDGER_FILE)}.`,
    );
    if (report.overCap)
      console.log(`  · unbooked ${report.unbooked} exceeds MAX-UNBOOKED ${ledger.maxUnbooked}`);
    if (report.underRatchet)
      console.log(
        `  · unbooked ${report.unbooked} is BELOW MAX-UNBOOKED ${ledger.maxUnbooked}: the residue healed, tighten the lock in the same commit`,
      );
  } else {
    console.log(
      "OK — every runtime pair is measured-pass or booked with its twelve-scope numbers.",
    );
  }
};

// ── self-spec: the shapes the census must see, and the ledger states it must reject ──────────

const FIXTURES = [
  {
    name: "self attribute (literal shape)",
    source: `<template><div class="bg-theme-accent text-white">Hello</div></template>`,
    expect: { pairs: 1, via: "self", bar: "text" },
  },
  {
    name: "descendant ink (E-2 shape #1)",
    source: `<template><div class="bg-theme-accent"><span class="text-white">Hello</span></div></template>`,
    expect: { pairs: 1, via: "descendant", bar: "text" },
  },
  {
    name: "/alpha ground (E-2 shape #2)",
    source: `<template><div class="bg-theme-accent/50 text-white">Hello</div></template>`,
    expect: { pairs: 1, bar: "text", groundIncludes: "color-mix" },
  },
  {
    name: "class from <script> (E-2 shape #3)",
    source: `<template><div :class="ACCENT_CLS">Hello</div></template><script>const ACCENT_CLS = "bg-theme-accent text-white";</script>`,
    expect: { pairs: 1, bar: "text" },
  },
  {
    name: "unresolvable binding + script ground literal (E-2 shape #3, dynamic)",
    source: `<template><div :class="toneFor(row)">Hello</div></template><script>const TONE = "bg-theme-accent text-white"; const toneFor = (row) => TONE;</script>`,
    expect: { dynamic: 1 },
  },
  {
    name: "scoped <style> paint (E-2 shape #4)",
    source: `<template><div class="plate">Hello</div></template><style scoped>.plate { background: var(--color-theme-accent); color: #ffffff; }</style>`,
    expect: { pairs: 1, bar: "text" },
  },
  {
    name: "hover opacity composite",
    source: `<template><div class="bg-theme-accent text-button-primary-foreground hover:opacity-85">Hello</div></template>`,
    expect: { pairs: 2, alpha: 0.85 },
  },
  {
    name: "icon-only site (non-text bar)",
    source: `<template><div class="bg-theme-accent text-white"><q-icon name="check" /></div></template>`,
    expect: { pairs: 1, bar: "non-text" },
  },
  {
    name: "legacy raw status shade as text",
    source: `<template><div class="text-warning-600">Careful</div></template>`,
    expect: { pairs: 1, bar: "text", ink: "--color-warning-600" },
  },
  {
    name: "legacy raw status shade on the runtime accent wash",
    source: `<template><div class="bg-theme-accent/10 text-warning">Careful</div></template>`,
    expect: { pairs: 1, bar: "text", ink: "--color-warning" },
  },
  {
    // F-153 / F-EDGE-1 attack S4. A class built by concatenation names no complete utility, so
    // the pair scan and the string-literal backstop both used to miss it. The family's state enum
    // is registered in runtimeContrastScan.ts, so the census expands and MEASURES the family.
    name: "interpolated class fragment, registered family",
    source: `<template><div :class="'bg-stepper-indicator-' + state + ' text-stepper-indicator-fg'">7</div></template>`,
    expect: { dynamic: 1, expandedPairs: 4 },
  },
  {
    // Same shape, unknown family: nothing to measure, so nothing may book it. The literal counts
    // toward MAX-DYNAMIC and a ledger row cannot silence it (see the mutation battery).
    name: "interpolated class fragment, unregistered family",
    source: `<template><div :class="'bg-tone-card-' + tone + ' text-white'">7</div></template>`,
    expect: { dynamic: 1, unexpandable: 1 },
  },
  {
    // F-154 / F-EDGE-4. The ground is cited by a LEGIBLE measured pair two lines above, and under
    // token-level attribution that citation used to cover this literal too — the pairing was never
    // seen. A hand-written white ink is attributed only to its own (ground, ink) pair.
    name: "stray text-white on a token-attributed ground",
    source:
      `<template><div class="bg-badge-primary-soft-bg text-badge-primary-soft-text">label</div>` +
      `<div :class="stepNumberClass">7</div></template><script>` +
      `const stepNumberClass = computed(() => { if (on) return "bg-badge-primary-soft-bg text-badge-primary-soft-text text-white"; return "bg-badge-primary-soft-bg text-badge-primary-soft-text text-[#fff]"; });` +
      `</script>`,
    expect: { dynamic: 2 },
  },
];

/** The SAME pipeline main() runs, over an in-memory source list (bookings + the MAX-UNBOOKED
 *  lock are overridable so a fixture can assert what a missing or drifted row does). */
const runCensus = (production, model, ledger, sources, bookings = ledger.bookings, lock = null) =>
  production.runRuntimeCensus(
    model,
    // lock !== null is FIXTURE mode: the real ledger's other rows would all report as stale
    // against a one-element source list, so only the rows under test stay in.
    lock === null
      ? { ...ledger, bookings }
      : {
          ...ledger,
          bookings,
          delegated: [],
          dynamicBindings: [],
          maxUnbooked: lock,
          maxDynamic: lock,
        },
    sources,
  );

const selfTest = async (production, model, ledger) => {
  let failures = 0;
  const check = (label, ok, detail = "") => {
    console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
  };
  const fixtureKey = (name) => `__fixtures__/${name.replace(/\W+/g, "-")}.vue`;
  const scanned = [];
  for (const fixture of FIXTURES) {
    const sources = [{ path: fixtureKey(fixture.name), source: fixture.source }];
    const report = runCensus(production, model, ledger, sources, [], 0);
    const pairs = report.rows;
    scanned.push({ fixture, report });
    const want = fixture.expect;
    if (want.pairs !== undefined) {
      check(
        `${fixture.name}: ${pairs.length} pair(s) scanned`,
        pairs.length === want.pairs,
        pairs.map((row) => `${row.pair.via}:${row.pair.ground}+${row.pair.ink}`).join(" | "),
      );
    }
    if (want.dynamic !== undefined) {
      check(
        `${fixture.name}: ${report.dynamicCount} unattributed class literal(s)`,
        report.dynamicCount === want.dynamic,
      );
    }
    if (want.expandedPairs !== undefined) {
      const pairs = report.unbookedDynamic.flatMap((binding) => binding.pairs ?? []);
      check(
        `${fixture.name}: ${pairs.length} expanded pair(s) measured across the family`,
        pairs.length >= want.expandedPairs,
        pairs.map((pair) => `${pair.groundClass}+${pair.inkClass}`).join(" | "),
      );
    }
    if (want.unexpandable !== undefined) {
      const stems = report.unbookedDynamic.flatMap((b) => b.unexpandableStems ?? []);
      check(
        `${fixture.name}: ${stems.length} unexpandable fragment stem(s)`,
        stems.length >= want.unexpandable,
        stems.join(", "),
      );
    }
    const row = pairs[0];
    if (row && want.via) check(`${fixture.name}: via ${row.pair.via}`, row.pair.via === want.via);
    if (row && want.bar) check(`${fixture.name}: bar ${row.pair.bar}`, row.pair.bar === want.bar);
    if (row && want.ink)
      check(
        `${fixture.name}: ink ${row.pair.ink} (a raw legacy shade is a census ink like any other)`,
        row.pair.ink === want.ink,
      );
    if (want.alpha !== undefined) {
      const faded = pairs.filter((entry) => entry.pair.alpha === want.alpha);
      check(
        `${fixture.name}: ${faded.length} pair(s) carry opacity ${want.alpha}`,
        faded.length >= 1,
      );
    }
    if (row && want.groundIncludes)
      check(
        `${fixture.name}: ground carries ${want.groundIncludes}`,
        row.pair.ground.includes(want.groundIncludes),
        row.pair.ground,
      );
    // Every fixture is a REAL problem at the accent fill, so an empty ledger must be red: either
    // an unbooked pair, or a dynamic binding the allowlist registry does not explain.
    check(
      `${fixture.name}: unbooked failure is RED`,
      report.exitCode === 1 && (report.unbooked >= 1 || report.dynamicCount >= 1),
      `unbooked=${report.unbooked} dynamic=${report.dynamicCount}`,
    );
  }

  // Mutation battery on a booked fixture: green only while the row matches the source exactly.
  const target = scanned.find((entry) => entry.fixture.name.startsWith("self attribute"));
  const bookedRow = target.report.rows[0];
  const fixturePath = fixtureKey(target.fixture.name);
  // A registered-vocabulary reason (the brand-label family) carrying the SC clause the fixture's
  // white-on-accent pair needs at dark O2 Signature — the selftest books the pair the way the gate
  // demands, so every mutation below fails for exactly ONE reason.
  const registeredReason =
    "literal white label on the runtime page tint (utils/themePalette runtimePageBackground: " +
    "5% theme colour over white in light, 8% theme colour into black in dark) \u2014 brand-by-design " +
    "fill (hero panels, badges, toast actions): the ground is the runtime colour itself, so no " +
    "static ink survives it; routing every one of these labels through a picked token is the owner " +
    "decision, not a class swap; worst 1.25:1 at dark O2 Signature; SC 1.4.11: the fixture glyph is " +
    "measured at the 3:1 bar it rides \u2014 palette-decision: see web/src/constants/themes.ts " +
    "DECISION RECORD";
  const unregisteredReason = production.EMIT_PLACEHOLDER_REASON;
  const correct = {
    id: bookedRow.id,
    sites: bookedRow.sites,
    kind: bookedRow.pair.bar === "non-text" ? "non-text" : "text",
    reason: registeredReason,
    at: bookedRow.numbers,
  };
  const fixtureSource = () => [{ path: fixturePath, source: target.fixture.source }];
  check(
    "mutation: exact booking of the same pair is GREEN",
    runCensus(production, model, ledger, fixtureSource(), [correct], 0).exitCode === 0,
  );
  const drifted = { ...correct, at: { ...correct.at } };
  const firstScope = Object.keys(drifted.at)[0];
  drifted.at[firstScope] = round2(drifted.at[firstScope] - 0.2);
  check(
    "mutation: booked number drift is RED",
    runCensus(production, model, ledger, fixtureSource(), [drifted], 0).driftRows.length > 0,
  );
  check(
    "mutation: removing the booking is RED",
    runCensus(production, model, ledger, fixtureSource(), [], 0).unbooked === 1,
  );
  const violationSource = () => [
    {
      path: fixturePath,
      source: target.fixture.source.replace(
        "</template>",
        String.fromCharCode(10) +
          '<div class="bg-theme-accent text-white">More</div>' +
          String.fromCharCode(10) +
          "</template>",
      ),
    },
  ];
  check(
    "mutation: a new violating template is RED",
    runCensus(production, model, ledger, violationSource(), [correct], 0).exitCode === 1,
  );
  const staleRow = { ...correct, id: ` (moved)` };
  check(
    "mutation: stale booking (site gone) is RED",
    runCensus(production, model, ledger, fixtureSource(), [staleRow], 0).staleRows.length === 1,
  );
  // RS10-01's demonstrated loophole: the emitted TODO row must NOT be an accepted justification.
  const todoReport = runCensus(
    production,
    model,
    ledger,
    fixtureSource(),
    [{ ...correct, reason: unregisteredReason }],
    0,
  );
  check(
    "mutation: the --emit TODO placeholder as a booking reason is RED",
    todoReport.exitCode === 1 &&
      todoReport.driftRows.some((line) => line.includes("justification templates")),
  );
  check(
    "mutation: the emitted placeholder is outside the justification vocabulary",
    !production.isRegisteredJustification(unregisteredReason),
  );
  // RS10-02's unenforced note: the fixture pair is sub-4.5 at dark O2 Signature, so the SC clause
  // its reason cites is now load-bearing — deleting it (vocabulary still satisfied) must be RED.
  const noScReport = runCensus(
    production,
    model,
    ledger,
    fixtureSource(),
    [{ ...correct, reason: registeredReason.replace(/SC 1\.4\.11:[^—]*/, "") }],
    0,
  );
  check(
    "mutation: a sub-AA default-theme booking without its SC clause is RED",
    noScReport.exitCode === 1 &&
      noScReport.driftRows.some((line) => line.includes("SC 1.4")) &&
      !noScReport.driftRows.some((line) => line.includes("justification templates")),
  );
  // F-153: the dynamicBindings side-door. A row that registers a literal WITHOUT its numbers used
  // to be the whole booking, which is how a 1.20:1 stepper pair sat in the ledger behind prose
  // claiming there was nothing to measure.
  const expanded = scanned.find((entry) =>
    entry.fixture.name.startsWith("interpolated class fragment, registered"),
  );
  const expandedSite = expanded.report.unbookedDynamic[0];
  const expandedSource = () => [
    { path: fixtureKey(expanded.fixture.name), source: expanded.fixture.source },
  ];
  const proseDynamicRow = {
    file: expandedSite.file,
    literal: expandedSite.literal,
    reason: "the census found no label co-bound with that fill, so there is no ratio to book",
  };
  const proseCensus = production.runRuntimeCensus(
    model,
    {
      ...ledger,
      bookings: [],
      delegated: [],
      dynamicBindings: [proseDynamicRow],
      maxUnbooked: 0,
      maxDynamic: 0,
    },
    expandedSource(),
  );
  check(
    "mutation: a prose-only dynamicBindings row over a measurable pair is RED",
    proseCensus.exitCode === 1 &&
      proseCensus.driftRows.some((line) => line.includes("twelve numbers")),
    proseCensus.driftRows.join(" / ").slice(0, 120),
  );
  const numberedDynamicRow = {
    ...proseDynamicRow,
    at: Object.fromEntries(
      Object.entries(
        Object.fromEntries(
          model.scopes.map((scope) => [
            production.scopeKey(scope),
            Math.min(
              ...expandedSite.pairs.map(
                (pair) =>
                  model.measurePair(pair.ink, pair.ground, scope, { under: ledger.plate }) ?? 1,
              ),
            ).toFixed(2) * 1,
          ]),
        ),
      ).filter(([, value]) => value >= 4.5),
    ),
  };
  check(
    "mutation: a dynamic row missing even one scope of its numbers is RED",
    production
      .runRuntimeCensus(
        model,
        {
          ...ledger,
          bookings: [],
          delegated: [],
          dynamicBindings: [numberedDynamicRow],
          maxUnbooked: 0,
          maxDynamic: 0,
        },
        expandedSource(),
      )
      .driftRows.some((line) => line.includes("nothing booked")),
  );
  // An unexpandable fragment paints an unknown set of classes, so no registration may cover it:
  // the shape stays inside the MAX-DYNAMIC hard pin (themeRuntimeContrast.spec.ts).
  const unexpanded = scanned.find((entry) =>
    entry.fixture.name.startsWith("interpolated class fragment, unregistered"),
  );
  const unexpandedSite = unexpanded.report.unbookedDynamic[0];
  const unexpandedCensus = production.runRuntimeCensus(
    model,
    {
      ...ledger,
      bookings: [],
      delegated: [],
      dynamicBindings: [
        { file: unexpandedSite.file, literal: unexpandedSite.literal, reason: "registered anyway" },
      ],
      maxUnbooked: 0,
      maxDynamic: 0,
    },
    [{ path: fixtureKey(unexpanded.fixture.name), source: unexpanded.fixture.source }],
  );
  check(
    "mutation: an UNEXPANDABLE class fragment cannot be quieted by registering it",
    unexpandedCensus.exitCode === 1 && unexpandedCensus.dynamicCount >= 1,
    `dynamic=${unexpandedCensus.dynamicCount}`,
  );
  console.log(
    failures === 0
      ? String.fromCharCode(10) +
          "self-spec OK - " +
          FIXTURES.length +
          " shapes scanned, ledger mutations rejected"
      : String.fromCharCode(10) + "self-spec FAILED with " + failures + " problem(s)",
  );
  return failures === 0;
};

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const production = await loadProduction();
  const model = production.createRuntimeModel(
    TOKEN_FILES.map((file) => readFileSync(join(TOKEN_DIR, file), "utf8")),
  );
  const ledger = JSON.parse(readFileSync(LEDGER_FILE, "utf8"));
  const placeholderReason = production.EMIT_PLACEHOLDER_REASON;
  if (args.has("--selftest")) {
    process.exit((await selfTest(production, model, ledger)) ? 0 : 1);
  }
  const censusSources = [...readSources(SRC, ".vue"), ...readSources(SRC, ".ts")];
  // --strict is the CI name (F-156/RS10-03): the FULL census first, then the selftest. A strict
  // mode that only ran the selftest was a name promising more assurance than it delivered.
  if (args.has("--strict")) {
    const census = runCensus(production, model, ledger, censusSources);
    printReport(census, args, ledger, placeholderReason);
    const selfOk = await selfTest(production, model, ledger);
    process.exit(census.exitCode === 0 && selfOk ? 0 : 1);
  }
  const report = runCensus(production, model, ledger, censusSources);
  if (args.has("--seal")) {
    // Ratchet values move DOWN only (F-156/RS10-04): --seal records the residue the census
    // actually measured when that is tighter than the current lock. Raising a lock is a human
    // decision with a second veto — the hard pin in themeRuntimeContrast.spec.ts.
    const raising = args.has("--raise-cap");
    const maxUnbooked = raising ? report.unbooked : Math.min(report.unbooked, ledger.maxUnbooked);
    const maxDynamic = raising
      ? report.dynamicCount
      : Math.min(report.dynamicCount, ledger.maxDynamic ?? 0);
    if (
      !raising &&
      (report.unbooked > ledger.maxUnbooked || report.dynamicCount > (ledger.maxDynamic ?? 0))
    ) {
      console.error(
        `FAIL — refusing to seal: the census measured MAX-UNBOOKED ${report.unbooked} ` +
          `(lock ${ledger.maxUnbooked}) / MAX-DYNAMIC ${report.dynamicCount} ` +
          `(lock ${ledger.maxDynamic ?? 0}) — --seal only lowers caps. Fix the residue, or raise ` +
          `them deliberately: --seal --raise-cap plus the new value pinned in ` +
          `themeRuntimeContrast.spec.ts in the same reviewed change.`,
      );
      process.exit(1);
    }
    const sealed = { ...ledger, maxUnbooked, maxDynamic };
    if (
      sealed.maxUnbooked === ledger.maxUnbooked &&
      sealed.maxDynamic === (ledger.maxDynamic ?? 0)
    ) {
      // Caps already at the measured residue: say so instead of re-encoding 4,300 JSON lines.
      console.log(
        `seal is a no-op: MAX-UNBOOKED=${ledger.maxUnbooked} MAX-DYNAMIC=${ledger.maxDynamic ?? 0}`,
      );
      process.exit(0);
    }
    writeFileSync(LEDGER_FILE, JSON.stringify(sealed, null, 2) + String.fromCharCode(10));
    console.log(`sealed MAX-UNBOOKED=${maxUnbooked} MAX-DYNAMIC=${maxDynamic}`);
    process.exit(0);
  }
  if (args.has("--emit-failing")) {
    // EVERY group below its bar, booked or not: the input for regenerating the ledger after a
    // scanner or model change, when the existing bookings are exactly what has to be re-derived.
    const failing = report.rows.filter((row) => row.failing.length > 0);
    console.error(
      "emit-failing: " + failing.length + " failing groups over " + report.pairs + " pairs",
    );
    console.log(
      JSON.stringify(emitRows({ ...report, unbookedRows: failing }, placeholderReason), null, 2),
    );
    process.exit(0);
  }
  if (args.has("--emit")) {
    // Machine output only: row SHELLS whose TODO reason the gate rejects — a human writes the
    // registered-template reason before this can enter the ledger. Human summary stays on stderr.
    console.error(
      "emit: " + report.unbooked + " unbooked groups over " + report.pairs + " runtime pairs",
    );
    console.log(JSON.stringify(emitRows(report, placeholderReason), null, 2));
    process.exit(0);
  }
  printReport(report, args, ledger, placeholderReason);
  process.exit(report.exitCode);
};

await main();

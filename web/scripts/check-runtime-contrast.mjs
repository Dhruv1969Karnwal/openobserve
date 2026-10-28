#!/usr/bin/env node
// CI gate: the MECHANIZED runtime-contrast census (F-142 + F-143 + F-145).
//
//   node scripts/check-runtime-contrast.mjs              # census over web/src
//   node scripts/check-runtime-contrast.mjs --selftest   # guard self-check (fixtures + mutations)
//   node scripts/check-runtime-contrast.mjs --list       # print every unbooked / drifted pair
//   node scripts/check-runtime-contrast.mjs --emit       # print ready ledger rows for the unbooked
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
// call. --emit prints the exact rows; the reasons are the part you have to write.
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

const emitRows = (report) =>
  report.unbookedRows.map((row) => ({
    id: row.id,
    sites: row.sites,
    kind: row.pair.bar === "non-text" ? "non-text" : "text",
    where: `${row.pair.sample}`,
    reason:
      "TODO palette-decision: why this pair is not re-inked (brand-by-design / owner call, name the file)",
    at: row.numbers,
  }));

const printReport = (report, args, ledger) => {
  console.log(
    `runtime contrast: ${report.files} .vue files → ${report.pairs} runtime (ground, ink) pairs × 12 injected scopes`,
  );
  console.log(
    `  measured-pass ${report.measuredPass} | booked ${report.booked} | unbooked ${report.unbooked} (fixable by an existing ink: ${report.fixable}) | booking drift ${report.driftCount} | stale bookings ${report.staleCount} | unattributed script class literals ${report.dynamicCount}`,
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
    for (const binding of report.unbookedDynamic) {
      console.log(
        `  LITERAL ${binding.file}:${binding.line} "${binding.literal}" paints ${binding.tokens.join(", ")} — no measured pair cites it`,
      );
    }
  }
  if (args.has("--emit")) {
    console.log(JSON.stringify(emitRows(report), null, 2));
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
    name: "hover opacity composite (F-142)",
    source: `<template><div class="bg-theme-accent text-button-primary-foreground hover:opacity-85">Hello</div></template>`,
    expect: { pairs: 2, alpha: 0.85 },
  },
  {
    name: "icon-only site (non-text bar)",
    source: `<template><div class="bg-theme-accent text-white"><q-icon name="check" /></div></template>`,
    expect: { pairs: 1, bar: "non-text" },
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
    const row = pairs[0];
    if (row && want.via) check(`${fixture.name}: via ${row.pair.via}`, row.pair.via === want.via);
    if (row && want.bar) check(`${fixture.name}: bar ${row.pair.bar}`, row.pair.bar === want.bar);
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
  const correct = {
    id: bookedRow.id,
    sites: bookedRow.sites,
    kind: bookedRow.pair.bar === "non-text" ? "non-text" : "text",
    reason: "brand-by-design - palette-decision: see web/src/constants/themes.ts DECISION RECORD",
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
  if (args.has("--selftest")) {
    process.exit((await selfTest(production, model, ledger)) ? 0 : 1);
  }
  const report = runCensus(production, model, ledger, [
    ...readSources(SRC, ".vue"),
    ...readSources(SRC, ".ts"),
  ]);
  if (args.has("--seal")) {
    // Ratchet values are what the census measured, never typed by hand.
    const sealed = { ...ledger, maxUnbooked: report.unbooked, maxDynamic: report.dynamicCount };
    writeFileSync(LEDGER_FILE, JSON.stringify(sealed, null, 2) + String.fromCharCode(10));
    console.log(`sealed MAX-UNBOOKED=${report.unbooked} MAX-DYNAMIC=${report.dynamicCount}`);
    process.exit(0);
  }
  if (args.has("--emit-failing")) {
    // EVERY group below its bar, booked or not: the input for regenerating the ledger after a
    // scanner or model change, when the existing bookings are exactly what has to be re-derived.
    const failing = report.rows.filter((row) => row.failing.length > 0);
    console.error("emit-failing: " + failing.length + " failing groups over " + report.pairs + " pairs");
    console.log(JSON.stringify(emitRows({ ...report, unbookedRows: failing }), null, 2));
    process.exit(0);
  }
  if (args.has("--emit")) {
    // Machine output only: pipe it into the ledger, keep the human summary on stderr.
    console.error(
      "emit: " + report.unbooked + " unbooked groups over " + report.pairs + " runtime pairs",
    );
    console.log(JSON.stringify(emitRows(report), null, 2));
    process.exit(0);
  }
  printReport(report, args, ledger);
  process.exit(report.exitCode);
};

await main();

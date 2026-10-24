#!/usr/bin/env node
// Copyright 2026 OpenObserve Inc.
//
// CI guard: type/template check the files a branch actually touched.
//
// WHY THIS EXISTS: `type-check:app` compiles the whole app program and that
// program does not fit in memory here — it dies in V8 at ~6.1 GiB after ~165 s
// (EXIT 134), and 6-7 GiB cgroups OOM-kill it sooner. A program scoped to the
// diff finishes in seconds, and a planted TS2322 in a .ts file plus a TS2339 in a
// .vue template both fail it, so the guard does bite. Wide diffs can still OOM,
// so a heap failure retries in shrinking chunks instead of reporting "fail".

import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, "..");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "origin/feat/darknight");
const EXPLICIT = arg("files", "");
const CONFIG = join(WEB_ROOT, "tsconfig.app.json");
const HEAP = arg("heap", "6144");
const CHUNK = Number(arg("chunk", "0"));

// vue-tsc needs its own heap: it dies on node's ~2 GiB default well before the app graph ends.
const nodeOptions = () => {
  const flag = "--max-old-space-size=" + String(HEAP);
  const base = (process.env.NODE_OPTIONS || "").trim();
  return base ? base + " " + flag : flag;
};

const git = (args) =>
  execFileSync("git", args, { cwd: WEB_ROOT, encoding: "utf8" }).split("\n").filter(Boolean);

/** Paths relative to web/, of files this branch (or the working tree) changed. */
function changedFiles() {
  if (EXPLICIT) {
    return EXPLICIT.split(",")
      .map((f) => f.trim())
      .filter(Boolean);
  }
  const committed = git(["diff", "--name-only", "--diff-filter=ACMR", `${BASE}...HEAD`, "--"]);
  // Uncommitted work counts too: this is the pre-push loop, and a bare `git diff` reads the worktree.
  const dirty = git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD", "--"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  const all = new Set([...committed, ...dirty, ...untracked]);
  const strip = (f) => (f.startsWith("web/") ? f.slice("web/".length) : f);
  return [...all].map(strip).filter((f) => f && !f.startsWith("public/"));
}

const CHECKABLE = (f) =>
  (f.endsWith(".ts") || f.endsWith(".vue") || f.endsWith(".tsx")) &&
  !f.includes("node_modules") &&
  !f.startsWith("dist/");

const files = changedFiles().filter(CHECKABLE);

if (files.length === 0) {
  console.log(`type-check:changes — nothing checkable changed vs ${BASE}.`);
  process.exit(0);
}

if (argv.includes("--list")) {
  console.log(`${files.length} file(s) vs ${BASE}:`);
  for (const f of files) console.log(`  ${f}`);
  process.exit(0);
}

// The ambient declarations stay in every program: without them .vue files lose
// global component knowledge and report a wall of errors unrelated to the diff.
const program = (subset) => ({
  extends: "./tsconfig.app.json",
  include: ["env.d.ts", "src/env.d.ts", "src/**/*.d.ts", ...subset],
  exclude: ["node_modules", "dist"],
  compilerOptions: { composite: false },
});

// The config lives in web/ because `extends` and `include` resolve relative to it.
const CFG = join(WEB_ROOT, "tsconfig.changes.tmp.json");

function runProgram(subset) {
  writeFileSync(CFG, JSON.stringify(program(subset), null, 2) + "\n");
  try {
    const out = execFileSync("npx", ["vue-tsc", "--noEmit", "-p", CFG, "--composite", "false"], {
      cwd: WEB_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: nodeOptions() },
    });
    if (out.trim()) process.stdout.write(out);
    return { ok: true, oom: false };
  } catch (err) {
    const out = [err.stdout, err.stderr].filter(Boolean).join("\n");
    if (out.trim()) process.stdout.write(out + "\n");
    const oom =
      /Reached heap limit|JavaScript heap out of memory|out of memory/i.test(out) ||
      err.status === 134 ||
      err.signal === "SIGABRT";
    return { ok: false, oom, status: err.status ?? 1 };
  }
}

const chunks = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

if (!existsSync(CONFIG)) {
  console.error(`type-check:changes — ${relative(WEB_ROOT, CONFIG)} not found.`);
  process.exit(2);
}

let unverified = [];
let failed = false;
try {
  console.log(`type-check:changes — ${files.length} changed file(s) vs ${BASE}`);
  const first = runProgram(files);
  if (first.ok) {
    console.log("type-check:changes — PASS");
  } else if (!first.oom) {
    console.error("type-check:changes — FAIL (type errors above)");
    process.exit(first.status || 1);
  } else {
    // The diff is too wide for one program, which says nothing about the types in it.
    console.log("whole-diff program exhausted the heap; retrying in chunks");
    const sizes = CHUNK > 0 ? [CHUNK, 1] : [16, 8, 4, 1];
    let queue = [files];
    for (const size of sizes) {
      const next = [];
      for (const group of queue) {
        for (const part of size >= group.length ? [group] : chunks(group, size)) {
          const res = runProgram(part);
          if (res.ok) continue;
          if (!res.oom) {
            // Keep going: one dirty file must not hide the state of the other chunks.
            failed = true;
            console.error("type-check:changes — FAIL in a chunk of " + part.length + ":");
            for (const f of part) console.error("  " + f);
          }
          if (part.length === 1) unverified.push(part[0]);
          else next.push(part);
        }
      }
      queue = next;
      if (!queue.length) break;
    }
    if (unverified.length) {
      console.error(
        "type-check:changes — UNVERIFIED (" +
          unverified.length +
          " file(s) could not be compiled even alone at " +
          HEAP +
          " MiB; run `type-check:app` where memory allows):",
      );
      for (const f of unverified) console.error("  " + f);
      process.exit(2);
    }
    if (failed) {
      console.error("type-check:changes — FAIL (type errors above, from the chunked retries)");
      process.exit(1);
    }
    console.log("type-check:changes — PASS (chunked)");
  }
} finally {
  rmSync(CFG, { force: true });
}

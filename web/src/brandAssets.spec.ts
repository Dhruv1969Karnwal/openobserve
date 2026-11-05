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

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { basename, extname, join, sep } from "node:path";

// vitest runs specs with the `web/` package root as cwd; the assets under test are static
// files outside the component tree, so they are read from disk rather than imported.
const at = (rel: string) => readFileSync(join(process.cwd(), rel));

const html = at("index.html").toString("utf8");
const svg = at("public/favicon.svg").toString("utf8");
const ico = at("public/favicon.ico");
const wordmark = at("src/components/BrandWordmark.vue").toString("utf8");

function isNeutralHex(colour: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(colour);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return Math.max(Math.abs(r - g), Math.abs(g - b)) <= 4;
}

interface IcoEntry {
  w: number;
  isPng: boolean;
  pixels: number[][];
}

function icoEntries(blob: Buffer): IcoEntry[] {
  const count = blob.readUInt16LE(4);
  return Array.from({ length: count }, (_, i) => {
    const dir = 6 + 16 * i;
    const w = blob[dir] || 256;
    const size = blob.readUInt32LE(dir + 8);
    const off = blob.readUInt32LE(dir + 12);
    const body = blob.subarray(off, off + size);
    const isPng = body.subarray(1, 4).toString("latin1") === "PNG";
    const pixels: number[][] = [];
    if (isPng) {
      let pos = 8;
      let idat = Buffer.alloc(0);
      let height = 0;
      let width = 0;
      while (pos + 8 <= body.length) {
        const len = body.readUInt32BE(pos);
        const type = body.subarray(pos + 4, pos + 8).toString("latin1");
        if (type === "IHDR") {
          width = body.readUInt32BE(pos + 8);
          height = body.readUInt32BE(pos + 12);
        } else if (type === "IDAT") {
          idat = Buffer.concat([idat, body.subarray(pos + 8, pos + 8 + len)]);
        }
        pos += 12 + len;
      }
      const raw = inflateSync(idat);
      const stride = width * 4;
      for (let y = 0; y < height; y++) {
        const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let x = 0; x < width; x++) {
          pixels.push([row[4 * x], row[4 * x + 1], row[4 * x + 2], row[4 * x + 3]]);
        }
      }
    }
    return { w, isPng, pixels };
  });
}

const painted = (entry: IcoEntry) => entry.pixels.filter((p) => p[3] > 40);
const dark = (entry: IcoEntry) => painted(entry).filter((p) => p[0] < 80);

describe("shipped brand assets", () => {
  it("titles the document as this product and credits its author", () => {
    expect(html).toContain("<title>Retrace.ai</title>");
    expect(html).toContain('<meta name="author" content="Dhruv Karnwal" />');
    expect(html).not.toMatch(/openobserve/i);
  });

  it("serves the monochrome vector mark first with the raster as fallback", () => {
    expect(html).toMatch(/<link rel="icon"[^>]*href="\/favicon\.svg"/);
    expect(html).toMatch(/<link rel="alternate icon" href="\/favicon\.ico"/);
  });

  it("keeps the favicon glyph identical to the in-app wordmark glyph", () => {
    const inSvg = /\sd="([^"]+)"/s.exec(svg)?.[1];
    const inWordmark = /\sd="([^"]+)"/.exec(wordmark)?.[1];
    expect(inSvg).toBeTruthy();
    expect(inSvg).toBe(inWordmark);
    expect(/viewBox="([^"]+)"/.exec(svg)?.[1]).toBe(/viewBox="([^"]+)"/.exec(wordmark)?.[1]);
  });

  it("pins the tab icon's plate to the in-app mark's plate and to one fixed polarity", () => {
    const plate = /<rect[^>]*>/.exec(svg)?.[0] ?? "";
    const glyph = /<path[\s\S]*?>/.exec(svg)?.[0] ?? "";
    const markPlate = /<rect[^>]*>/.exec(wordmark)?.[0] ?? "";
    const markGlyph = /<path[\s\S]*?>/.exec(wordmark)?.[0] ?? "";
    const num = (tag: string, name: string) =>
      Number(new RegExp(`(?<![\\w-])${name}="([^"]*)"`).exec(tag)?.[1]);

    // The stroke straddles the rect, so the icon's painted plate reaches `border/2` past it:
    // its outer edge has to land exactly on the plate the in-app mark draws.
    const border = num(plate, "stroke-width");
    expect([
      num(plate, "x") - border / 2,
      num(plate, "y") - border / 2,
      num(plate, "width") + border,
      num(plate, "height") + border,
    ]).toEqual([
      num(markPlate, "x"),
      num(markPlate, "y"),
      num(markPlate, "width"),
      num(markPlate, "height"),
    ]);
    // Its corner is one unit tighter than the mark's once the border is accounted for, and that
    // difference is a decision, not drift.
    expect(num(plate, "rx") + border / 2).toBe(15);

    // A static icon cannot follow the theme, so this polarity is fixed: light plate, neutral edge,
    // dark glyph — the dark-theme rendering of the mark's heading-on-surface pair.
    expect(/fill="([^"]+)"/.exec(plate)?.[1]).toBe("#f5f6f7");
    expect(/stroke="([^"]+)"/.exec(plate)?.[1]).toBe("#bebebe");
    expect(/stroke="([^"]+)"/.exec(glyph)?.[1]).toBe("#0c0d0f");
    expect(markPlate).toContain("fill-text-heading");
    expect(markGlyph).toContain("stroke-surface-base");
  });

  it("paints the favicon with neutrals only — the rebrand removed the accent hues", () => {
    const colours = [...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThanOrEqual(3);
    for (const c of colours) expect(isNeutralHex(c)).toBe(true);
  });

  it("ships a readable multi-size ICO whose pixels carry no hue", () => {
    const entries = icoEntries(ico);
    const widths = entries.map((e) => e.w);
    expect(widths).toContain(16);
    expect(widths).toContain(32);
    expect(widths).toContain(48);
    for (const entry of entries) {
      expect(entry.isPng).toBe(true);
      expect(painted(entry).length).toBeGreaterThan(entry.w * entry.w * 0.4);
      expect(dark(entry).length).toBeGreaterThan(0);
      for (const [r, g, b] of painted(entry)) {
        expect(Math.max(Math.abs(r - g), Math.abs(g - b))).toBeLessThanOrEqual(4);
      }
    }
  });

  it("ships no upstream tab icon alongside the vector mark", () => {
    const files = readdirSync(join(process.cwd(), "public"));
    expect(files).not.toContain("favicon_old.ico");
    expect(files).not.toContain("openobserve_favicon_light.ico");
    expect(files.filter((f) => /openobserve/i.test(f))).toEqual([]);

    const icons = files.filter((f) => f.startsWith("favicon") && f.endsWith(".ico"));
    expect(icons.length).toBeGreaterThan(0);
    for (const name of icons) {
      for (const entry of icoEntries(at(`public/${name}`))) {
        // Upstream's icons are BMP-in-ICO and carry its four accent hues; this mark is neither.
        expect(entry.isPng).toBe(true);
        expect(painted(entry).length).toBeGreaterThan(0);
        for (const [r, g, b] of painted(entry)) {
          expect(Math.max(Math.abs(r - g), Math.abs(g - b))).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it("regenerates the committed raster from the vector, byte for byte", () => {
    const out = execFileSync(process.execPath, ["scripts/make-favicon.mjs", "--check"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(out).toContain("matches favicon.svg");
  });

  it("keeps the glyph legible at the smallest shipped size", () => {
    const smallest = icoEntries(ico).find((e) => e.w === 16)!;
    expect(dark(smallest).length).toBeGreaterThanOrEqual(8);
  });
});

// Upstream-named files may only live under `src/assets` while real code still points at them;
// the pricing/pipeline icons below are the ones that do (REV-BRD check 4), so they are named here
// instead of the ratchet being loosened wholesale.
const UPSTREAM_ASSET_ALLOWLIST = [
  "src/assets/images/common/openobserve_favicon.png",
  "src/assets/images/pipeline/openobserve.svg",
  "src/assets/openobserve_favicon_dark.ico",
];

const TEXT_REF_EXTS = new Set([
  ".vue",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".html",
  ".css",
  ".scss",
  ".md",
]);

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(rel));
    else out.push(rel.split(sep).join("/"));
  }
  return out;
}

// Specs assert the absence of upstream marks, so they are not evidence that a file is used.
const referrers = filesUnder("src")
  .filter(
    (f) =>
      !f.startsWith("src/assets/") &&
      !f.includes(".spec.") &&
      TEXT_REF_EXTS.has(extname(f)) &&
      !f.startsWith("src/locales/languages/"),
  )
  .concat(["index.html"]);

function referencedBy(needle: string): string[] {
  return referrers.filter((f) => readFileSync(join(process.cwd(), f), "utf8").includes(needle));
}

describe("upstream-named files under src/assets", () => {
  const upstreamAssets = filesUnder("src/assets").filter((f) => /openobserve/i.test(basename(f)));

  it("finds upstream-named files to judge at all", () => {
    expect(upstreamAssets.length).toBeGreaterThan(0);
  });

  it("ships no unreferenced upstream wordmark or banner under src/assets", () => {
    const dead = upstreamAssets.filter((f) => referencedBy(basename(f)).length === 0);
    expect(dead).toEqual([]);
  });

  it("keeps exactly the allowlisted upstream marks, and only while they are referenced", () => {
    expect(upstreamAssets.slice().sort()).toEqual(UPSTREAM_ASSET_ALLOWLIST);
    for (const file of UPSTREAM_ASSET_ALLOWLIST) {
      expect(referencedBy(basename(file)).length, file).toBeGreaterThan(0);
    }
  });

  it("stays clear of the marks this product deleted", () => {
    for (const gone of [
      "src/assets/openobserve_logo_light.svg",
      "src/assets/images/common/openobserve_logo_light.svg",
      "src/assets/images/common/openobserve_banner_compreesed.png",
      "src/assets/openobserve_favicon_light.ico",
    ]) {
      expect(upstreamAssets).not.toContain(gone);
    }
  });
});

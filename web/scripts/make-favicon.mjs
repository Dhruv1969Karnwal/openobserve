#!/usr/bin/env node
// Regenerates `public/favicon.ico` from `public/favicon.svg` so the raster tab icon
// can never drift from the vector one, and neither can drift from the in-app mark.
// Supports only the primitives the Retrace lock-up uses (M/H/h/V/v/L/l + rounded rect);
// anything else fails loudly instead of rendering something wrong.
//
// Run: node scripts/make-favicon.mjs          (from web/)  — writes the .ico
//      node scripts/make-favicon.mjs --check                 — exit 1 on drift
import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const SVG_PATH = join(WEB, "public", "favicon.svg");
const ICO_PATH = join(WEB, "public", "favicon.ico");
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const SUPERSAMPLE = 6;

const svg = readFileSync(SVG_PATH, "utf8");


const viewBox = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1].trim().split(/\s+/).map(Number);
if (!viewBox || viewBox.length !== 4) throw new Error("favicon.svg: unreadable viewBox");
const [vbX, vbY, vbW] = viewBox;

const rectTag = /<rect[^>]*>/.exec(svg)?.[0];
const pathTag = /<path[\s\S]*?>/.exec(svg)?.[0];
if (!rectTag || !pathTag) throw new Error("favicon.svg: expected one <rect> plate and one <path> glyph");

const attr = (tag, name) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];
const num2 = (tag, name) => Number(attr(tag, name));
const plate = {
  x: num2(rectTag, "x"),
  y: num2(rectTag, "y"),
  w: num2(rectTag, "width"),
  h: num2(rectTag, "height"),
  rx: num2(rectTag, "rx"),
  fill: attr(rectTag, "fill"),
  stroke: attr(rectTag, "stroke"),
  strokeWidth: num2(rectTag, "stroke-width"),
};
const glyph = { d: attr(pathTag, "d"), stroke: attr(pathTag, "stroke"), strokeWidth: num2(pathTag, "stroke-width") };
for (const [where, value] of [
  ["plate x/y/width/height/rx", [plate.x, plate.y, plate.w, plate.h, plate.rx]],
  ["glyph stroke/width", [glyph.stroke, glyph.strokeWidth]],
]) {
  const list = Array.isArray(value) ? value : [value];
  if (list.some((v) => v === undefined || (typeof v === "number" && Number.isNaN(v)))) {
    throw new Error(`favicon.svg: missing ${where} attribute`);
  }
}

function toRgb(colour) {
  const m = /^#([0-9a-f]{6})$/i.exec(colour ?? "");
  if (!m) throw new Error(`favicon.svg: only 6-digit hex colours are supported, got ${colour}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

const PLATE = toRgb(plate.fill);
const EDGE = toRgb(plate.stroke);
const GLYPH = toRgb(glyph.stroke);

// --- path -> polyline, in viewBox units -------------------------------------
const commands = glyph.d.match(/[a-zA-Z][^a-zA-Z]*/g) ?? [];
const points = [];
let cursor = [0, 0];
for (const token of commands) {
  const type = token[0];
  // SVG lets a sign or a second decimal point act as the separator: "l10-26 12 52" is four numbers.
  const args = (token.slice(1).match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
  if (args.some((a) => Number.isNaN(a))) throw new Error(`favicon.svg: unreadable path argument in "${token}"`);
  if (type === "M" || type === "m") {
    if (args.length !== 2) throw new Error(`favicon.svg: M/m takes one pair`);
    cursor = type === "M" ? [args[0], args[1]] : [cursor[0] + args[0], cursor[1] + args[1]];
    points.push(cursor);
  } else if (type === "H" || type === "h") {
    for (const dx of args) {
      cursor = [type === "H" ? dx : cursor[0] + dx, cursor[1]];
      points.push(cursor);
    }
  } else if (type === "V" || type === "v") {
    for (const dy of args) {
      cursor = [cursor[0], type === "V" ? dy : cursor[1] + dy];
      points.push(cursor);
    }
  } else if (type === "L" || type === "l") {
    if (args.length % 2) throw new Error(`favicon.svg: L/l takes pairs`);
    for (let i = 0; i < args.length; i += 2) {
      cursor = [type === "L" ? args[i] : cursor[0] + args[i], type === "L" ? args[i + 1] : cursor[1] + args[i + 1]];
      points.push(cursor);
    }
  } else {
    throw new Error(`favicon.svg: path command "${type}" is not supported by this rasteriser`);
  }
}
if (points.length < 2) throw new Error("favicon.svg: glyph path has no segments to stroke");

// --- geometry helpers -------------------------------------------------------
const segmentDistance = (px, py, a, b) => {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / l2));
  return Math.hypot(px - a[0] - t * vx, py - a[1] - t * vy);
};

const insideRoundedRect = (px, py, x0, y0, x1, y1, r) => {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const straight = (x0 + r <= px && px <= x1 - r) || (y0 + r <= py && py <= y1 - r);
  if (straight) return true;
  return Math.hypot(px - Math.max(x0 + r, Math.min(px, x1 - r)), py - Math.max(y0 + r, Math.min(py, y1 - r))) <= r;
};

// An SVG stroke straddles its path, so the painted plate reaches `sw/2` past the rect on
// both sides: outer edge, hairline band, then the fill area.
const halfBorder = plate.strokeWidth / 2;
const plateOuter = [
  plate.x - halfBorder,
  plate.y - halfBorder,
  plate.x + plate.w + halfBorder,
  plate.y + plate.h + halfBorder,
];
const plateInner = [
  plate.x - halfBorder + plate.strokeWidth,
  plate.y - halfBorder + plate.strokeWidth,
  plate.x + plate.w + halfBorder - plate.strokeWidth,
  plate.y + plate.h + halfBorder - plate.strokeWidth,
];
const innerRadius = Math.max(1, plate.rx - halfBorder);
const halfStroke = glyph.strokeWidth / 2;

function renderCanvas(size) {
  const scale = size / vbW;
  const bytes = Buffer.alloc(size * (size * 4 + 1));
  for (let row = 0; row < size; row++) {
    const line = row * (size * 4 + 1);
    for (let col = 0; col < size; col++) {
      const hits = new Map();
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const px = vbX + (col + (sx + 0.5) / SUPERSAMPLE) / scale;
          const py = vbY + (row + (sy + 0.5) / SUPERSAMPLE) / scale;
          if (!insideRoundedRect(px, py, ...plateOuter, plate.rx + halfBorder)) continue;
          let colour = insideRoundedRect(px, py, ...plateInner, innerRadius) ? null : EDGE;
          if (colour === null) {
            colour = PLATE;
            for (let i = 0; i + 1 < points.length; i++) {
              if (segmentDistance(px, py, points[i], points[i + 1]) <= halfStroke) {
                colour = GLYPH;
                break;
              }
            }
          }
          hits.set(colour, (hits.get(colour) ?? 0) + 1);
        }
      }
      let total = 0;
      for (const n of hits.values()) total += n;
      if (!total) continue;
      const steps = SUPERSAMPLE * SUPERSAMPLE;
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [colour, n] of hits) {
        r += colour[0] * n;
        g += colour[1] * n;
        b += colour[2] * n;
      }
      const at = line + 1 + col * 4;
      bytes[at] = Math.round(r / total);
      bytes[at + 1] = Math.round(g / total);
      bytes[at + 2] = Math.round(b / total);
      bytes[at + 3] = Math.round((total / steps) * 255);
    }
  }
  return bytes;
}

// --- PNG + ICO containers ---------------------------------------------------
const crcTable = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const toPng = (size, rgba) =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    (() => {
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(size, 0);
      ihdr.writeUInt32BE(size, 4);
      ihdr[8] = 8;
      ihdr[9] = 6;
      return chunk("IHDR", ihdr);
    })(),
    chunk("IDAT", deflateSync(rgba, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);

function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const directory = Buffer.alloc(16 * images.length);
  images.forEach((blob, i) => {
    const at = i * 16;
    directory[at] = SIZES[i] >= 256 ? 0 : SIZES[i];
    directory[at + 1] = directory[at];
    directory.writeUInt16LE(1, at + 4);
    directory.writeUInt16LE(32, at + 6);
    directory.writeUInt32LE(blob.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += blob.length;
  });
  return Buffer.concat([header, directory, ...images]);
}

const ico = toIco(SIZES.map((size) => toPng(size, renderCanvas(size))));

if (process.argv.includes("--check")) {
  let current;
  try {
    current = readFileSync(ICO_PATH);
  } catch {
    console.error(`make-favicon: ${ICO_PATH} is missing`);
    process.exit(1);
  }
  if (current.equals(ico)) {
    console.log(`make-favicon: ${ICO_PATH} matches favicon.svg (${ico.length} bytes, ${SIZES.join("/")} px)`);
    process.exit(0);
  }
  console.error(
    `make-favicon: ${ICO_PATH} is stale — regenerated ${ico.length} bytes from favicon.svg, committed file is ${current.length}. Run: node scripts/make-favicon.mjs`,
  );
  process.exit(1);
}

writeFileSync(ICO_PATH, ico);
console.log(`make-favicon: wrote ${ICO_PATH} (${ico.length} bytes, sizes ${SIZES.join("/")})`);

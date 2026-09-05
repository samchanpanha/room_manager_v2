/// Self-contained EAN-13 barcode utilities — no external dependency.
/// Produces raster (PNG) and vector (SVG) images: PNG is embedded in PDFs
/// (@react-pdf <Image>), SVG is used for browser label sheets. Computes the
/// check digit when given 12 digits and re-validates when 13 are supplied
/// (§M14 "print barcode product").
import { deflateSync } from "node:zlib";

const L: Record<string, string> = {
  "0": "0001101", "1": "0011001", "2": "0010011", "3": "0111101", "4": "0100011",
  "5": "0110001", "6": "0101111", "7": "0111011", "8": "0110111", "9": "0001011"
};
const G: Record<string, string> = {
  "0": "0100111", "1": "0110011", "2": "0011011", "3": "0100001", "4": "0011101",
  "5": "0111001", "6": "0000101", "7": "0010001", "8": "0001001", "9": "0010111"
};
const R: Record<string, string> = {
  "0": "1110010", "1": "1100110", "2": "1101100", "3": "1000010", "4": "1011100",
  "5": "1001110", "6": "1010000", "7": "1000100", "8": "1001000", "9": "1110100"
};
/// First-digit parity pattern selects L/G for the left group.
const PARITY: Record<string, string> = {
  "0": "LLLLLL", "1": "LLGLGG", "2": "LLGGLG", "3": "LLGGGL", "4": "LGLLGG",
  "5": "LGGLLG", "6": "LGGGLL", "7": "LGLGLG", "8": "LGLGGL", "9": "LGGLGL"
};

/** EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(code: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(code[i]);
    sum += i % 2 === 0 ? d : d * 3; // positions 1,3,5.. (odd) ×1; even ×3
  }
  return (10 - (sum % 10)) % 10;
}

/** Accepts 12 or 13 digits; returns the normalized 13-digit EAN-13 or null. */
export function normalizeEan13(code: string): string | null {
  const digits = code.replace(/\D/g, "");
  if (digits.length === 12) return digits + ean13CheckDigit(digits);
  if (digits.length === 13 && Number(digits[12]) === ean13CheckDigit(digits.slice(0, 12))) return digits;
  return null;
}

/**
 * Bars for an EAN-13 code: an array of [barWidth, isBar] segments (black=true).
 * 95 modules: guard(3) + left(42) + center(5) + right(42) + guard(3).
 */
export function ean13Modules(code13: string): Array<[number, boolean]> {
  const parity = PARITY[code13[0]];
  const segments: Array<[number, boolean]> = [];
  segments.push([1, true], [0, false], [1, true]); // left guard 101
  for (let i = 0; i < 6; i++) {
    const table = parity[i] === "L" ? L : G;
    for (const ch of table[code13[i + 1]]) segments.push([1, ch === "1"]);
  }
  segments.push([1, false], [0, true], [1, false], [0, true], [1, false]); // center 01010
  for (let i = 6; i < 12; i++) {
    for (const ch of R[code13[i + 1]]) segments.push([1, ch === "1"]);
  }
  segments.push([1, true], [0, false], [1, true]); // right guard 101
  return segments;
}

/** Rasterize an EAN-13 barcode and encode as a PNG image (`data:image/png;base64,...`).
 * Reliable in @react-pdf <Image> (raster, no SVG parsing). */
export function ean13PngDataUrl(code13: string, opts: { height?: number; scale?: number } = {}): string {
  const scale = opts.scale ?? 3;
  const height = opts.height ?? 64;
  const modules = ean13Modules(code13);
  const width = modules.reduce((w, [n]) => w + n, 0) * scale;

  const moduleScale = scale;
  const rows: boolean[] = [];
  for (const [n, isBar] of modules) {
    for (let i = 0; i < n * moduleScale; i++) rows.push(isBar);
  }

  // Grayscale 8-bit per pixel; build scanlines (each row prefixed with filter 0).
  const stride = width;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: none
    for (let px = 0; px < stride; px++) {
      raw[rowStart + 1 + px] = rows[px] ? 0x00 : 0xff;
    }
  }

  return `data:image/png;base64,${pngEncode(width, height, raw).toString("base64")}`;
}

function crc32(buf: Buffer): number {
  let c: number;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function pngEncode(width: number, height: number, raw: Buffer): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

/** SVG data URL for an EAN-13 barcode (for browser label sheets). */
export function ean13SvgDataUrl(code13: string, opts: { height?: number; scale?: number; showText?: boolean } = {}): string {
  const scale = opts.scale ?? 2;
  const height = opts.height ?? 40;
  const showText = opts.showText ?? true;
  const modules = ean13Modules(code13);
  const width = modules.reduce((w, [n]) => w + n, 0) * scale;
  const textHeight = showText ? 14 : 0;
  const totalHeight = height + textHeight;

  const rects: string[] = [];
  let x = 0;
  for (const [n, isBar] of modules) {
    if (isBar) rects.push(`<rect x="${x}" y="0" width="${n * scale}" height="${height}" fill="#000"/>`);
    x += n * scale;
  }

  let text = "";
  if (showText) {
    const y = height + 9;
    const tfs = scale >= 3 ? 11 : 9;
    text = `<g fill="#000" font-family="monospace" font-size="${tfs}">` +
      `<text x="${0 * scale}" y="${y}">${code13[0]}</text>` +
      `<text x="${23 * scale}" y="${y}">${code13.slice(1, 7)}</text>` +
      `<text x="${60 * scale}" y="${y}">${code13.slice(7)}</text>` +
      `</g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">` +
    `<rect width="${width}" height="${totalHeight}" fill="#fff"/>${rects.join("")}${text}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
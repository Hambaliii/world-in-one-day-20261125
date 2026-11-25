import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";

const W = 1024;
const H = 1024;

const PAPER: [number, number, number] = [247, 243, 234];
const INK: [number, number, number] = [20, 20, 20];
const RED: [number, number, number] = [179, 32, 44];
const BLUE: [number, number, number] = [29, 78, 137];
const WHITE: [number, number, number] = [247, 243, 234];

type RGB = [number, number, number];

// ---------- CRC32 ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

// ---------- 5x7 bitmap font (hand-drawn) ----------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

// ---------- Canvas ----------
const px = new Uint8Array(W * H * 3);
function fillAll(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
}
function drawRect(x: number, y: number, w: number, h: number, c: RGB): void {
  fillRect(x, y, w, 1, c);
  fillRect(x, y + h - 1, w, 1, c);
  fillRect(x, y, 1, h, c);
  fillRect(x + w - 1, y, 1, h, c);
}
function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function drawCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPixel(x, y, c);
    }
}

// ---------- Text ----------
function measureText(text: string, scale: number): number {
  const s = text.toUpperCase();
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, text: string, scale: number, c: RGB): void {
  const s = text.toUpperCase();
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT[" "];
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === "1") fillRect(cx + col * scale, y + r * scale, scale, scale, c);
    cx += 6 * scale;
  }
}
function wrapText(text: string, scale: number, maxWidth: number): string[] {
  const words = text.toUpperCase().split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (measureText(trial, scale) <= maxWidth || cur === "") cur = trial;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(x: number, y: number, text: string, scale: number, maxWidth: number, lineGap: number, c: RGB): number {
  const lines = wrapText(text, scale, maxWidth);
  const lh = 7 * scale + lineGap;
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * lh, lines[i], scale, c);
  return y + lines.length * lh;
}
function drawCentred(y: number, text: string, scale: number, c: RGB): void {
  const w = measureText(text, scale);
  drawText(Math.floor((W - w) / 2), y, text, scale, c);
}

// ---------- Layout ----------
function build(): void {
  fillAll(PAPER);

  // Masthead
  fillRect(32, 20, 960, 3, INK);
  drawCentred(34, "THE WORLD IN ONE DAY", 6, INK);
  fillRect(32, 90, 960, 2, INK);
  drawText(32, 102, "WEDNESDAY, 25 NOVEMBER 2026", 2, INK);
  const wr = measureText("WORLD EDITION", 2);
  drawText(992 - wr, 102, "WORLD EDITION", 2, INK);
  fillRect(32, 124, 960, 3, INK);

  // ---- LEAD box 138..400 ----
  drawRect(32, 138, 960, 262, INK);
  drawText(48, 154, "MIDDLE EAST", 2, RED);
  drawWrapped(48, 178, "HOUTHI DRONE HITS RIYADH'S TALLEST TOWER", 3, 592, 3, INK);
  drawWrapped(48, 234, "11 wounded as PIF Tower is struck for a second time in a week, Saudi Civil Defence says", 2, 592, 4, INK);
  let by = 292;
  by = drawWrapped(48, by, "A Houthi drone struck the 385-metre PIF Tower in Riyadh's financial district on Tuesday, wounding 11 people.", 1, 592, 4, INK);
  by = drawWrapped(48, by + 6, "It was the second hit on the same tower in under a week. The Saudi-led coalition called the attack a drone strike and vowed a decisive response.", 1, 592, 4, INK);
  by = drawWrapped(48, by + 6, "The Houthis had not claimed the strike by Tuesday evening.", 1, 592, 4, INK);
  // Skyline, right side of lead box: x 664..976, ground y 372
  // short building left
  fillRect(676, 292, 62, 80, BLUE);
  drawRect(676, 292, 62, 80, INK);
  // PIF Tower (tall)
  fillRect(754, 172, 66, 200, INK);
  fillRect(758, 176, 58, 196, BLUE);
  // tower crown
  drawLine(754, 172, 787, 152, INK);
  drawLine(820, 172, 787, 152, INK);
  // tower windows (paper dots)
  for (let wy = 190; wy < 360; wy += 18)
    for (let wx = 766; wx < 810; wx += 14) fillRect(wx, wy, 6, 8, WHITE);
  // impact burst halfway up tower
  drawCircle(787, 252, 16, RED);
  drawCircle(787, 252, 9, WHITE);
  drawLine(787, 252, 787, 222, RED);
  drawLine(787, 252, 787, 282, RED);
  drawLine(787, 252, 757, 252, RED);
  drawLine(787, 252, 817, 252, RED);
  drawLine(787, 252, 766, 231, RED);
  drawLine(787, 252, 808, 273, RED);
  drawLine(787, 252, 808, 231, RED);
  drawLine(787, 252, 766, 273, RED);
  // short building right
  fillRect(838, 312, 62, 60, BLUE);
  drawRect(838, 312, 62, 60, INK);
  fillRect(916, 332, 52, 40, BLUE);
  drawRect(916, 332, 52, 40, INK);
  // ground line
  fillRect(664, 372, 312, 3, INK);

  // ---- SECOND ROW 412..620 ----
  // vertical divider
  fillRect(511, 412, 2, 208, INK);
  // LEFT
  drawText(48, 426, "UNITED STATES", 2, RED);
  drawWrapped(48, 450, "HUAWEI GUILTY ON 10 OF 12 COUNTS", 2, 452, 4, INK);
  drawWrapped(
    48,
    502,
    "A Brooklyn jury convicted Huawei of bank fraud, sanctions violations over its Iran business and conspiring to steal trade secrets. It acquitted the firm of racketeering. The case began in 2018.",
    2,
    452,
    4,
    INK,
  );
  // RIGHT
  drawText(528, 426, "UNITED STATES", 2, RED);
  drawWrapped(528, 450, "CIA AND ODNI HIT BY CYBER BREACH", 2, 452, 4, INK);
  drawWrapped(
    528,
    502,
    "The CIA and the Office of the Director of National Intelligence suffered a breach exposing some unclassified information, the New York Times reported. Classified systems were unaffected.",
    2,
    452,
    4,
    INK,
  );

  // ---- NUMBERS BAND 632..728 ----
  fillRect(32, 632, 960, 96, INK);
  const nums: Array<[string, string]> = [
    ["11", "WOUNDED IN RIYADH"],
    ["10/12", "HUAWEI COUNTS GUILTY"],
    ["385M", "HEIGHT OF PIF TOWER"],
    ["5.6", "NEPAL QUAKE MAGNITUDE"],
    ["60KM", "HOUTHIS FROM ADEN"],
  ];
  for (let i = 0; i < nums.length; i++) {
    const x = 32 + i * 192 + 14;
    drawText(x, 648, nums[i][0], 3, WHITE);
    drawWrapped(x, 682, nums[i][1], 1, 168, 3, WHITE);
  }

  // ---- THE WORLD IN BRIEF ----
  drawCentred(742, "THE WORLD IN BRIEF", 3, INK);
  fillRect(32, 768, 960, 2, INK);
  const brief: Array<[string, string]> = [
    ["UKRAINE", "Zelenskiy confirms Kyiv's drone hit the Russian ship Sparta II in the Gulf of Finland; Norway urges caution."],
    ["NATO", "Early-warning aircraft planned for Poland; allies vow space defence amid reports of a Russian nuclear satellite."],
    ["NEPAL", "A 5.6-magnitude quake hits Koshi Province near the China border."],
    ["SPORT", "England beat Australia by eight wickets in the second T20I, chasing 185 to level the series."],
    ["USA", "Trump pardons Thanksgiving turkeys Freedom and Feathers; Giuliani receives the Medal of Freedom."],
    ["YEMEN", "Houthi fighters are about 60 km from Aden; government forces say the city will hold."],
    ["EUROPE", "The EU announces fresh sanctions on Russia as the war grinds on."],
    ["ASIA", "India's Sensex drops 1,484 points; the Nifty slips below 25,400."],
  ];
  for (let r = 0; r < 4; r++) {
    const rowY = 778 + r * 49;
    for (let c = 0; c < 2; c++) {
      const item = brief[r * 2 + c];
      const x = c === 0 ? 48 : 528;
      drawText(x, rowY, item[0], 2, RED);
      drawWrapped(x, rowY + 20, item[1], 1, 452, 3, INK);
    }
    if (r < 3) fillRect(32, rowY + 44, 960, 1, INK);
  }
  // vertical divider for brief grid
  fillRect(511, 778, 1, 192, INK);

  // ---- Footer ----
  fillRect(32, 982, 960, 2, INK);
  drawCentred(994, "THE WORLD IN ONE DAY - WEDNESDAY 25 NOVEMBER 2026 - ALL STORIES AS REPORTED ON 25 NOVEMBER 2026", 1, INK);
}

// ---------- PNG encode ----------
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (W * 3 + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function main(): void {
  build();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ? process.env.MAKEFUN_OUTPUT_DIR : "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);
  const sha = crypto.createHash("sha256").update(png).digest("hex");
  console.log(outPath + " " + png.length + " bytes sha256=" + sha);
}

main();

/**
 * Generates placeholder PNG icons for the PWA manifest.
 * Run with: node scripts/generate-icons.mjs
 *
 * Produces a solid dark (#1a1a1a) square at each required size.
 * Replace with a proper branded version before production.
 */
import zlib from "zlib";
import fs from "fs";

function createSolidPNG(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(typeStr, data) {
    const type = Buffer.from(typeStr, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(Buffer.concat([type, data])), 0);
    return Buffer.concat([len, type, data, crcVal]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const scanline = Buffer.alloc(1 + width * 3);
  scanline[0] = 0; // filter: None
  for (let x = 0; x < width; x++) {
    scanline[1 + x * 3] = r;
    scanline[1 + x * 3 + 1] = g;
    scanline[1 + x * 3 + 2] = b;
  }
  const rawData = Buffer.concat(Array(height).fill(scanline));
  const compressed = zlib.deflateSync(rawData);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync("public/icons", { recursive: true });

// ForgeAI dark brand color: #1a1a1a
const [r, g, b] = [26, 26, 26];

fs.writeFileSync("public/icons/icon-192.png", createSolidPNG(192, 192, r, g, b));
fs.writeFileSync("public/icons/icon-512.png", createSolidPNG(512, 512, r, g, b));
fs.writeFileSync("public/icons/apple-touch-icon.png", createSolidPNG(180, 180, r, g, b));

console.log("Icons generated in public/icons/");
console.log("Replace with branded versions before production.");

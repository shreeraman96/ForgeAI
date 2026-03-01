import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const htmlPath = join(__dir, "pitch.html");
const outPath = join(__dir, "..", "public", "forgeai-pitch.pdf");

if (!existsSync(htmlPath)) {
  console.error("pitch.html not found at", htmlPath);
  process.exit(1);
}

console.log("Launching browser...");
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();

const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");
console.log("Loading", fileUrl);
await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 30000 });

// Wait for Google Fonts to load (or time out gracefully)
await new Promise((r) => setTimeout(r, 2000));

console.log("Generating PDF...");
await page.pdf({
  path: outPath,
  format: "A4",
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

await browser.close();
console.log("✓ PDF written to", outPath);

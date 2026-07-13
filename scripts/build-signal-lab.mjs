import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = resolve(projectRoot, "assets");
const characterData = readFileSync(resolve(assetDir, "character-interaction-static.png")).toString("base64");

for (const name of ["signal-lab", "signal-lab-mobile"]) {
  const template = readFileSync(resolve(assetDir, `${name}.template.svg`), "utf8");
  if (!template.includes("{{CHARACTER_DATA}}")) {
    throw new Error(`${name}.template.svg has no character placeholder`);
  }
  writeFileSync(resolve(assetDir, `${name}.svg`), template.replace("{{CHARACTER_DATA}}", characterData));
}

console.log("Built desktop and mobile Signal Lab assets");

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = resolve(projectRoot, "assets");
const characterData = readFileSync(resolve(assetDir, "bocchi-ryo-static.png")).toString("base64");

for (const name of ["research-session", "research-session-mobile"]) {
  const template = readFileSync(resolve(assetDir, `${name}.template.svg`), "utf8");
  const output = template.replace("{{CHARACTER_DATA}}", characterData);
  writeFileSync(resolve(assetDir, `${name}.svg`), output);
}

console.log("Built desktop and mobile research session assets");

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = resolve(projectRoot, "profile-3d-contrib");
const lightSource = readFileSync(resolve(assetDir, "profile-green-animate.svg"), "utf8");
const darkSource = readFileSync(resolve(assetDir, "profile-night-green.svg"), "utf8");

function getAttribute(tag, name) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

function setAttribute(tag, name, value) {
  const pattern = new RegExp(`\\s${name}="[^"]*"`);
  if (pattern.test(tag)) {
    return tag.replace(pattern, ` ${name}="${value}"`);
  }
  return tag.replace(/>$/, ` ${name}="${value}">`);
}

function makeLoopingTag(tag, delay) {
  const values = getAttribute(tag, "values")?.split(";");
  if (!values || values.length < 2) {
    return tag;
  }

  const start = values[0];
  const end = values.at(-1);
  let output = setAttribute(tag, "values", `${start};${end};${end};${start}`);
  output = setAttribute(output, "keyTimes", "0;0.16;0.8;1");
  output = setAttribute(output, "dur", "10.5s");
  output = setAttribute(output, "begin", `${delay}s`);
  output = setAttribute(output, "repeatCount", "indefinite");
  return output;
}

function motionStyles(accent) {
  return `
.activity-camera {
  transform-box: view-box;
  transform-origin: 50% 50%;
  animation: activity-camera 7.5s ease-in-out infinite;
}
.activity-scan {
  fill: none;
  stroke: ${accent};
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 18 56;
  opacity: .32;
  animation: activity-scan 5.8s linear infinite;
}
.activity-orbit {
  fill: none;
  stroke: ${accent};
  stroke-width: 2;
  stroke-dasharray: 8 22;
  opacity: .55;
  transform-box: fill-box;
  transform-origin: center;
  animation: activity-orbit 12s linear infinite;
}
.activity-beacon {
  fill: none;
  stroke: ${accent};
  stroke-width: 3;
  transform-box: fill-box;
  transform-origin: center;
  animation: activity-beacon 2.6s ease-out infinite;
}
@keyframes activity-camera {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes activity-scan { to { stroke-dashoffset: -370; } }
@keyframes activity-orbit { to { transform: rotate(360deg); } }
@keyframes activity-beacon {
  0% { opacity: .9; transform: scale(.65); }
  75%, 100% { opacity: 0; transform: scale(2.2); }
}
@media (prefers-reduced-motion: reduce) {
  .activity-camera { animation: none; }
  .activity-scan, .activity-orbit, .activity-beacon { display: none; }
}`;
}

function buildLoop(themeStyle, accent) {
  let blockIndex = 0;
  let currentDelay = "0";
  let loopedTags = 0;

  let output = lightSource.replace(/<style>[\s\S]*?<\/style>/, `<style>${themeStyle}</style>`);
  output = output.replace(/<(?:animateTransform|animate)\b[^>]*>/g, (tag) => {
    const attributeName = getAttribute(tag, "attributeName");

    if (tag.startsWith("<animateTransform") && attributeName === "transform") {
      currentDelay = ((blockIndex % 14) * 0.11).toFixed(2);
      blockIndex += 1;
      loopedTags += 1;
      return makeLoopingTag(tag, currentDelay);
    }

    if (attributeName === "height") {
      loopedTags += 1;
      return makeLoopingTag(tag, currentDelay);
    }

    if (attributeName === "points") {
      loopedTags += 1;
      return makeLoopingTag(tag, "0.55");
    }

    return tag;
  });

  if (loopedTags === 0) {
    throw new Error("No contribution animations were found in the generated SVG");
  }

  output = output.replace("</style>", `${motionStyles(accent)}</style>`);

  const backgroundEnd = output.indexOf("</rect>") + "</rect>".length;
  if (backgroundEnd < "</rect>".length) {
    throw new Error("Generated SVG has no background rectangle");
  }

  const overlays = [
    '<path class="activity-scan" d="M72 232 C370 410 770 570 1195 781"/>',
    '<path class="activity-scan" d="M120 205 C430 382 830 535 1230 742" style="animation-delay:-2.9s"/>',
    '<circle class="activity-orbit" cx="980" cy="284.5" r="178"/>',
    '<circle class="activity-beacon" cx="1120" cy="741" r="12"/>',
  ].join("");

  output = `${output.slice(0, backgroundEnd)}<g class="activity-camera">${output.slice(backgroundEnd)}`;
  return output.replace("</svg>", `${overlays}</g></svg>`);
}

const darkStyle = darkSource.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const lightStyle = lightSource.match(/<style>([\s\S]*?)<\/style>/)?.[1];

if (!lightStyle || !darkStyle) {
  throw new Error("Unable to read generated SVG theme styles");
}

writeFileSync(resolve(assetDir, "profile-green-loop.svg"), buildLoop(lightStyle, "#2da44e"));
writeFileSync(resolve(assetDir, "profile-night-green-loop.svg"), buildLoop(darkStyle, "#39d353"));

console.log("Built looping light and dark 3D activity assets");

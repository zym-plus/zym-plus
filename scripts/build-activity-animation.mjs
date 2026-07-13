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
  let output = setAttribute(tag, "values", `${start};${end};${end};${start};${start}`);
  output = setAttribute(output, "keyTimes", "0;0.14;0.62;0.78;1");
  output = setAttribute(output, "dur", "9.6s");
  output = setAttribute(output, "begin", `${delay}s`);
  output = setAttribute(output, "repeatCount", "indefinite");
  return output;
}

function motionStyles({ green, blue, pink, ink, muted }) {
  return `
.activity-camera {
  transform-box: view-box;
  transform-origin: 50% 50%;
  animation: activity-camera 8s ease-in-out infinite;
}
.activity-scan {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 16 64;
  opacity: .46;
  animation: activity-scan 6.2s linear infinite;
}
.activity-scan-a { stroke: ${blue}; }
.activity-scan-b { stroke: ${pink}; }
.activity-orbit {
  fill: none;
  stroke-width: 2;
  stroke-dasharray: 8 22;
  opacity: .62;
  transform-box: fill-box;
  transform-origin: center;
  animation: activity-orbit 12s linear infinite;
}
.activity-orbit-a { stroke: ${green}; }
.activity-orbit-b { stroke: ${blue}; animation-direction: reverse; animation-duration: 16s; }
.activity-rail { fill: none; stroke: ${muted}; stroke-width: 1; stroke-dasharray: 3 13; opacity: .45; }
.activity-playhead { fill: ${pink}; stroke: ${ink}; stroke-width: 2; }
.activity-beacon {
  fill: none;
  stroke: ${pink};
  stroke-width: 3;
  transform-box: fill-box;
  transform-origin: center;
  animation: activity-beacon 2.6s ease-out infinite;
}
.activity-label { fill: ${ink}; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 14px; letter-spacing: 0; }
.activity-label-muted { fill: ${muted}; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; letter-spacing: 0; }
.activity-led { fill: ${green}; animation: activity-led 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes activity-camera {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes activity-scan { to { stroke-dashoffset: -480; } }
@keyframes activity-orbit { to { transform: rotate(360deg); } }
@keyframes activity-led { 0%, 100% { opacity: .35; transform: scale(.7); } 50% { opacity: 1; transform: scale(1); } }
@keyframes activity-beacon {
  0% { opacity: .9; transform: scale(.65); }
  75%, 100% { opacity: 0; transform: scale(2.2); }
}
@media (prefers-reduced-motion: reduce) {
  .activity-camera { animation: none; }
  .activity-scan, .activity-orbit, .activity-beacon, .activity-playhead, .activity-led { display: none; }
}`;
}

function buildLoop(themeStyle, colors) {
  let blockIndex = 0;
  let currentDelay = "0";
  let loopedTags = 0;

  let output = lightSource.replace(/<style>[\s\S]*?<\/style>/, `<style>${themeStyle}</style>`);
  output = output.replace(/<(?:animateTransform|animate)\b[^>]*>/g, (tag) => {
    const attributeName = getAttribute(tag, "attributeName");

    if (tag.startsWith("<animateTransform") && attributeName === "transform") {
      currentDelay = ((blockIndex % 18) * 0.09).toFixed(2);
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

  output = output.replace("</style>", `${motionStyles(colors)}</style>`);

  const backgroundEnd = output.indexOf("</rect>") + "</rect>".length;
  if (backgroundEnd < "</rect>".length) {
    throw new Error("Generated SVG has no background rectangle");
  }

  const overlays = [
    '<g transform="translate(42 34)"><circle class="activity-led" cx="4" cy="-4" r="4"/><text class="activity-label" x="18" y="0">LIVE SIGNAL / 365 DAYS</text><text class="activity-label-muted" x="18" y="19">AUTO-REFRESHED CONTRIBUTION STAGE</text></g>',
    '<path class="activity-rail" d="M72 232 C370 410 770 570 1195 781"/>',
    '<path class="activity-scan activity-scan-a" d="M72 232 C370 410 770 570 1195 781"/>',
    '<path class="activity-scan activity-scan-b" d="M120 205 C430 382 830 535 1230 742" style="animation-delay:-3.1s"/>',
    '<circle class="activity-playhead" r="7"><animateMotion path="M72 232 C370 410 770 570 1195 781" dur="6.2s" repeatCount="indefinite"/></circle>',
    '<circle class="activity-orbit activity-orbit-a" cx="980" cy="284.5" r="178"/>',
    '<circle class="activity-orbit activity-orbit-b" cx="980" cy="284.5" r="164"/>',
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

writeFileSync(resolve(assetDir, "profile-green-loop.svg"), buildLoop(lightStyle, {
  green: "#2da44e",
  blue: "#2f81f7",
  pink: "#d6578b",
  ink: "#1f2328",
  muted: "#59636e",
}));
writeFileSync(resolve(assetDir, "profile-night-green-loop.svg"), buildLoop(darkStyle, {
  green: "#3fb950",
  blue: "#58a6ff",
  pink: "#ff7eb6",
  ink: "#f0f6fc",
  muted: "#9da7b3",
}));

console.log("Built looping light and dark 3D activity assets");

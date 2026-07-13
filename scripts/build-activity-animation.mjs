import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = resolve(projectRoot, "profile-3d-contrib");
const lightSource = readFileSync(resolve(assetDir, "profile-green-animate.svg"), "utf8");
const darkSource = readFileSync(resolve(assetDir, "profile-night-green.svg"), "utf8");

function stripAuxiliaryCharts(source) {
  const radarStart = source.indexOf('<g transform="translate(980, 284.5)">');
  const languageStart = source.indexOf('<g transform="translate(40, 520)">');
  const statsStart = source.indexOf('<g><text style="font-size: 32px; font-weight: bold;" x="384"');

  if (radarStart < 0 || languageStart < 0 || statsStart < 0) {
    throw new Error("Unable to isolate the contribution stage from auxiliary charts");
  }

  return source.slice(0, radarStart) + source.slice(statsStart);
}

const stageSource = stripAuxiliaryCharts(lightSource);

function readFact(pattern, label) {
  const value = lightSource.match(pattern)?.[1];
  if (!value) {
    throw new Error(`Unable to read ${label} from the generated activity SVG`);
  }
  return value;
}

const activityFacts = {
  commits: readFact(/>Commit<title>(\d+)<\/title>/, "commit count"),
  repos: readFact(/>Repo<title>(\d+)<\/title>/, "repository count"),
  language: readFact(/<title>([A-Za-z+#.-]+) \d+<\/title>/, "primary language"),
};

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

function motionStyles({ green, blue, pink, acid, yellow, ink, muted, deck }) {
  return `
.activity-camera {
  transform-box: view-box;
  transform-origin: 50% 50%;
  animation: activity-camera 9s ease-in-out infinite;
}
.activity-scan {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 11 44;
  opacity: .7;
  animation: activity-scan 6.2s linear infinite;
}
.activity-scan-a { stroke: ${blue}; }
.activity-scan-b { stroke: ${pink}; }
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
.activity-deck { fill: ${deck}; }
.activity-acid { fill: ${acid}; }
.activity-yellow { fill: ${yellow}; }
.activity-blue { fill: ${blue}; }
.activity-pink { fill: ${pink}; }
.activity-ghost { fill: ${ink}; opacity: .055; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 92px; font-weight: 800; letter-spacing: 0; }
.activity-number { fill: ${ink}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 48px; font-weight: 800; letter-spacing: 0; }
.activity-rule-blue { stroke: ${blue}; }
.activity-rule-pink { stroke: ${pink}; }
.activity-rule-acid { stroke: ${acid}; }
.activity-meter { animation: activity-meter 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }
.activity-meter-b { animation-delay: -.32s; }
.activity-meter-c { animation-delay: -.67s; }
.activity-meter-d { animation-delay: -.96s; }
@keyframes activity-camera {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes activity-scan { to { stroke-dashoffset: -480; } }
@keyframes activity-led { 0%, 100% { opacity: .35; transform: scale(.7); } 50% { opacity: 1; transform: scale(1); } }
@keyframes activity-meter { 0%, 100% { transform: scaleY(.28); } 42% { transform: scaleY(1); } 74% { transform: scaleY(.56); } }
@keyframes activity-beacon {
  0% { opacity: .9; transform: scale(.65); }
  75%, 100% { opacity: 0; transform: scale(2.2); }
}
@media (prefers-reduced-motion: reduce) {
  .activity-camera { animation: none; }
  .activity-scan, .activity-beacon, .activity-playhead, .activity-led { display: none; }
  .activity-meter { animation: none; }
}`;
}

function buildLoop(themeStyle, colors) {
  let blockIndex = 0;
  let currentDelay = "0";
  let loopedTags = 0;

  let output = stageSource.replace(/<style>[\s\S]*?<\/style>/, `<style>${themeStyle}</style>`);
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
    '<rect class="activity-blue" x="0" y="0" width="14" height="850"/>',
    '<g transform="translate(42 39)"><rect class="activity-acid" x="0" y="-19" width="206" height="26"/><text x="10" y="0" fill="#17181a" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="13" font-weight="700">LIVE TAKE / ACTIVITY IN 3D</text><circle class="activity-led" cx="228" cy="-7" r="5"/><text class="activity-label-muted" x="244" y="-3">REC / 365 DAYS</text></g>',
    '<text class="activity-ghost" x="1220" y="134" text-anchor="end">ACTIVITY</text>',
    '<text class="activity-label-muted" x="1218" y="158" text-anchor="end">GITHUB CONTRIBUTION HISTORY / AUTO REFRESHED</text>',
    `<g transform="translate(790 208)"><text class="activity-label" x="0" y="0">SESSION NOTES / CURRENT TAKE</text><g transform="translate(0 29)"><path class="activity-rule-blue" d="M0 0V70" stroke-width="4"/><text class="activity-number" x="18" y="42">${activityFacts.commits}</text><text class="activity-label-muted" x="18" y="66">COMMITS</text></g><g transform="translate(145 29)"><path class="activity-rule-pink" d="M0 0V70" stroke-width="4"/><text class="activity-number" x="18" y="42">${activityFacts.repos}</text><text class="activity-label-muted" x="18" y="66">REPOSITORIES</text></g><g transform="translate(290 29)"><path class="activity-rule-acid" d="M0 0V70" stroke-width="4"/><text class="activity-number" x="18" y="42" style="font-size:32px">${activityFacts.language}</text><text class="activity-label-muted" x="18" y="66">PRIMARY LANGUAGE</text></g></g>`,
    '<path class="activity-rail" d="M72 232 C370 410 770 570 1195 781"/>',
    '<path class="activity-scan activity-scan-a" d="M72 232 C370 410 770 570 1195 781"/>',
    '<path class="activity-scan activity-scan-b" d="M120 205 C430 382 830 535 1230 742" style="animation-delay:-3.1s"/>',
    '<circle class="activity-playhead" r="7"><animateMotion path="M72 232 C370 410 770 570 1195 781" dur="6.2s" repeatCount="indefinite"/></circle>',
    '<circle class="activity-beacon" cx="1120" cy="741" r="12"/>',
    '<g transform="translate(48 720)"><text class="activity-label" x="0" y="0">SIDE A / CONSISTENCY OVER NOISE</text><text class="activity-label-muted" x="0" y="21">EACH COLUMN RISES, HOLDS, AND RETURNS FOR THE NEXT TAKE</text><g transform="translate(0 39)"><rect class="activity-acid activity-meter" x="0" y="0" width="10" height="34"/><rect class="activity-pink activity-meter activity-meter-b" x="17" y="0" width="10" height="34"/><rect class="activity-blue activity-meter activity-meter-c" x="34" y="0" width="10" height="34"/><rect class="activity-yellow activity-meter activity-meter-d" x="51" y="0" width="10" height="34"/></g></g>',
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
  blue: "#2457ff",
  pink: "#f4518b",
  acid: "#c6ef42",
  yellow: "#ffc857",
  ink: "#17181a",
  muted: "#59636e",
  deck: "#17181a",
}));
writeFileSync(resolve(assetDir, "profile-night-green-loop.svg"), buildLoop(darkStyle, {
  green: "#3fb950",
  blue: "#5b8cff",
  pink: "#ff78aa",
  acid: "#d7f75b",
  yellow: "#ffd166",
  ink: "#f0f6fc",
  muted: "#9da7b3",
  deck: "#161b22",
}));

console.log("Built looping light and dark 3D activity assets");

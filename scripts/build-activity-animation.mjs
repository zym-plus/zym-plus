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

const stageSource = stripAuxiliaryCharts(lightSource).replace(
  /<text style="font-size: 16px;" x="1260"[^>]*>[^<]*<\/text>/,
  "",
);

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

const dateRange = lightSource.match(/(\d{4}-\d{2}-\d{2}) \/ (\d{4}-\d{2}-\d{2})/);
if (!dateRange) {
  throw new Error("Unable to read the activity date range");
}
activityFacts.startDate = dateRange[1];
activityFacts.endDate = dateRange[2];

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

function makeReplayTag(tag, progress) {
  const values = getAttribute(tag, "values")?.split(";");
  if (!values || values.length < 2) {
    return tag;
  }

  const start = values[0];
  const end = values.at(-1);
  const riseStart = 0.08 + progress * 0.66;
  const riseEnd = Math.min(riseStart + 0.035, 0.79);
  let output = setAttribute(tag, "values", `${start};${start};${end};${end};${start};${start}`);
  output = setAttribute(output, "keyTimes", `0;${riseStart.toFixed(3)};${riseEnd.toFixed(3)};0.84;0.91;1`);
  output = setAttribute(output, "dur", "12s");
  output = setAttribute(output, "begin", "0s");
  output = setAttribute(output, "repeatCount", "indefinite");
  return output;
}

function motionStyles({ green, blue, pink, acid, ink, muted }) {
  return `
.activity-label { fill: ${ink}; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 14px; letter-spacing: 0; }
.activity-label-muted { fill: ${muted}; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; letter-spacing: 0; }
.activity-led { fill: ${green}; }
.activity-acid { fill: ${acid}; }
.activity-blue { fill: ${blue}; }
.activity-pink { fill: ${pink}; }
.activity-ghost { fill: ${ink}; opacity: .055; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 92px; font-weight: 800; letter-spacing: 0; }
.activity-number { fill: ${ink}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 48px; font-weight: 800; letter-spacing: 0; }
.activity-rule-blue { stroke: ${blue}; }
.activity-rule-pink { stroke: ${pink}; }
.activity-rule-acid { stroke: ${acid}; }
.activity-progress-bg { fill: ${muted}; opacity: .2; }
.activity-progress-live { fill: ${blue}; }
.activity-week-plane { fill: ${pink}; fill-opacity: .12; stroke: ${pink}; stroke-width: 2; }
.activity-week-line { stroke: ${pink}; stroke-width: 3; }
.activity-cursor-dot { fill: ${pink}; stroke: ${ink}; stroke-width: 2; }
.activity-legend-box { stroke: ${muted}; stroke-width: 1; }
@media (prefers-reduced-motion: reduce) {
  .activity-week-cursor, .activity-progress-live { display: none; }
}`;
}

function buildLoop(themeStyle, colors) {
  const replayBlocks = [...stageSource.matchAll(/<animateTransform\b[^>]*>/g)]
    .filter(([tag]) => getAttribute(tag, "attributeName") === "transform").length;
  let blockIndex = 0;
  let currentProgress = 0;
  let loopedTags = 0;

  let output = stageSource.replace(/<style>[\s\S]*?<\/style>/, `<style>${themeStyle}</style>`);
  output = output.replace(/<(?:animateTransform|animate)\b[^>]*>/g, (tag) => {
    const attributeName = getAttribute(tag, "attributeName");

    if (tag.startsWith("<animateTransform") && attributeName === "transform") {
      currentProgress = replayBlocks <= 1 ? 0 : blockIndex / (replayBlocks - 1);
      blockIndex += 1;
      loopedTags += 1;
      return makeReplayTag(tag, currentProgress);
    }

    if (attributeName === "height") {
      loopedTags += 1;
      return makeReplayTag(tag, currentProgress);
    }

    return tag;
  });

  if (loopedTags === 0) {
    throw new Error("No contribution animations were found in the generated SVG");
  }

  output = output.replace("</style>", `${motionStyles(colors)}</style>`);

  const overlays = [
    '<rect class="activity-blue" x="0" y="0" width="14" height="850"/>',
    '<g transform="translate(42 39)"><rect class="activity-acid" x="0" y="-19" width="242" height="26"/><text x="10" y="0" fill="#17181a" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="13" font-weight="700">365-DAY CONTRIBUTION REPLAY</text><circle class="activity-led" cx="264" cy="-7" r="5"/><text class="activity-label-muted" x="280" y="-3">SOURCE / GITHUB</text></g>',
    '<text class="activity-ghost" x="1220" y="134" text-anchor="end">ACTIVITY</text>',
    '<text class="activity-label-muted" x="1218" y="158" text-anchor="end">ACTUAL CONTRIBUTION DAYS / CHRONOLOGICAL PLAYBACK</text>',
    `<g transform="translate(42 82)"><text class="activity-label-muted" x="0" y="0">${activityFacts.startDate}</text><text class="activity-label-muted" x="1116" y="0" text-anchor="end">${activityFacts.endDate}</text><rect class="activity-progress-bg" x="0" y="14" width="1116" height="4"/><rect class="activity-progress-live" x="0" y="14" width="0" height="4"><animate attributeName="width" values="0;0;1116;1116;0" keyTimes="0;0.08;0.78;0.91;1" dur="12s" repeatCount="indefinite"/></rect><circle class="activity-pink activity-progress-live" cx="0" cy="16" r="6"><animateTransform attributeName="transform" type="translate" values="0 0;0 0;1116 0;1116 0;0 0" keyTimes="0;0.08;0.78;0.91;1" dur="12s" repeatCount="indefinite"/></circle><text class="activity-label-muted" x="0" y="40">WEEK 01 / OLDEST</text><text class="activity-label-muted" x="1116" y="40" text-anchor="end">WEEK 53 / LATEST</text></g>`,
    `<g transform="translate(790 208)"><text class="activity-label" x="0" y="0">SESSION NOTES / CURRENT TAKE</text><g transform="translate(0 29)"><path class="activity-rule-blue" d="M0 0V70" stroke-width="4"/><text class="activity-number" x="18" y="42">${activityFacts.commits}</text><text class="activity-label-muted" x="18" y="66">COMMITS</text></g><g transform="translate(145 29)"><path class="activity-rule-pink" d="M0 0V70" stroke-width="4"/><text class="activity-number" x="18" y="42">${activityFacts.repos}</text><text class="activity-label-muted" x="18" y="66">REPOSITORIES</text></g><g transform="translate(290 29)"><path class="activity-rule-acid" d="M0 0V70" stroke-width="4"/><text class="activity-number" x="18" y="42" style="font-size:32px">${activityFacts.language}</text><text class="activity-label-muted" x="18" y="66">PRIMARY LANGUAGE</text></g></g>`,
    '<g class="activity-week-cursor" opacity="0"><path class="activity-week-plane" d="M148 137L9 217L9 229L148 149Z"/><path class="activity-week-line" d="M148 137L9 217"/><circle class="activity-cursor-dot" cx="79" cy="177" r="7"/><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.07;0.79;0.9;1" dur="12s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 0;1040 600;1040 600;0 0" keyTimes="0;0.08;0.78;0.91;1" dur="12s" repeatCount="indefinite"/></g>',
    '<g transform="translate(48 700)"><text class="activity-label" x="0" y="0">CONTRIBUTION INTENSITY</text><text class="activity-label-muted" x="0" y="22">LESS</text><rect class="cont-top-0 activity-legend-box" x="42" y="9" width="18" height="18"/><rect class="cont-top-1 activity-legend-box" x="67" y="9" width="18" height="18"/><rect class="cont-top-2 activity-legend-box" x="92" y="9" width="18" height="18"/><rect class="cont-top-3 activity-legend-box" x="117" y="9" width="18" height="18"/><rect class="cont-top-4 activity-legend-box" x="142" y="9" width="18" height="18"/><text class="activity-label-muted" x="171" y="22">MORE</text><text class="activity-label" x="0" y="58">REPLAY ORDER / OLDEST WEEK -&gt; LATEST WEEK</text><text class="activity-label-muted" x="0" y="80">CLICK THE STAGE TO OPEN THE SOURCE ACTIVITY</text></g>',
  ].join("");

  return output.replace("</svg>", `${overlays}</svg>`);
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

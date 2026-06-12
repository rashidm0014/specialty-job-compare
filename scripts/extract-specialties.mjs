import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function extractConst(name) {
  const re = new RegExp(`const\\s+${name}\\s*=`);
  const m = html.match(re);
  if (!m) throw new Error(`Failed to find ${name}`);
  const start = m.index;
  let i = start + m[0].length;
  while (html[i] === " ") i++;
  const open = html[i];
  if (open !== "{" && open !== "[") throw new Error(`Unexpected start for ${name}`);
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        const expr = html.slice(start + m[0].length, i + 1).trim();
        return Function(`"use strict"; return (${expr});`)();
      }
    }
  }
  throw new Error(`Unterminated ${name}`);
}

const SPECIALTIES = extractConst("SPECIALTIES");
const EXPANDED_QUESTIONS = extractConst("EXPANDED_QUESTIONS");
const SCORING_CONTEXT = extractConst("SCORING_CONTEXT");

const dir = path.join(root, "data", "specialties");
fs.mkdirSync(dir, { recursive: true });

const index = {};
for (const [key, spec] of Object.entries(SPECIALTIES)) {
  index[key] = {
    key,
    name: spec.name,
    emoji: spec.emoji,
    tag: spec.tag,
    checklistCount: spec.checklist.length,
    volumeCount: spec.volume.length,
  };
  const payload = {
    ...spec,
    expandedQuestions: EXPANDED_QUESTIONS[key] || {},
    scoringContext: SCORING_CONTEXT[key] || {},
  };
  fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(payload, null, 2));
}

fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index, null, 2));
console.log(`Extracted ${Object.keys(SPECIALTIES).length} specialties to ${dir}`);

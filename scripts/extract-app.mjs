import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const scriptStart = html.indexOf("<script>\n");
const scriptEnd = html.indexOf("</script>", scriptStart);
let js = html.slice(scriptStart + "<script>\n".length, scriptEnd);

const removeBlocks = [
  /const SPECIALTIES=\{[\s\S]*?\};\n/,
  /const EXPANDED_QUESTIONS = \{[\s\S]*?\};\n/,
  /const SCORING_CONTEXT = \{[\s\S]*?\};\n/,
  /function installServiceWorker\(\)\{[\s\S]*?\}\n/,
  /function safeStorageGet\(key\)\{[\s\S]*?\}\n/,
  /function safeStorageSet\(key,value\)\{[\s\S]*?\}\n/,
  /\/\* Phase 1 UI layer: phase1\.js \*\/\n\n/,
];

for (const re of removeBlocks) {
  js = js.replace(re, "");
}

const patches = [
  [
    'function cleanState(s){s=cleanPlainObject(s); const out={version:APP_VERSION,settings:{autosave:true,history:true,encryption:false,...cleanPlainObject(s.settings)},data:{}}; out.settings.autosave=!!out.settings.autosave; out.settings.history=!!out.settings.history; out.settings.encryption=!!out.settings.encryption; const data=cleanPlainObject(s.data); for(const key of Object.keys(SPECIALTIES)){',
    'async function cleanState(s){s=cleanPlainObject(s); const out={version:APP_VERSION,settings:{autosave:true,history:true,encryption:false,...cleanPlainObject(s.settings)},data:{}}; out.settings.autosave=!!out.settings.autosave; out.settings.history=!!out.settings.history; out.settings.encryption=!!out.settings.encryption; const data=cleanPlainObject(s.data); const keys=Object.keys(SPECIALTY_INDEX||{}); await ensureSpecialtiesLoaded(keys); for(const key of keys){',
  ],
  [
    'function renderHome(){const g=$("specialtyGrid"); clear(g); Object.entries(SPECIALTIES).forEach(([key,s])=>{',
    'function renderHome(){const g=$("specialtyGrid"); clear(g); Object.entries(SPECIALTY_INDEX||{}).forEach(([key,s])=>{',
  ],
  [
    'function openSpecialty(key){currentSpec=key;',
    'async function openSpecialty(key){await loadSpecialty(key); currentSpec=key;',
  ],
  [
    'if(safeStorageSet(STORE,text)) setStatus("Saved","saved");',
    'if(await appStorageSet(STORE,text)) setStatus("Saved","saved");',
  ],
  [
    'async function load(){const raw=safeStorageGet(STORE);',
    'async function load(){const raw=await appStorageGet(STORE);',
  ],
  [
    'async function init(){bindEvents(); renderHome(); await load(); renderHome(); if(currentSpec){applySpecTheme(); render({all:true});} installServiceWorker();}',
    'async function init(){bindEvents(); await loadSpecialtyIndex(); renderHome(); await load(); renderHome(); if(currentSpec){await loadSpecialty(currentSpec); if(typeof applySpecTheme==="function") applySpecTheme(); render({all:true});} registerServiceWorker();}',
  ],
  [
    'async function importData(file){try{const text=await file.text(); const parsed=JSON.parse(text,(k,v)=>forbiddenKeys.has(k)?undefined:v); if(!await validatePackage(parsed)) throw new Error("Invalid or corrupted import package"); const imported=cleanState(parsed.payload.state);',
    'async function importData(file){try{const text=await file.text(); const parsed=JSON.parse(text,(k,v)=>forbiddenKeys.has(k)?undefined:v); if(!await validatePackage(parsed)) throw new Error("Invalid or corrupted import package"); const imported=await cleanState(parsed.payload.state);',
  ],
];

for (const [from, to] of patches) {
  if (!js.includes(from)) {
    console.warn("Patch not applied:", from.slice(0, 60));
  }
  js = js.replace(from, to);
}

const header = `"use strict";
/* Core app logic — Phase 2 split from index.html */
`;

const footer = `
window.init = init;
window.bindEvents = bindEvents;
`;

fs.writeFileSync(path.join(root, "app.js"), header + js.trim() + footer);
console.log("Wrote app.js (" + (header.length + js.length) + " chars)");

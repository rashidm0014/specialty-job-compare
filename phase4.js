/* Phase 4: Premium polish — comp trust, red flags, offer diff, negotiation letter, a11y, PWA install */
(function () {
  "use strict";

  const LEAD_DIFF_FIELDS = [
    ["baseSalary", "Base salary", (v) => money(v)],
    ["signOn", "Sign-on bonus", (v) => money(v)],
    ["wrvuRate", "Productivity rate", (v) => (v ? "$" + v + "/unit" : "TBD")],
    ["wrvuThreshold", "Productivity threshold", (v) => num(v)],
    ["expectedWrvu", "Expected productivity", (v) => num(v)],
    ["callPay", "Call pay", (v) => money(v)],
    ["call", "Call burden", (v) => String(v || "TBD")],
    ["appAnnualComp", "APP supervision pay", (v) => money(v)],
    ["qualityBonusExpected", "Quality bonus expected", (v) => money(v)],
    ["equityAnnualIncome", "Ancillary/equity income", (v) => money(v)],
    ["status", "Status", (v) => String(v || "TBD")],
    ["compModel", "Comp model", (v) => String(v || "TBD")],
  ];

  const SCORE_KEYS = ["clinicalFit", "compFit", "lifestyleFit", "riskFit", "strategicFit", "collabFit"];

  const _setStatus = window.setStatus || function () {};
  const _toast = window.toast || function () {};
  const _trackChange = window.trackChange;
  const _renderScoreInputs = window.renderScoreInputs;
  const _openLead = window.openLead;
  const _openSettings = window.openSettings;
  const _openBenchmark = window.openBenchmark;
  const _closeModal = window.closeModal;

  let deferredInstall = null;
  let focusTrapCleanup = null;

  function diffLeadFields(beforeJson, afterLead) {
    let before = {};
    try {
      before = beforeJson ? JSON.parse(beforeJson) : {};
    } catch {
      before = {};
    }
    const diffs = [];
    LEAD_DIFF_FIELDS.forEach(([key, label, fmt]) => {
      const from = before[key];
      const to = afterLead[key];
      if (from !== to) {
        diffs.push({ field: label, from: fmt(from), to: fmt(to) });
      }
    });
    SCORE_KEYS.forEach((key) => {
      if (before[key] !== afterLead[key]) {
        diffs.push({ field: key.replace("Fit", " fit"), from: String(before[key] ?? "—"), to: String(afterLead[key] ?? "—") });
      }
    });
    return diffs;
  }

  function collectRedFlags(l) {
    const flags = [];
    const [bt, btxt] = typeof benchmarkTone === "function" ? benchmarkTone(l) : ["neutral", ""];
    const [rt, rtxt] = typeof riskTone === "function" ? riskTone(l) : ["neutral", ""];
    if (bt === "bad" || bt === "warn") flags.push({ level: bt === "bad" ? "high" : "medium", text: (l.name || "Lead") + ": " + btxt });
    if (rt === "bad" || rt === "warn") flags.push({ level: rt === "bad" ? "high" : "medium", text: (l.name || "Lead") + ": " + rtxt });
    if (l.hasAppSupervision && !l.appAnnualComp) flags.push({ level: "high", text: (l.name || "Lead") + ": APP supervision without documented pay" });
    if (l.hasAppSupervision && String(l.appCompModel).toLowerCase().includes("uncompensated")) flags.push({ level: "high", text: (l.name || "Lead") + ": APP supervision marked uncompensated" });
    if (l.hasQualityBonus && String(l.qualityDifficulty).toLowerCase().includes("unclear")) flags.push({ level: "medium", text: (l.name || "Lead") + ": Quality bonus formula unclear" });
    if (l.hasQualityBonus && !l.qualityBonusExpected) flags.push({ level: "medium", text: (l.name || "Lead") + ": Quality bonus expected payout missing" });
    if (l.riskFit <= 4) flags.push({ level: "high", text: (l.name || "Lead") + ": Contract risk score ≤ 4/10" });
    if (l.call === "Heavy" && !l.callPay) flags.push({ level: "medium", text: (l.name || "Lead") + ": Heavy call without stipend estimate" });
    return flags;
  }

  function unansweredDiligence(l) {
    const grouped = EXPANDED_QUESTIONS[currentSpec] || {};
    const out = [];
    Object.entries(grouped).forEach(([group, qs]) => {
      (Array.isArray(qs) ? qs : []).forEach((q) => {
        const key = questionKey(group, q);
        if (!String(l.diligence?.[key] || "").trim()) out.push({ group, question: q });
      });
    });
    return out;
  }

  function allUnansweredDiligence(leads) {
    const map = new Map();
    leads.forEach((l) => {
      unansweredDiligence(l).forEach((item) => {
        const k = item.group + "||" + item.question;
        if (!map.has(k)) map.set(k, { group: item.group, question: item.question, leads: [] });
        map.get(k).leads.push(l.name || "Untitled");
      });
    });
    return [...map.values()];
  }

  function checklistProgress(l) {
    const items = SPECIALTIES[currentSpec]?.checklist || [];
    const answered = Object.values(l.checklist || {}).filter((v) => v === "Yes" || v === "No").length;
    const yes = Object.values(l.checklist || {}).filter((v) => v === "Yes").length;
    return { total: items.length, answered, yes };
  }

  function benchmarkBarPct(l) {
    const b = bestBenchmark(l);
    if (!b || !b.compP50) return null;
    const t = typeof recurringComp === "function" ? recurringComp(l) : total(l);
    const pct = Math.round((t / b.compP50) * 100);
    return Math.max(0, Math.min(140, pct));
  }

  function suggestedClinicalFit(l) {
    const { total: n, yes } = checklistProgress(l);
    if (!n) return 5;
    const ratio = yes / n;
    if (ratio >= 0.75) return 8;
    if (ratio >= 0.5) return 6;
    if (ratio >= 0.25) return 4;
    return 3;
  }

  function buildNegotiationLetter(leadId) {
    const leads = specState().leads;
    const l = leadId ? leads.find((x) => x.id === leadId) : [...leads].sort((a, b) => score(b) - score(a))[0];
    if (!l) return "";
    const spec = SPECIALTIES[currentSpec] || {};
    const gaps = unansweredDiligence(l);
    const flags = collectRedFlags(l).filter((f) => f.text.startsWith(l.name || "Lead"));
    const lines = [];
    lines.push("Subject: Follow-up on " + (spec.name || "specialty") + " opportunity — " + (l.name || "position"));
    lines.push("");
    lines.push("Dear [Recruiter / Hiring Leader],");
    lines.push("");
    lines.push(
      "Thank you for sharing details regarding the " +
        (l.location || "[location]") +
        " opportunity. I am continuing diligence on compensation structure, clinical model fit, and contract terms before proceeding."
    );
    lines.push("");
    lines.push("Based on my structured comparison notes:");
    lines.push("• Estimated annual recurring compensation: " + money(typeof recurringComp === "function" ? recurringComp(l) : total(l)));
    if (l.signOn) lines.push("• Sign-on bonus (one-time): " + money(l.signOn));
    lines.push("• Overall fit score (my assessment): " + score(l) + "/100");
    const b = bestBenchmark(l);
    if (b?.compP50) lines.push("• Versus my licensed benchmark median (" + b.region + "): " + benchmarkSummary(l));
    lines.push("");
    if (flags.length) {
      lines.push("Items I would like clarified before acceptance:");
      flags.forEach((f) => lines.push("• " + f.text.replace((l.name || "Lead") + ": ", "")));
      lines.push("");
    }
    if (gaps.length) {
      lines.push("Outstanding diligence questions:");
      gaps.slice(0, 12).forEach((g) => lines.push("• [" + g.group + "] " + g.question));
      if (gaps.length > 12) lines.push("• …and " + (gaps.length - 12) + " additional documented questions in my workspace.");
      lines.push("");
    }
    lines.push("I would appreciate written confirmation on the above so I can review with counsel. Thank you for your time.");
    lines.push("");
    lines.push("Sincerely,");
    lines.push("[Your name]");
    lines.push("");
    lines.push("— Generated by Specialty Job Compare. Estimates only; not legal advice.");
    return lines.join("\n");
  }

  function copyNegotiationLetter(leadId) {
    const text = buildNegotiationLetter(leadId);
    navigator.clipboard?.writeText(text).then(
      () => toast("Negotiation letter copied to clipboard.", "success"),
      () => {
        const ta = e("textarea", { value: text });
        document.body.append(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast("Negotiation letter copied.", "success");
      }
    );
  }

  function setSaveProgress(pct, label) {
    const bar = $("saveProgressBar");
    const fill = $("saveProgressFill");
    if (bar) bar.hidden = pct <= 0 || pct >= 100;
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
    if (label) _setStatus(label, pct >= 100 ? "saved" : "saving");
  }

  function toast(msg, type) {
    const t = $("toast");
    if (!t) return _toast(msg);
    const icons = { success: "✓", error: "!", info: "i", saved: "✓" };
    clear(t);
    t.append(
      e("span", { className: "toast-icon", textContent: icons[type] || icons.info }),
      e("span", { className: "toast-text", textContent: msg })
    );
    t.className = "toast show" + (type ? " toast-" + type : "");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove("show"), 3500);
  }

  function setStatus(txt, cls) {
    _setStatus(txt, cls);
    const pill = $("saveStatus");
    if (!pill) return;
    if (cls === "saving") setSaveProgress(35, txt);
    else if (cls === "saved") {
      setSaveProgress(100, txt);
      setTimeout(() => setSaveProgress(0), 600);
    } else if (cls === "error") setSaveProgress(0);
  }

  function trapFocus(container) {
    if (focusTrapCleanup) focusTrapCleanup();
    const focusable = () =>
      [...container.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(
        (el) => !el.hidden && !el.disabled
      );
    const onKey = (ev) => {
      if (ev.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKey);
    focusTrapCleanup = () => container.removeEventListener("keydown", onKey);
    const nodes = focusable();
    if (nodes[0]) nodes[0].focus();
  }

  function watchModals() {
    const observer = new MutationObserver(() => {
      const open = document.querySelector(".backdrop.open .modal");
      if (open) trapFocus(open);
      else if (focusTrapCleanup) focusTrapCleanup();
    });
    document.querySelectorAll(".backdrop").forEach((b) => observer.observe(b, { attributes: true, attributeFilter: ["class"] }));
  }

  function setupPwaInstall() {
    window.addEventListener("beforeinstallprompt", (ev) => {
      ev.preventDefault();
      deferredInstall = ev;
      const btn = $("pwaInstallBtn");
      if (btn) btn.hidden = false;
    });
    $("pwaInstallBtn")?.addEventListener("click", async () => {
      if (!deferredInstall) {
        toast("Use your browser menu → Install app, or Add to Home Screen.", "info");
        return;
      }
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      $("pwaInstallBtn").hidden = true;
    });
  }

  function injectPwaInstallBtn() {
    if ($("pwaInstallBtn")) return;
    const hero = document.querySelector(".homeHero .hero-btns");
    if (!hero) return;
    hero.append(
      e("button", {
        className: "btn btn-ghost",
        type: "button",
        id: "pwaInstallBtn",
        hidden: true,
        textContent: "Install app",
      })
    );
  }

  function trackChange(l, summary) {
    if (!state.settings.history) return;
    const before = lastSnapshot[l.id];
    const after = JSON.stringify(l);
    if (before && before === after && summary === "Lead updated") return;
    const diffs = diffLeadFields(before, l);
    const entry = {
      at: new Date().toLocaleString(),
      leadId: l.id,
      lead: l.name || "Untitled",
      summary: sanitize(summary, 1000),
      diffs,
    };
    if (diffs.length) entry.summary = diffs.length + " field" + (diffs.length === 1 ? "" : "s") + " changed";
    specState().history.push(entry);
    specState().history = specState().history.slice(-500);
    lastSnapshot[l.id] = after;
  }

  function applySuggestedFitScores(l) {
    const clinical = suggestedClinicalFit(l);
    const inp = $("clinicalFit");
    const val = $("clinicalFitValue");
    if (inp) {
      inp.value = String(clinical);
      inp.setAttribute("aria-valuetext", "clinicalFit " + clinical + " out of 10");
      if (val) val.textContent = String(clinical);
    }
    toast("Applied checklist-informed clinical fit: " + clinical + "/10", "success");
  }

  function renderScoreInputs(l) {
    document.querySelector("#leadForm .fit-actions")?.remove();
    _renderScoreInputs(l);
    const hint = suggestedClinicalFit(l);
    const grid = $("scoreGrid");
    if (!grid) return;
    grid.before(
      e("div", { className: "fit-actions" }, [
        e("p", {
          className: "fit-hint muted-copy",
          textContent:
            "Checklist-informed clinical fit suggestion: " +
            hint +
            "/10 (based on confirmed checklist items). Scores remain your manual assessment.",
        }),
        e("button", {
          className: "btn",
          type: "button",
          textContent: "Apply checklist suggestion",
          onclick: () => applySuggestedFitScores(l),
        }),
      ])
    );
    SCORE_META.forEach(([key]) => {
      const inp = $(key);
      const val = $(key + "Value");
      if (!inp || !val) return;
      inp.setAttribute("aria-valuetext", key + " " + inp.value + " out of 10");
      inp.addEventListener(
        "input",
        () => {
          val.textContent = inp.value;
          inp.setAttribute("aria-valuetext", key + " " + inp.value + " out of 10");
        },
        { signal }
      );
    });
  }

  function compareWinnerIcon(label, value, allValues) {
    const raw = String(value || "");
    if (raw === "TBD" || raw === "Unknown" || raw === "N/A") return " ⚠";
    if (raw.includes("Below") || raw.includes("High risk")) return " ⚠";
    const nums = allValues.map((v) => safeNum(String(v).replace(/[$,]/g, ""), 0, Infinity, 0));
    const n = safeNum(raw.replace(/[$,]/g, ""), 0, Infinity, 0);
    if (["Estimated total comp", "Base salary", "Overall score", "Estimated annual recurring", "Sign-on bonus (one-time)"].includes(label)) {
      if (n && n === Math.max(...nums) && Math.max(...nums) > 0) return " ✓";
    }
    if (raw.includes("Near") || raw.includes("acceptable")) return " ✓";
    return "";
  }

  let benchmarkTemplateIndex = null;

  function encodeSharePayload(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeSharePayload(token) {
    const pad = token.length % 4 ? "=".repeat(4 - (token.length % 4)) : "";
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/") + pad;
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  }

  async function createTeamShareLink() {
    if (typeof isPro === "function" && !isPro()) {
      if (typeof openUpgrade === "function") openUpgrade("Team read-only share links are a Pro feature.");
      return "";
    }
    if (!currentSpec) {
      toast("Open a specialty workspace before creating a share link.", "info");
      return "";
    }
    const pkg = await makePackage();
    const payload = {
      v: 1,
      ro: true,
      spec: currentSpec,
      label: (SPECIALTIES[currentSpec]?.name || "Specialty") + " comparison",
      at: new Date().toISOString(),
      pkg,
    };
    const token = encodeSharePayload(payload);
    const url = location.origin + location.pathname + "?share=" + token;
    return url;
  }

  async function copyTeamShareLink() {
    const url = await createTeamShareLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast("Read-only team link copied to clipboard.", "success");
    } catch {
      const ta = e("textarea", { value: url });
      document.body.append(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("Read-only team link copied.", "success");
    }
  }

  function enableReadOnlyShare(label) {
    window.isReadOnlyShare = true;
    document.body.classList.add("read-only-share");
    const banner = $("shareReadonlyBanner");
    const lbl = $("shareReadonlyLabel");
    if (banner) banner.hidden = false;
    if (lbl) lbl.textContent = label || "Shared workspace — editing disabled.";
    ["addLeadBtn", "addBenchmarkBtn", "importTemplateBtn", "resetBtn", "clearHistoryBtn", "importBtn", "exportBtn"].forEach((id) => {
      const el = $(id);
      if (el) el.hidden = true;
    });
    document.querySelectorAll("#leadForm button[type=submit], #deleteLeadBtn, #deleteBenchBtn").forEach((el) => {
      el.hidden = true;
      el.disabled = true;
    });
  }

  async function tryLoadShareView() {
    const params = new URLSearchParams(location.search);
    const token = params.get("share");
    if (!token) return false;
    let payload;
    try {
      payload = decodeSharePayload(token);
    } catch (err) {
      console.error(err);
      toast("Invalid or corrupted share link.", "error");
      return false;
    }
    if (!payload?.pkg?.payload?.state || !payload.spec) {
      toast("Share link is missing workspace data.", "error");
      return false;
    }
    const imported = await cleanState(payload.pkg.payload.state);
    state = imported;
    await loadSpecialty(payload.spec);
    currentSpec = payload.spec;
    const ss = specState(payload.spec);
    selectedJobs = new Set(ss.leads.slice(0, 3).map((l) => l.id));
    $("home").hidden = true;
    $("tool").hidden = false;
    $("homeBtn").hidden = false;
    $("printBtn").hidden = false;
    ["exportBtn", "importBtn", "shareBtn"].forEach((id) => {
      const el = $(id);
      if (el) el.hidden = true;
    });
    $("appTitle").textContent = (SPECIALTIES[payload.spec]?.name || "Specialty") + " (shared view)";
    $("heroTitle").textContent = SPECIALTIES[payload.spec]?.emoji + " " + (SPECIALTIES[payload.spec]?.name || "");
    $("heroText").textContent = "Read-only team view — " + (payload.label || "shared comparison");
    if (typeof applySpecTheme === "function") applySpecTheme();
    switchView("dashboard");
    render({ all: true });
    enableReadOnlyShare(payload.label || "Shared on " + new Date(payload.at || Date.now()).toLocaleString());
    params.delete("share");
    const next = params.toString();
    history.replaceState({}, "", location.pathname + (next ? "?" + next : "") + location.hash);
    return true;
  }

  async function loadBenchmarkTemplateIndex() {
    if (benchmarkTemplateIndex) return benchmarkTemplateIndex;
    const res = await fetch("data/benchmark-templates/index.json");
    if (!res.ok) throw new Error("Template index unavailable");
    benchmarkTemplateIndex = await res.json();
    return benchmarkTemplateIndex;
  }

  async function importBenchmarkTemplate(templateId) {
    const index = await loadBenchmarkTemplateIndex();
    const meta = index[templateId];
    if (!meta?.file) throw new Error("Unknown template");
    if (meta.specialty && currentSpec && meta.specialty !== currentSpec) {
      if (!confirm("This template is for " + (SPECIALTY_INDEX[meta.specialty]?.name || meta.specialty) + ". Import anyway?")) return;
    }
    const res = await fetch("data/benchmark-templates/" + meta.file);
    if (!res.ok) throw new Error("Template file missing");
    const tpl = await res.json();
    const obj = { id: uid(), region: tpl.region || meta.region || "National", source: tpl.source || meta.source || "Template", year: tpl.year || new Date().getFullYear(), setting: tpl.setting || "All", notes: tpl.notes || "" };
    Object.keys(BENCH_NUM || {}).forEach((k) => {
      if (tpl[k] != null) obj[k] = tpl[k];
    });
    const b = cleanBenchmark(obj);
    const st = specState();
    const existing = st.benchmarks.findIndex((x) => x.region.toLowerCase() === b.region.toLowerCase() && x.source === b.source);
    if (existing >= 0) st.benchmarks[existing] = b;
    else st.benchmarks.push(b);
    refreshAfterMutation(["benchmarks", "dashboard", "compare"]);
    scheduleSave();
    toast("Benchmark template imported for " + b.region + ". Enter your licensed values.", "success");
  }

  function openBenchmarkTemplatePicker() {
    loadBenchmarkTemplateIndex()
      .then((index) => {
        const entries = Object.entries(index);
        if (!entries.length) {
          toast("No benchmark templates available.", "info");
          return;
        }
        const labels = entries.map(([id, m]) => m.label || id);
        const pick = prompt("Import benchmark template:\n\n" + entries.map(([id, m], i) => (i + 1) + ". " + (m.label || id)).join("\n") + "\n\nEnter number:");
        const n = parseInt(pick, 10);
        if (!n || n < 1 || n > entries.length) return;
        return importBenchmarkTemplate(entries[n - 1][0]);
      })
      .catch((err) => toast("Template import failed: " + (err.message || err), "error"));
  }

  function injectBenchmarkTemplateUi() {
    const btn = $("importTemplateBtn");
    if (!btn || btn.__wired) return;
    btn.hidden = false;
    btn.addEventListener("click", openBenchmarkTemplatePicker);
    btn.__wired = true;
  }

  const _baseRenderBenchmarks = window.renderBenchmarks;
  function renderBenchmarks() {
    if (typeof _baseRenderBenchmarks === "function") _baseRenderBenchmarks();
    injectBenchmarkTemplateUi();
  }

  function setupOfflineIndicator() {
    if ($("offlineIndicator")) return;
    const pill = e("span", { id: "offlineIndicator", className: "offline-pill", hidden: true, textContent: "Offline" });
    document.querySelector(".top .btns")?.prepend(pill);
    const sync = () => {
      pill.hidden = navigator.onLine;
      document.body.classList.toggle("is-offline", !navigator.onLine);
    };
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    sync();
  }

  function wrapShareForTeam() {
    const btn = $("shareBtn");
    if (!btn || btn.__teamWrapped) return;
    btn.__teamWrapped = true;
    btn.addEventListener("click", async (ev) => {
      if (!currentSpec) return;
      if (typeof isPro === "function" && !isPro()) return;
      if (!ev.shiftKey) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      await copyTeamShareLink();
    });
    btn.title = "Share data (Shift+click: read-only team link)";
  }

  function wrapPrintForBrandedPacket() {
    const base = window.printReport;
    if (!base || base.__brandedWrapped) return;
    window.printReport = function brandedPrintReport() {
      document.body.classList.add("pdf-packet");
      const hdr = e("div", { className: "pdf-packet-header", id: "pdfPacketHeader" }, [
        e("div", { className: "pdf-packet-brand", textContent: "Specialty Job Compare" }),
        e("div", { className: "pdf-packet-meta", textContent: (SPECIALTIES[currentSpec]?.name || "Workspace") + " · Offer strategy packet · " + new Date().toLocaleDateString() }),
      ]);
      document.body.prepend(hdr);
      base();
      setTimeout(() => {
        document.body.classList.remove("pdf-packet");
        $("pdfPacketHeader")?.remove();
      }, 800);
    };
    window.printReport.__brandedWrapped = true;
  }

  function wrapReadOnlyGuards() {
    ["openLead", "saveLead", "deleteLead", "openBenchmark", "saveBenchmark", "deleteBenchmark", "resetSample"].forEach((name) => {
      const base = window[name];
      if (!base || base.__roWrapped) return;
      window[name] = function readOnlyGuard(...args) {
        if (window.isReadOnlyShare) {
          toast("Read-only shared view — editing disabled.", "info");
          return;
        }
        return base.apply(this, args);
      };
      window[name].__roWrapped = true;
    });
  }

  function initPhase4() {
    injectPwaInstallBtn();
    setupPwaInstall();
    watchModals();
    setupOfflineIndicator();
    wrapShareForTeam();
    wrapPrintForBrandedPacket();
    wrapReadOnlyGuards();
    window.renderBenchmarks = renderBenchmarks;
  }

  window.diffLeadFields = diffLeadFields;
  window.collectRedFlags = collectRedFlags;
  window.unansweredDiligence = unansweredDiligence;
  window.allUnansweredDiligence = allUnansweredDiligence;
  window.checklistProgress = checklistProgress;
  window.benchmarkBarPct = benchmarkBarPct;
  window.suggestedClinicalFit = suggestedClinicalFit;
  window.buildNegotiationLetter = buildNegotiationLetter;
  window.copyNegotiationLetter = copyNegotiationLetter;
  window.compareWinnerIcon = compareWinnerIcon;
  window.__premiumToast = toast;
  window.__premiumSetStatus = setStatus;
  window.toast = toast;
  window.setStatus = setStatus;
  window.trackChange = trackChange;
  window.renderScoreInputs = renderScoreInputs;
  window.initPhase4 = initPhase4;
  window.tryLoadShareView = tryLoadShareView;
  window.createTeamShareLink = createTeamShareLink;
  window.copyTeamShareLink = copyTeamShareLink;
  window.importBenchmarkTemplate = importBenchmarkTemplate;
  window.applySuggestedFitScores = applySuggestedFitScores;
})();

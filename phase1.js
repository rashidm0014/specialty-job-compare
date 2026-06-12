/* Phase 1: redesign + lazy render + mobile matrix UX */
(function () {
  "use strict";

  const _baseOpenSpecialty = window.openSpecialty;
  const _baseGoHome = window.goHome;
  const _baseOpenLead = window.openLead;
  const _baseSaveLead = window.saveLead;
  const _baseDeleteLead = window.deleteLead;
  const _baseResetSample = window.resetSample;
  const _baseSaveBenchmark = window.saveBenchmark;
  const _baseDeleteBenchmark = window.deleteBenchmark;

  let currentView = "dashboard";

  const SPEC_COLORS = {
    pain: ["#1a5c61", "#e3f3f1", "#123f43"],
    peds: ["#2e6fbb", "#eaf3ff", "#1b4475"],
    anesthesia: ["#6941c6", "#f4f0ff", "#3b1f7c"],
    derm: ["#b83280", "#fff0f6", "#6f1d4b"],
    radiology: ["#175cd3", "#eff6ff", "#12366f"],
    psych: ["#4e5ba6", "#eef0ff", "#293056"],
    primary: ["#087443", "#ecfdf3", "#064e3b"],
    em: ["#c2410c", "#fff7ed", "#7c2d12"],
  };

  const SPEC_GLYPHS = {
    pain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v18"/><path d="M8 8h8M7 12h10M6 16h12"/></svg>',
    peds: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="7" r="3"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>',
    anesthesia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 12h16"/><path d="M8 8c2-2 6-2 8 0M8 16c2 2 6 2 8 0"/></svg>',
    derm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>',
    radiology: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 15l3-4 2 3 3-5"/></svg>',
    psych: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4a4 4 0 0 1 4 4c0 2-1 3-2 4v2H10v-2c-1-1-2-2-2-4a4 4 0 0 1 4-4z"/><path d="M10 18h4"/></svg>',
    primary: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 6v12M6 12h12"/><circle cx="12" cy="12" r="8"/></svg>',
    em: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12h3l2-5 4 10 2-5h5"/></svg>',
  };

  function specGlyphEl(key) {
    const glyph = SPEC_GLYPHS[key] || "";
    const el = e("span", { className: "spec-glyph", "aria-hidden": "true" });
    if (glyph) el.innerHTML = glyph;
    else el.textContent = SPECIALTY_INDEX[key]?.emoji || "◎";
    return el;
  }

  const NAV_ICONS = {
    dashboard: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>',
    compare: '<svg viewBox="0 0 24 24"><path d="M7 4h10v16H7z"/><path d="M3 8h2v12H3zM19 6h2v14h-2z"/></svg>',
    add: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    questions: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 2-2.5 2-2.5 4"/><path d="M12 17h.01"/></svg>',
    report: '<svg viewBox="0 0 24 24"><path d="M6 4h9l3 3v13H6z"/><path d="M9 12h6M9 16h6M9 8h3"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  };

  function isMobile() {
    return window.matchMedia("(max-width: 760px)").matches;
  }

  function emptyState(title, text, ctaLabel, ctaFn) {
    const box = e("div", { className: "empty" }, [
      e("div", { className: "empty-icon", textContent: "◎" }),
      e("h3", { textContent: title }),
      e("p", { textContent: text }),
    ]);
    if (ctaLabel && ctaFn) {
      box.append(e("button", { className: "primary", type: "button", textContent: ctaLabel, onclick: ctaFn, style: "margin-top:16px" }));
    }
    return box;
  }

  function diligenceTotal() {
    const grouped = EXPANDED_QUESTIONS[currentSpec] || {};
    let n = 0;
    Object.values(grouped).forEach((qs) => {
      (Array.isArray(qs) ? qs : []).forEach(() => n++);
    });
    return n;
  }

  function diligenceAnswered(l) {
    return Object.values(l.diligence || {}).filter((v) => String(v || "").trim()).length;
  }

  function diligenceGap(l) {
    const total = diligenceTotal();
    if (!total) return 100;
    return Math.round((diligenceAnswered(l) / total) * 100);
  }

  function completionPct(l) {
    const checklistItems = SPECIALTIES[currentSpec]?.checklist?.length || 0;
    const yes = Object.values(l.checklist || {}).filter((v) => v === "Yes" || v === "No").length;
    const diligence = diligenceAnswered(l);
    const diligenceMax = diligenceTotal() || 1;
    const filled = yes + diligence;
    const total = checklistItems + diligenceMax;
    return total ? Math.round((filled / total) * 100) : 0;
  }

  function completionBar(pct) {
    return e("div", { className: "completion-bar" }, [
      e("div", { className: "completion-top" }, [
        e("span", { textContent: "Profile completion" }),
        e("span", { textContent: pct + "%" }),
      ]),
      e("div", { className: "completion-track" }, [
        e("span", { className: "completion-fill", style: "width:" + pct + "%" }),
      ]),
    ]);
  }

  function applySpecTheme() {
    const c = SPEC_COLORS[currentSpec] || ["#1a5c61", "#e3f3f1", "#123f43"];
    document.documentElement.style.setProperty("--specColor", c[0]);
    document.documentElement.style.setProperty("--specSoft", c[1]);
    document.documentElement.style.setProperty("--specDark", c[2]);
    const mark = document.querySelector(".brand-mark");
    if (mark) mark.style.background = "linear-gradient(135deg," + c[2] + "," + c[0] + ")";
  }

  function benchmarkTone(l) {
    const b = bestBenchmark(l);
    if (!b || !b.compP50) return ["neutral", "No benchmark"];
    const t = total(l);
    if (t >= b.compP75 && b.compP75) return ["good", "Above 75th"];
    if (t >= b.compP50 * 0.95) return ["good", "Near/above median"];
    if (t >= b.compP25 && b.compP25) return ["warn", "Below median"];
    return ["bad", "Below 25th"];
  }

  function riskTone(l) {
    if (l.riskFit <= 4) return ["bad", "High risk"];
    if (l.riskFit <= 6) return ["warn", "Needs review"];
    return ["good", "Risk acceptable"];
  }

  function scoreBar(label, val) {
    val = safeNum(val, 1, 10, 5);
    return e("div", { className: "barRow" }, [
      e("span", { textContent: label }),
      e("span", { className: "barTrack" }, [e("span", { className: "barFill", style: "width:" + val * 10 + "%" })]),
      e("span", { textContent: val + "/10" }),
    ]);
  }

  function updateTopLeadScore() {
    const leads = specState().leads;
    $("topLeadScore").textContent = leads.length ? String(Math.max(...leads.map(score))) : "--";
  }

  function renderView(view) {
    switch (view) {
      case "dashboard":
        renderGuide();
        renderCards();
        renderDashboardSummary();
        updateTopLeadScore();
        break;
      case "compare":
        renderSelectors();
        renderCompare();
        break;
      case "checklist":
        renderChecklist();
        break;
      case "volume":
        renderVolume();
        break;
      case "benchmarks":
        renderBenchmarks();
        break;
      case "history":
        renderHistory();
        break;
      case "questions":
        renderQuestions();
        break;
      case "report":
        renderReport();
        break;
    }
  }

  function render(opts) {
    opts = opts || {};
    if (!currentSpec) {
      renderHome();
      return;
    }
    applySpecTheme();
    const allViews = ["dashboard", "compare", "checklist", "volume", "benchmarks", "history", "questions", "report"];
    const views = opts.all ? allViews : opts.views || [currentView];
    views.forEach(renderView);
  }

  function switchView(v) {
    currentView = v;
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.view === v)));
    document.querySelectorAll(".view").forEach((p) => p.setAttribute("aria-hidden", String(p.id !== v)));
    renderView(v);
    updateMobileNav(v);
    closeMobileMore();
  }

  function addReportTab() {
    const nav = document.querySelector(".tabs");
    if (nav && !document.querySelector(".tab[data-view='report']")) {
      const btn = e("button", {
        className: "tab",
        dataset: { view: "report" },
        role: "tab",
        ariaSelected: "false",
        type: "button",
        textContent: "Report",
      });
      const q = document.querySelector(".tab[data-view='questions']");
      nav.insertBefore(btn, q || null);
      btn.addEventListener("click", () => switchView("report"), { signal });
    }
    const main = document.querySelector("#tool main");
    if (main && !$("report")) {
      main.append(
        e("section", { id: "report", className: "view", ariaHidden: "true" }, [
          e("header", { className: "section-head" }, [
            e("div", {}, [
              e("h2", { textContent: "Offer report" }),
              e("p", { textContent: "A polished negotiation and attorney-review summary for the selected specialty." }),
            ]),
            e("div", { className: "btns" }, [
              e("button", { className: "primary", type: "button", textContent: "Print / Save PDF", onclick: () => (typeof printReport === "function" ? printReport() : window.print()) }),
              e("button", { className: "btn", type: "button", textContent: "Copy negotiation letter", onclick: () => typeof copyNegotiationLetter === "function" && copyNegotiationLetter() }),
              e("button", { className: "btn", type: "button", textContent: "Share data", onclick: () => shareData() }),
            ]),
          ]),
          e("section", { id: "offerReport" }),
        ])
      );
    }
  }

  function renderHome() {
    const g = $("specialtyGrid");
    clear(g);
    const freeList = typeof freeSpecialtyList === "function" ? freeSpecialtyList() : ["pain", "peds"];
    Object.entries(SPECIALTY_INDEX || {}).forEach(([key, s]) => {
      const c = SPEC_COLORS[key] || ["#1a5c61", "#e3f3f1"];
      const locked = typeof canOpenSpecialty === "function" ? !canOpenSpecialty(key) : false;
      const kids = [
        e("span", { className: "spec-orb", ariaHidden: "true" }),
        specGlyphEl(key),
        e("h3", { textContent: s.name }),
        e("p", { textContent: s.tag }),
        e("div", { className: "flagRow" }, [
          e("span", { className: "flag neutral", textContent: (s.checklistCount || 0) + " checklist items" }),
          e("span", { className: "flag neutral", textContent: (s.volumeCount || 0) + " volume metrics" }),
        ]),
        e("div", { className: "launch", textContent: locked ? "Upgrade to unlock \u2192" : "Open workspace \u2192" }),
      ];
      if (locked) kids.unshift(e("span", { className: "spec-lock", textContent: "Pro" }));
      g.append(
        e("button", {
          className: "specialty-card" + (locked ? " locked" : ""),
          type: "button",
          style: "--specColor:" + c[0] + ";--specSoft:" + c[1],
          onclick: () => {
            if (locked) {
              if (typeof openUpgrade === "function") {
                openUpgrade("Free plan includes " + freeList.map((k) => SPECIALTY_INDEX[k]?.name || k).join(" and ") + ". Upgrade for all specialties.");
              }
              return;
            }
            openSpecialty(key);
          },
        }, kids)
      );
    });
  }

  function renderDashboardSummary() {
    let old = $("dashboardSummary");
    if (old) old.remove();
    const leads = specState().leads;
    const hero = document.querySelector("#dashboard .hero");
    if (!hero || !leads.length) return;

    const best = [...leads].sort((a, b) => score(b) - score(a))[0];
    const high = [...leads].sort((a, b) => (typeof firstYearComp === "function" ? firstYearComp(b) : total(b)) - (typeof firstYearComp === "function" ? firstYearComp(a) : total(a)))[0];
    const risk = [...leads].sort((a, b) => b.riskFit - a.riskFit)[0];
    const needsWork = [...leads]
      .map((l) => ({ l, gap: 100 - diligenceGap(l) }))
      .sort((a, b) => b.gap - a.gap)[0]?.l;

    const grid = e("section", { id: "dashboardSummary", className: "summaryGrid" }, [
      e("article", { className: "summaryCard good" }, [
        e("small", { textContent: "Best overall" }),
        e("b", { textContent: best?.name || "TBD" }),
        e("p", { textContent: best ? "Score " + score(best) : "Add leads to compare." }),
      ]),
      e("article", { className: "summaryCard good" }, [
        e("small", { textContent: "Highest total estimate" }),
        e("b", { textContent: high ? money(typeof firstYearComp === "function" ? firstYearComp(high) : total(high)) : "TBD" }),
        e("p", { textContent: high?.name || "" }),
      ]),
      e("article", { className: "summaryCard risk" }, [
        e("small", { textContent: "Lowest contract risk" }),
        e("b", { textContent: risk ? risk.riskFit + "/10" : "TBD" }),
        e("p", { textContent: risk?.name || "" }),
      ]),
      e("article", { className: "summaryCard warn" }, [
        e("small", { textContent: "Most due-diligence gaps" }),
        e("b", { textContent: needsWork?.name || "TBD" }),
        e("p", { textContent: needsWork ? (100 - diligenceGap(needsWork)) + "% questions unanswered" : "Use Questions tab to document answers." }),
      ]),
    ]);
    hero.after(grid);
  }

  function renderCards() {
    const w = $("jobCards");
    const leads = [...specState().leads].sort((a, b) => score(b) - score(a));
    clear(w);
    if (!leads.length) {
      w.append(emptyState("No job leads yet", "Add your first opportunity to compare compensation, benchmarks, APP supervision, quality bonuses, and fit.", "Add lead", () => openLead()));
      return;
    }
    leads.forEach((l, idx) => {
      const [bt, btext] = benchmarkTone(l);
      const [rt, rtext] = riskTone(l);
      const pct = completionPct(l);
      const c = e("article", { className: "card offer-card" + (idx === 0 ? " is-top" : "") });

      const top = e("div", { className: "cardtop" });
      const left = e("div");
      const bad = e("div", { className: "badges" });
      bad.append(e("span", { className: "badge", textContent: l.status || "Unknown" }));
      if (l.hasEquity) bad.append(e("span", { className: "badge green", textContent: "Equity" }));
      if (l.hasAppSupervision) bad.append(e("span", { className: "badge green", textContent: "APP" }));
      if (l.hasQualityBonus) bad.append(e("span", { className: "badge green", textContent: "Quality" }));
      left.append(
        bad,
        e("h3", { textContent: l.name || "Untitled lead" }),
        e("p", { textContent: (l.location || "Location TBD") + " \u00b7 " + (l.jobType || "Unknown") })
      );
      const ring = e("div", { className: "pill score-ring animate-ring", style: "--score:" + score(l) }, [e("span", { textContent: String(score(l)) })]);
      const scoreCol = e("div", { className: "card-score-col" });
      if (idx < 3) scoreCol.append(e("span", { className: "rank-badge" + (idx === 0 ? " gold" : ""), textContent: "#" + (idx + 1) }));
      scoreCol.append(ring);
      top.append(left, scoreCol);

      const cp = typeof checklistProgress === "function" ? checklistProgress(l) : { total: 0, answered: 0, yes: 0 };
      const m = e("div", { className: "metrics" });
      [
        ["Annual recurring est.", money(typeof recurringComp === "function" ? recurringComp(l) : total(l))],
        ["First-year w/ sign-on", money(typeof firstYearComp === "function" ? firstYearComp(l) : total(l))],
        ["Base", money(l.baseSalary)],
        ["Commute", l.commute ? l.commute + " min" : "TBD"],
      ].forEach(([a, b]) => m.append(e("div", { className: "metric" }, [e("small", { textContent: a }), e("strong", { textContent: b })])));

      const benchPct = typeof benchmarkBarPct === "function" ? benchmarkBarPct(l) : null;
      const benchBar =
        benchPct != null
          ? e("div", { className: "bench-compare-bar" }, [
              e("div", { className: "bench-compare-top" }, [
                e("span", { textContent: "Offer vs benchmark median" }),
                e("span", { textContent: benchPct + "%" }),
              ]),
              e("div", { className: "bench-compare-track" }, [
                e("span", { className: "bench-compare-marker", style: "left:100%" }),
                e("span", { className: "bench-compare-fill", style: "width:" + Math.min(benchPct, 100) + "%" }),
              ]),
              e("small", { className: "est-note", textContent: "Estimated — confirm with written offer terms" }),
            ])
          : null;

      const bars = e("div", { className: "barRows" }, [
        scoreBar("Clinical", l.clinicalFit),
        scoreBar("Comp", l.compFit),
        scoreBar("Lifestyle", l.lifestyleFit),
        scoreBar("Risk", l.riskFit),
      ]);
      const redFlags = typeof collectRedFlags === "function" ? collectRedFlags(l) : [];
      const flags = e("div", { className: "flagRow" }, [
        e("span", { className: "flag " + bt, textContent: btext }),
        e("span", { className: "flag " + rt, textContent: rtext }),
        e("span", { className: "flag neutral", textContent: cp.total ? cp.yes + "/" + cp.total + " checklist confirmed" : "Checklist pending" }),
        ...redFlags.slice(0, 2).map((f) => e("span", { className: "flag " + (f.level === "high" ? "bad" : "warn"), textContent: f.text.replace((l.name || "Lead") + ": ", "⚑ ") })),
      ]);
      const actions = e("div", { className: "actions" }, [
        e("button", { className: "btn", type: "button", textContent: "Edit", onclick: () => openLead(l.id) }),
        e("button", {
          className: "primary",
          type: "button",
          textContent: "Compare",
          onclick: () => {
            selectedJobs.add(l.id);
            switchView("compare");
          },
        }),
      ]);
      [top, m, completionBar(pct), benchBar, bars, flags, actions].filter(Boolean).forEach((n) => c.append(n));
      w.append(c);
    });
  }

  function classifyCell(label, value, allValues) {
    const raw = String(value || "");
    if (raw === "TBD" || raw === "Unknown" || raw === "N/A") return "";
    if (["Estimated total comp", "Estimated annual recurring", "Est. first-year incl. sign-on", "Base salary", "Sign-on bonus (one-time)", "APP supervision pay", "Quality expected", "Overall score"].includes(label)) {
      const nums = allValues.map((v) => safeNum(String(v).replace(/[$,]/g, ""), 0, Infinity, 0));
      const n = safeNum(raw.replace(/[$,]/g, ""), 0, Infinity, 0);
      if (n && n === Math.max(...nums)) return "best-cell";
    }
    if (raw.includes("Below") || raw.includes("High risk")) return "concern-cell";
    if (raw.includes("Near") || raw.includes("Needs")) return "near-cell";
    return "";
  }

  function renderSelectors() {
    const jw = $("compareJobSelect");
    const cw = $("compareCategorySelect");
    clear(jw);
    clear(cw);
    const limit = typeof compareLimit === "function" ? compareLimit() : Infinity;
    specState().leads.forEach((l) =>
      jw.append(
        e("button", {
          className: "chip",
          type: "button",
          ariaPressed: selectedJobs.has(l.id),
          textContent: l.name || "Untitled",
          onclick: () => {
            if (!selectedJobs.has(l.id) && selectedJobs.size >= limit) {
              if (typeof openUpgrade === "function") openUpgrade("Free plan compares up to " + limit + " jobs at once.");
              return;
            }
            selectedJobs.has(l.id) ? selectedJobs.delete(l.id) : selectedJobs.add(l.id);
            renderSelectors();
            renderCompare();
          },
        })
      )
    );
    CATEGORIES.forEach(([k, lab]) =>
      cw.append(
        e("button", {
          className: "chip",
          type: "button",
          ariaPressed: selectedCats.has(k),
          textContent: lab,
          onclick: () => {
            selectedCats.has(k) ? selectedCats.delete(k) : selectedCats.add(k);
            renderSelectors();
            renderCompare();
          },
        })
      )
    );
    if (typeof isPro === "function" && !isPro() && specState().leads.length > limit) {
      jw.append(e("p", { className: "limit-hint", textContent: "Free: compare up to " + limit + " jobs. Upgrade for unlimited." }));
    }
  }

  function renderCompare() {
    const w = $("compareTableWrap");
    clear(w);
    w.classList.add("premium-table");
    const ls = specState().leads.filter((l) => selectedJobs.has(l.id));
    const cs = CATEGORIES.filter(([k]) => selectedCats.has(k));
    if (!ls.length || !cs.length) {
      w.append(emptyState("Select jobs and categories", "Choose at least one job and one category to build a comparison table."));
      return;
    }
    const wrap = e("div", { className: "compare-scroll" });
    const table = e("table", { className: "compare-table" });
    table.append(e("caption", { textContent: "Selected job lead comparison" }));
    const thead = e("thead", { className: "compare-sticky-head" });
    const hr = e("tr");
    hr.append(e("th", { textContent: "Category" }));
    const leadColors = ["#1a5c61", "#2e6fbb", "#9a6b1f", "#087443", "#b83280", "#c2410c"];
    ls.forEach((l, i) => {
      const th = e("th");
      th.append(
        e("span", { className: "lead-dot", style: "background:" + leadColors[i % leadColors.length] }),
        document.createTextNode(l.name || "Untitled")
      );
      hr.append(th);
    });
    thead.append(hr);
    const tb = e("tbody");
    const top = e("tr", { className: "sectionrow" });
    top.append(e("th", { colSpan: String(ls.length + 1), textContent: "At-a-glance recommendation" }));
    tb.append(top);
    [
      ["Overall score", (l) => score(l)],
      ["Estimated annual recurring", (l) => money(typeof recurringComp === "function" ? recurringComp(l) : total(l))],
      ["Benchmark signal", (l) => benchmarkTone(l)[1]],
      ["Risk signal", (l) => riskTone(l)[1]],
    ].forEach(([lab, fn]) => {
      const tr = e("tr");
      tr.append(e("td", { textContent: lab }));
      const vals = ls.map(fn);
      ls.forEach((l, i) => {
        const td = e("td", { className: classifyCell(lab, vals[i], vals) });
        val(td, vals[i]);
        const icon = typeof compareWinnerIcon === "function" ? compareWinnerIcon(lab, vals[i], vals) : "";
        if (icon) td.append(e("span", { className: "cell-icon", textContent: icon }));
        tr.append(td);
      });
      tb.append(tr);
    });
    cs.forEach(([cat, lab]) => {
      const sec = e("tr", { className: "sectionrow" });
      sec.append(e("th", { colSpan: String(ls.length + 1), textContent: lab }));
      tb.append(sec);
      rows(cat, ls[0]).forEach((r, i) => {
        const tr = e("tr");
        tr.append(e("td", { textContent: r[0] }));
        const vals = ls.map((l) => rows(cat, l)[i]?.[1] ?? "TBD");
        ls.forEach((l, j) => {
          const td = e("td", { className: classifyCell(r[0], vals[j], vals) });
          val(td, vals[j]);
          const icon = typeof compareWinnerIcon === "function" ? compareWinnerIcon(r[0], vals[j], vals) : "";
          if (icon) td.append(e("span", { className: "cell-icon", textContent: icon }));
          tr.append(td);
        });
        tb.append(tr);
      });
    });
    table.append(thead, tb);
    wrap.append(table);
    w.append(wrap);
  }

  function renderChecklist() {
    const w = $("checklistMatrix");
    clear(w);
    const leads = specState().leads;
    if (!leads.length) {
      w.append(emptyState("No leads", "Add a lead before using the specialty checklist."));
      return;
    }
    const wrap = e("div", { className: "tablewrap" + (isMobile() ? " has-mobile-cards" : "") });
    const table = e("table");
    table.append(e("caption", { textContent: "Specialty checklist by opportunity" }));
    const hr = e("tr");
    hr.append(e("th", { textContent: "Item" }));
    leads.forEach((l) => hr.append(e("th", { textContent: l.name || "Untitled" })));
    table.append(e("thead", {}, [hr]));
    const tb = e("tbody");
    SPECIALTIES[currentSpec].checklist.forEach((item) => {
      const tr = e("tr");
      tr.append(e("td", { textContent: item }));
      leads.forEach((l) => {
        const td = e("td");
        const s = e("select", {
          value: l.checklist[item] || "Unknown",
          onchange: () => {
            l.checklist[item] = s.value;
            trackChange(l, "Checklist updated: " + item);
            render({ views: ["checklist", "dashboard"] });
            scheduleSave();
          },
        });
        ["Yes", "No", "Unknown"].forEach((o) =>
          s.append(e("option", { value: o, textContent: o, selected: (l.checklist[item] || "Unknown") === o }))
        );
        td.append(s);
        tr.append(td);
      });
      tb.append(tr);
    });
    table.append(tb);
    wrap.append(table);

    if (isMobile()) {
      const mobile = e("div", { className: "mobile-matrix" });
      leads.forEach((l) => {
        const card = e("article", { className: "mobile-matrix-card" }, [e("h3", { textContent: l.name || "Untitled" })]);
        SPECIALTIES[currentSpec].checklist.forEach((item) => {
          const row = e("div", { className: "mobile-matrix-row" });
          const sel = e("select", {
            value: l.checklist[item] || "Unknown",
            onchange: () => {
              l.checklist[item] = sel.value;
              trackChange(l, "Checklist updated: " + item);
              render({ views: ["checklist", "dashboard"] });
              scheduleSave();
            },
          });
          ["Yes", "No", "Unknown"].forEach((o) =>
            sel.append(e("option", { value: o, textContent: o, selected: (l.checklist[item] || "Unknown") === o }))
          );
          row.append(e("span", { textContent: item }), sel);
          card.append(row);
        });
        mobile.append(card);
      });
      wrap.append(mobile);
    }
    w.append(wrap);
  }

  function renderVolume() {
    const w = $("volumeMatrix");
    clear(w);
    const leads = specState().leads;
    if (!leads.length) {
      w.append(emptyState("No leads", "Add a lead before tracking volume and productivity."));
      return;
    }
    const wrap = e("div", { className: "tablewrap" + (isMobile() ? " has-mobile-cards" : "") });
    const table = e("table");
    table.append(e("caption", { textContent: "Volume/productivity comparison" }));
    const hr = e("tr");
    hr.append(e("th", { textContent: "Metric" }));
    leads.forEach((l) => hr.append(e("th", { textContent: l.name || "Untitled" })));
    table.append(e("thead", {}, [hr]));
    const tb = e("tbody");
    SPECIALTIES[currentSpec].volume.forEach((item) => {
      const tr = e("tr", { className: /non-compete|tail coverage/i.test(item) ? "contract-volume-row" : "" });
      tr.append(e("td", { textContent: item }));
      leads.forEach((l) => {
        const td = e("td");
        const inp = e("input", {
          value: l.volume[item] || "",
          maxlength: 120,
          onchange: () => {
            l.volume[item] = sanitize(inp.value, 120);
            if (item.toLowerCase().includes("wrvu")) l.expectedWrvu = safeNum(inp.value, 0, 10000000, l.expectedWrvu);
            trackChange(l, "Volume updated: " + item);
            render({ views: ["volume", "dashboard", "compare"] });
            scheduleSave();
          },
        });
        td.append(inp);
        tr.append(td);
      });
      tb.append(tr);
    });
    table.append(tb);
    wrap.append(table);

    if (isMobile()) {
      const mobile = e("div", { className: "mobile-matrix" });
      leads.forEach((l) => {
        const card = e("article", { className: "mobile-matrix-card" }, [e("h3", { textContent: l.name || "Untitled" })]);
        SPECIALTIES[currentSpec].volume.forEach((item) => {
          const row = e("div", { className: "mobile-matrix-row" });
          const inp = e("input", {
            value: l.volume[item] || "",
            maxlength: 120,
            placeholder: "Enter value",
            onchange: () => {
              l.volume[item] = sanitize(inp.value, 120);
              if (item.toLowerCase().includes("wrvu")) l.expectedWrvu = safeNum(inp.value, 0, 10000000, l.expectedWrvu);
              trackChange(l, "Volume updated: " + item);
              render({ views: ["volume", "dashboard", "compare"] });
              scheduleSave();
            },
          });
          row.append(e("span", { textContent: item }), inp);
          card.append(row);
        });
        mobile.append(card);
      });
      wrap.append(mobile);
    }
    w.append(wrap);
  }

  function renderReport() {
    const w = $("offerReport");
    if (!w) return;
    clear(w);
    const leads = specState().leads;
    if (!leads.length) {
      w.append(emptyState("No report yet", "Add at least one lead to generate a negotiation-ready report.", "Add lead", () => openLead()));
      return;
    }
    const ranked = [...leads].sort((a, b) => score(b) - score(a));
    const top3 = ranked.slice(0, 3);
    const best = ranked[0];
    const high = [...leads].sort((a, b) => (typeof firstYearComp === "function" ? firstYearComp(b) : total(b)) - (typeof firstYearComp === "function" ? firstYearComp(a) : total(a)))[0];
    const risky = [...leads].sort((a, b) => a.riskFit - b.riskFit)[0];
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const spec = SPECIALTIES[currentSpec] || {};

    if (typeof isPro === "function" && !isPro()) {
      w.append(
        e("div", { className: "report-free-banner no-print" }, [
          e("strong", { textContent: "Free preview report" }),
          e("p", { textContent: "PDF exports include a watermark. Upgrade to Pro for clean, attorney-ready reports." }),
          e("button", { className: "primary", type: "button", textContent: "Upgrade to Pro", onclick: () => openUpgrade() }),
        ])
      );
    }

    const cover = e("article", { className: "reportCover" }, [
      e("div", { className: "reportCover-brand" }, [
        e("span", { className: "reportCover-mark", textContent: spec.emoji || "◎" }),
        e("div", {}, [
          e("div", { className: "eyebrow report-eyebrow", textContent: "Attorney-ready offer packet" }),
          e("h2", { textContent: spec.name + " — Offer Comparison Report" }),
        ]),
      ]),
      e("p", { className: "reportCover-tag", textContent: spec.tag || "" }),
      e("div", { className: "report-cover-meta" }, [
        e("span", { textContent: "Generated " + dateStr }),
        e("span", { textContent: leads.length + " offer" + (leads.length === 1 ? "" : "s") + " compared" }),
        e("span", { textContent: "Estimates only — not a guarantee of compensation or contract terms" }),
      ]),
    ]);

    const hero = e("article", { className: "reportHero" }, [
      e("h3", { textContent: "Executive summary" }),
      e("p", {
        textContent:
          "Top overall option is " +
          (best.name || "Untitled") +
          " (score " +
          score(best) +
          "). Highest first-year estimate is " +
          (high.name || "Untitled") +
          " at " +
          money(typeof firstYearComp === "function" ? firstYearComp(high) : total(high)) +
          ". Primary risk review: " +
          (risky.name || "Untitled") +
          " (risk safety " +
          risky.riskFit +
          "/10). All figures are workspace estimates pending written offer confirmation.",
      }),
    ]);

    const compTable = e("article", { className: "reportCard report-page-break" }, [e("h3", { textContent: "Top offers — compensation comparison" })]);
    const ct = e("table", { className: "report-comp-table" });
    const ch = e("tr");
    ["Offer", "Score", "Annual recurring", "Sign-on", "First-year est.", "vs benchmark"].forEach((h) => ch.append(e("th", { textContent: h })));
    ct.append(e("thead", {}, [ch]));
    const ctb = e("tbody");
    top3.forEach((l) => {
      const tr = e("tr");
      [l.name || "Untitled", String(score(l)), money(typeof recurringComp === "function" ? recurringComp(l) : total(l)), money(l.signOn), money(typeof firstYearComp === "function" ? firstYearComp(l) : total(l)), benchmarkSummary(l)].forEach((v) => tr.append(e("td", { textContent: v })));
      ctb.append(tr);
    });
    ct.append(ctb);
    compTable.append(ct);

    const grid = e("section", { className: "reportGrid" });
    const rank = e("article", { className: "reportCard" }, [e("h3", { textContent: "Full ranking" })]);
    const list = e("div", { className: "reportList" });
    ranked.forEach((l, i) =>
      list.append(
        e("div", { className: "reportItem" }, [
          e("span", { textContent: i + 1 + ". " + (l.name || "Untitled") }),
          e("b", { textContent: score(l) + " · " + money(typeof recurringComp === "function" ? recurringComp(l) : total(l)) + " recurring" }),
        ])
      )
    );
    rank.append(list);

    const flags = e("article", { className: "reportCard" }, [e("h3", { textContent: "Red flag engine" })]);
    const fl = e("div", { className: "flagRow" });
    const allFlags = typeof collectRedFlags === "function" ? leads.flatMap((l) => collectRedFlags(l)) : [];
    if (!allFlags.length) fl.append(e("span", { className: "flag good", textContent: "No automated red flags detected" }));
    else allFlags.forEach((f) => fl.append(e("span", { className: "flag " + (f.level === "high" ? "bad" : "warn"), textContent: "⚑ " + f.text })));
    flags.append(fl);
    grid.append(rank, flags);

    const openQ = e("article", { className: "reportCard report-page-break" }, [e("h3", { textContent: "Open diligence questions for counsel" })]);
    const oqList = e("ul", { className: "report-questions" });
    const unanswered = typeof allUnansweredDiligence === "function" ? allUnansweredDiligence(leads) : [];
    if (!unanswered.length) oqList.append(e("li", { textContent: "All documented diligence questions have notes for at least one lead." }));
    else unanswered.slice(0, 20).forEach((item) => oqList.append(e("li", { textContent: "[" + item.group + "] " + item.question + (item.leads.length ? " — gaps on: " + item.leads.join(", ") : "") })));
    openQ.append(oqList);

    const staticQ = e("article", { className: "reportCard" }, [
      e("h3", { textContent: "Standard contract confirmation checklist" }),
      e("ul", {}, [
        e("li", { textContent: "Confirm compensation formula, threshold, frequency, caps, and clawbacks." }),
        e("li", { textContent: "Confirm APP supervision expectations, liability, chart review, and whether pay is separate." }),
        e("li", { textContent: "Confirm quality bonus formula, historical payout, and physician-controllable metrics." }),
        e("li", { textContent: "Confirm noncompete, tail coverage, termination, buy-in, and repayment terms." }),
      ]),
    ]);

    const footer = e("footer", { className: "reportFooter" }, [
      e("p", { textContent: "Generated by Specialty Job Compare · " + dateStr }),
      e("p", { className: "muted-copy", textContent: "This report is for negotiation preparation only and does not constitute legal, tax, financial, or employment advice." }),
    ]);

    w.append(cover, hero, compTable, grid, openQ, staticQ, footer);
  }

  function renderHistory() {
    const w = $("historyList");
    clear(w);
    const h = specState().history;
    if (!h.length) {
      w.append(emptyState("No negotiation history yet", "Save edits to a lead to create timestamped offer-change entries."));
      return;
    }
    const tl = e("div", { className: "timeline" });
    h.slice()
      .reverse()
      .forEach((x) => {
        const item = e("div", { className: "timelineItem" }, [
          e("span", { className: "timelineDot" }),
          e("h3", { textContent: x.lead || "Lead" }),
          e("p", { textContent: x.at + " \u00b7 " + x.summary }),
        ]);
        if (x.diffs && x.diffs.length) {
          const dl = e("ul", { className: "diff-list" });
          x.diffs.forEach((d) => dl.append(e("li", { textContent: d.field + ": " + d.from + " → " + d.to })));
          item.append(dl);
        }
        tl.append(item);
      });
    w.append(tl);
  }

  function ensurePwaManifest() {
    try {
      if (document.querySelector('link[rel="manifest"]')) return;
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#1a5c61"/><path d="M256 96v320M176 176h160v160H176z" stroke="white" stroke-width="28" fill="none"/></svg>';
      const manifest = {
        name: "Specialty Job Compare",
        short_name: "Job Compare",
        start_url: ".",
        display: "standalone",
        background_color: "#f4f0e8",
        theme_color: "#1a5c61",
        orientation: "portrait",
        icons: [{ src: "data:image/svg+xml;base64," + btoa(svg), sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }],
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
      document.head.append(e("link", { rel: "manifest", href: url }));
    } catch (err) {
      console.error(err);
    }
  }

  function ensureMobileShell() {
    if (!$("mobileBottomNav")) {
      const makeBtn = (cfg) => {
        const btn = e("button", {
          className: "mobile-nav-btn" + (cfg.add ? " add" : ""),
          type: "button",
          dataset: cfg.view ? { view: cfg.view } : { action: cfg.action },
        }, [
          e("span", { className: "mi" }),
          e("span", { textContent: cfg.label }),
        ]);
        btn.querySelector(".mi").innerHTML = NAV_ICONS[cfg.icon];
        return btn;
      };
      const nav = e("nav", { id: "mobileBottomNav", className: "mobile-bottom-nav", ariaLabel: "Primary app navigation" }, [
        makeBtn({ view: "dashboard", label: "Home", icon: "dashboard" }),
        makeBtn({ view: "compare", label: "Compare", icon: "compare" }),
        makeBtn({ action: "add", label: "Add", icon: "add", add: true }),
        makeBtn({ view: "questions", label: "Q&A", icon: "questions" }),
        makeBtn({ view: "report", label: "Report", icon: "report" }),
        makeBtn({ action: "more", label: "More", icon: "more" }),
      ]);
      document.body.append(nav);
      nav.addEventListener(
        "click",
        (ev) => {
          const b = ev.target.closest("button");
          if (!b) return;
          if (b.dataset.view) switchView(b.dataset.view);
          if (b.dataset.action === "add") openLead();
          if (b.dataset.action === "more") openMobileMore();
        },
        { signal }
      );
    }
    if (!$("mobileMore")) {
      const actions = [
        ["Checklist", "checklist"],
        ["Volume", "volume"],
        ["Benchmarks", "benchmarks"],
        ["History", "history"],
        ["Settings", "settings"],
        ["Export", "export"],
        ["Import", "import"],
        ["Print/PDF", "print"],
        ["Help", "help"],
        ["Specialties", "home"],
      ];
      const grid = e("div", { className: "mobile-action-grid" });
      actions.forEach(([label, act], i) => grid.append(e("button", { type: "button", className: i < 4 ? "primary-action" : "", dataset: { mobileAction: act }, textContent: label })));
      const sheet = e("div", { id: "mobileMore", className: "mobile-more-backdrop" }, [
        e("section", { className: "mobile-action-sheet" }, [
          e("h3", { textContent: "More tools" }),
          e("p", { textContent: "Open the full specialty tools without losing any data or details." }),
          grid,
          e("button", { className: "mobile-sheet-close", type: "button", textContent: "Close" }),
        ]),
      ]);
      document.body.append(sheet);
      sheet.addEventListener(
        "click",
        (ev) => {
          if (ev.target === sheet || ev.target.classList.contains("mobile-sheet-close")) closeMobileMore();
          const b = ev.target.closest("[data-mobile-action]");
          if (!b) return;
          const a = b.dataset.mobileAction;
          closeMobileMore();
          if (["checklist", "volume", "benchmarks", "history"].includes(a)) switchView(a);
          if (a === "settings") openSettings();
          if (a === "export") exportData();
          if (a === "import") $("importFile").click();
          if (a === "print") typeof printReport === "function" ? printReport() : window.print();
          if (a === "help") $("helpBtn").click();
          if (a === "home") goHome();
        },
        { signal }
      );
    }
    const hero = document.querySelector(".homeHero p");
    if (hero && !document.querySelector(".app-install-hint")) {
      hero.after(
        e("div", {
          className: "app-install-hint",
          textContent: "Tip: host this folder over HTTPS, then use your browser menu \u2192 Add to Home screen for a full app experience.",
        })
      );
    }
  }

  function openMobileMore() {
    $("mobileMore")?.classList.add("open");
  }
  function closeMobileMore() {
    $("mobileMore")?.classList.remove("open");
  }
  function updateMobileNav(view) {
    ensureMobileShell();
    document.querySelectorAll(".mobile-nav-btn").forEach((b) => b.setAttribute("aria-current", String(b.dataset.view === view)));
  }

  function enhanceLeadForm() {
    const form = $("leadForm");
    if (!form || $("leadStepBar")) return;
    const bar = e("div", { id: "leadStepBar", className: "lead-stepbar" }, [e("span"), e("span"), e("span"), e("span"), e("span"), e("span")]);
    $("leadId").after(bar);
    const fg = form.querySelector(".formgrid");
    if (fg) fg.before(e("div", { className: "stepLabel" }, [e("b", { textContent: "1" }), e("span", { textContent: "Core offer details" })]));
    const eq = $("hasEquity")?.closest(".toggle");
    if (eq) eq.before(e("div", { className: "stepLabel" }, [e("b", { textContent: "2" }), e("span", { textContent: "Upside, supervision, and quality terms" })]));
    const sc = $("scoreGrid");
    if (sc) sc.before(e("div", { className: "stepLabel" }, [e("b", { textContent: "3" }), e("span", { textContent: "Fit scoring and decision notes" })]));
  }

  function tagLeadWizardSteps() {
    const form = $("leadForm");
    if (!form) return;
    form.classList.add("mobile-wizard");
    Array.from(form.children).forEach((ch) => ch.classList.remove("mobile-step", "mobile-step-1", "mobile-step-2", "mobile-step-3"));
    const children = Array.from(form.children);
    const scoreStart = children.findIndex((ch) => ch.id === "scoreGrid" || ch.classList?.contains("scoregrid"));
    children.forEach((ch) => {
      if (ch.id === "leadId" || ch.id === "leadStepBar") return;
      if (ch.classList.contains("modalactions")) return;
      let step = 1;
      if (ch.classList.contains("toggle") || ch.classList.contains("conditional") || (ch.classList.contains("stepLabel") && ch.textContent.includes("Upside"))) step = 2;
      if (scoreStart >= 0 && children.indexOf(ch) >= scoreStart - 2) step = 3;
      if (ch.classList.contains("stepLabel") && ch.textContent.includes("Fit scoring")) step = 3;
      ch.classList.add("mobile-step", "mobile-step-" + step);
    });
    ensureWizardControls();
  }

  function ensureWizardControls() {
    if ($("mobileWizardControls")) return;
    const controls = e("div", { id: "mobileWizardControls", className: "mobile-wizard-controls" }, [
      e("button", { className: "mw-delete", type: "button", textContent: "Delete", onclick: () => $("deleteLeadBtn").click() }),
      e("button", { className: "mw-back", type: "button", textContent: "Back", onclick: () => setLeadWizardStep((Number($("leadForm").dataset.step) || 1) - 1) }),
      e("button", { className: "mw-next", type: "button", textContent: "Next", onclick: () => setLeadWizardStep((Number($("leadForm").dataset.step) || 1) + 1) }),
      e("button", { className: "mw-save", type: "button", textContent: "Save lead", onclick: () => $("leadForm").requestSubmit() }),
    ]);
    $("leadForm").after(controls);
  }

  function setLeadWizardStep(n) {
    const form = $("leadForm");
    if (!form) return;
    n = Math.max(1, Math.min(3, n));
    form.dataset.step = String(n);
    const bar = $("leadStepBar");
    if (bar) Array.from(bar.children).forEach((s, i) => s.classList.toggle("active", i < n * 2));
    const d = $("deleteLeadBtn");
    const md = document.querySelector(".mw-delete");
    if (md && d) md.hidden = d.hidden;
    const dialog = $("leadDialog");
    if (dialog) dialog.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openSpecialty(key) {
    await _baseOpenSpecialty(key);
    document.body.classList.add("in-tool");
    applySpecTheme();
    currentView = "dashboard";
    updateMobileNav("dashboard");
  }

  function goHome() {
    _baseGoHome();
    document.body.classList.remove("in-tool");
    currentView = "dashboard";
    closeMobileMore();
    applySpecTheme();
  }

  function openLead(id) {
    if (id === undefined) id = null;
    _baseOpenLead(id);
    tagLeadWizardSteps();
    setLeadWizardStep(1);
  }

  function saveLead(ev) {
    _baseSaveLead(ev);
  }

  function deleteLead() {
    _baseDeleteLead();
  }

  function resetSample() {
    _baseResetSample();
    render({ all: true });
  }

  function saveBenchmark(ev) {
    _baseSaveBenchmark(ev);
    render({ views: ["benchmarks", "dashboard", "compare"] });
  }

  function deleteBenchmark() {
    _baseDeleteBenchmark();
    render({ views: ["benchmarks", "dashboard", "compare"] });
  }

  function bindPhase1Events() {
    $("startCompareBtn")?.addEventListener("click", () => $("specialtyGrid").scrollIntoView({ behavior: "smooth" }), { signal });
    $("howItWorksBtn")?.addEventListener("click", () => $("helpBtn").click(), { signal });
    window.addEventListener(
      "resize",
      () => {
        if (currentSpec && (currentView === "checklist" || currentView === "volume")) renderView(currentView);
      },
      { signal }
    );
  }

  addReportTab();
  enhanceLeadForm();
  ensureMobileShell();
  ensurePwaManifest();
  bindPhase1Events();

  window.__p1Render = render;
  window.render = render;
  window.renderHome = renderHome;
  window.switchView = switchView;
  window.openSpecialty = openSpecialty;
  window.goHome = goHome;
  window.openLead = openLead;
  window.saveLead = saveLead;
  window.deleteLead = deleteLead;
  window.resetSample = resetSample;
  window.saveBenchmark = saveBenchmark;
  window.deleteBenchmark = deleteBenchmark;
  window.renderChecklist = renderChecklist;
  window.renderVolume = renderVolume;
  window.renderSelectors = renderSelectors;
  window.renderCompare = renderCompare;
  window.renderReport = renderReport;
  window.renderHistory = renderHistory;
  window.applySpecTheme = applySpecTheme;
})();

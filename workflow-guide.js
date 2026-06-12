/* Tier 4 workflow guidance + community benchmark reference (illustrative, not licensed data) */
(function () {
  "use strict";

  let guideData = null;
  let benchData = null;
  let panelOpen = true;

  function moneyShort(n) {
    if (!n || !Number.isFinite(n)) return "—";
    if (n >= 1000000) return "$" + (n / 1000000).toFixed(2).replace(/\.00$/, "") + "M";
    return "$" + Math.round(n / 1000) + "k";
  }

  async function loadGuideData() {
    if (guideData && benchData) return { guideData, benchData };
    const [g, b] = await Promise.all([
      fetch("data/workflow-guide.json").then((r) => (r.ok ? r.json() : null)),
      fetch("data/community-benchmarks.json").then((r) => (r.ok ? r.json() : null)),
    ]);
    guideData = g;
    benchData = b;
    return { guideData, benchData };
  }

  function contractDiligencePct() {
    if (!currentSpec) return 0;
    const grouped = EXPANDED_QUESTIONS[currentSpec] || {};
    const contractKey = Object.keys(grouped).find((k) => /contract|group/i.test(k));
    if (!contractKey) return 0;
    const qs = grouped[contractKey] || [];
    const leads = specState().leads;
    if (!leads.length || !qs.length) return 0;
    let answered = 0;
    let total = 0;
    leads.forEach((l) => {
      qs.forEach((q) => {
        total++;
        const key = questionKey(contractKey, q);
        if (String(l.diligence?.[key] || "").trim()) answered++;
      });
    });
    return total ? Math.round((answered / total) * 100) : 0;
  }

  function workflowStepEl(step, idx) {
    return e("li", { className: "workflow-step" }, [
      e("span", { className: "workflow-step-num", textContent: String(idx + 1) }),
      e("div", {}, [
        e("b", { textContent: step.title }),
        e("p", { textContent: step.detail }),
        step.tab
          ? e("button", {
              className: "btn btn-ghost btn-sm",
              type: "button",
              textContent: "Go to " + step.tab,
              onclick: () => switchView(step.tab),
            })
          : null,
      ]),
    ]);
  }

  function renderWorkflowPanel() {
    if (!currentSpec || !guideData) return;
    let panel = $("workflowGuidePanel");
    if (!panel) {
      const toolbar = document.querySelector("#dashboard .toolbar");
      if (!toolbar) return;
      panel = e("section", { className: "panel workflow-guide-panel", id: "workflowGuidePanel" });
      toolbar.after(panel);
    }
    clear(panel);
    const pct = contractDiligencePct();
    const norms = guideData.universalContractNorms || {};
    panel.append(
      e("header", { className: "workflow-guide-head" }, [
        e("div", {}, [
          e("h3", { textContent: guideData.title || "Offer diligence workflow" }),
          e("p", { className: "muted-copy", textContent: guideData.subtitle || "" }),
        ]),
        e("button", {
          className: "btn btn-ghost btn-sm",
          type: "button",
          id: "workflowGuideToggle",
          textContent: panelOpen ? "Collapse" : "Expand",
          onclick: () => {
            panelOpen = !panelOpen;
            $("workflowGuideBody").hidden = !panelOpen;
            $("workflowGuideToggle").textContent = panelOpen ? "Collapse" : "Expand";
          },
        }),
      ]),
      e("div", { id: "workflowGuideBody", hidden: !panelOpen }, [
        e("div", { className: "workflow-progress" }, [
          e("span", { textContent: "Contract diligence answered" }),
          e("strong", { textContent: pct + "%" }),
          e("div", { className: "completion-track" }, [
            e("span", { className: "completion-fill", style: "width:" + pct + "%" }),
          ]),
        ]),
        norms.noncompeteMonthsCommon
          ? e("p", {
              className: "workflow-norm muted-copy",
              textContent:
                "Community norm (illustrative): non-compete ~" +
                norms.noncompeteMilesAverage +
                " mi avg / " +
                norms.noncompeteMonthsMedian +
                " mo median — " +
                norms.source,
            })
          : null,
        e("ol", { className: "workflow-steps" }, (guideData.steps || []).map(workflowStepEl)),
      ])
    );
  }

  function benchRow(label, value) {
    if (value == null || value === "") return null;
    return e("tr", {}, [e("td", { textContent: label }), e("td", { textContent: String(value) })]);
  }

  function renderCommunityBenchmarkPanel() {
    if (!currentSpec || !benchData) return;
    const spec = benchData.specialties?.[currentSpec];
    if (!spec) return;
    let panel = $("communityBenchmarkPanel");
    if (!panel) {
      const host = document.querySelector("#benchmarks .warn");
      if (!host) return;
      panel = e("section", { className: "panel community-bench-panel", id: "communityBenchmarkPanel" });
      host.after(panel);
    }
    clear(panel);
    const uni = benchData.universal || {};
    const rows = [
      benchRow("Total comp (median)", moneyShort(spec.compMedian) + (spec.compRange ? " · range " + spec.compRange.replace(/000/g, "k") : "")),
      benchRow("25th / 75th", spec.compP25 ? moneyShort(spec.compP25) + " / " + moneyShort(spec.compP75) : null),
      benchRow("Productivity unit", spec.productivityUnit),
      benchRow("Productivity median", spec.prodMedian ? num(spec.prodMedian) + (spec.prodRange ? " (" + spec.prodRange + ")" : "") : null),
      benchRow("Rate per unit", spec.ratePerUnit),
      benchRow("Hourly (if applicable)", spec.hourlyMedian ? "$" + spec.hourlyMedian + "/hr (" + (spec.hourlyRange || "") + ")" : null),
      benchRow("Collections %", spec.collectionsPct),
      benchRow("Visits/day", spec.visitsPerDay),
      benchRow("Panel size", spec.panelSize),
      benchRow("Call / night", spec.callPayNight),
      benchRow("Sign-on (universal)", uni.signOn ? "$" + (uni.signOn.median / 1000) + "k typical" : null),
      benchRow("Non-compete norm", uni.noncompete ? uni.noncompete.durationMonthsTypical + " mo · ~" + uni.noncompete.radiusMilesMedian + " mi median" : null),
    ].filter(Boolean);

    panel.append(
      e("header", { className: "community-bench-head" }, [
        e("h3", { textContent: "Community reference — " + (spec.label || currentSpec) }),
        e("p", { className: "muted-copy", textContent: benchData.disclaimer || "" }),
      ]),
      e("table", { className: "community-bench-table" }, [
        e("tbody", {}, rows),
      ]),
      spec.sources?.length
        ? e("p", { className: "community-sources muted-copy", textContent: "Sources: " + spec.sources.join("; ") })
        : null,
      spec.workflowHints?.length
        ? e("div", { className: "community-hints" }, [
            e("b", { textContent: "Workflow hints" }),
            e("ul", {}, spec.workflowHints.map((h) => e("li", { textContent: h }))),
          ])
        : null,
      spec.redFlags?.length
        ? e("div", { className: "community-redflags" }, [
            e("b", { textContent: "Common red flags (community)" }),
            e("ul", {}, spec.redFlags.map((h) => e("li", { textContent: h }))),
          ])
        : null,
      e("div", { className: "btns", style: "margin-top:12px" }, [
        e("button", {
          className: "btn",
          type: "button",
          textContent: "Copy medians to benchmark form",
          onclick: () => prefillBenchmarkFromCommunity(spec),
        }),
      ])
    );
  }

  function prefillBenchmarkFromCommunity(spec) {
    openBenchmark();
    if (spec.compMedian) $("compP50").value = spec.compMedian;
    if (spec.compP25) $("compP25").value = spec.compP25;
    if (spec.compP75) $("compP75").value = spec.compP75;
    if (spec.prodMedian) $("prodP50").value = spec.prodMedian;
    const rate = String(spec.ratePerUnit || "").split("–")[0].replace(/[^\d.]/g, "");
    if (rate) $("compPerUnitP50").value = rate;
    $("benchSource").value = "Community reference (verify with licensed data)";
    $("benchNotes").value =
      "Prefilled from community benchmarks (" +
      (benchData.updated || "2026") +
      "). Replace with MGMA/AMGA/internal values you have rights to use. Not legal advice.";
    toast("Community medians copied — replace with your licensed benchmark source.", "info");
  }

  function renderQuestionsWorkflowBanner() {
    if (!currentSpec || !guideData) return;
    let banner = $("questionsWorkflowBanner");
    const host = document.querySelector("#questions .section-head");
    if (!host) return;
    if (!banner) {
      banner = e("div", { className: "notice workflow-questions-banner", id: "questionsWorkflowBanner" });
      host.after(banner);
    }
    const contractGroup = Object.keys(EXPANDED_QUESTIONS[currentSpec] || {}).find((k) => /contract|group/i.test(k));
    clear(banner);
    banner.append(
      e("strong", { textContent: "Contract workflow: " }),
      e("span", {
        textContent:
          "Complete \"" +
          (contractGroup || "Contract risk") +
          "\" for each lead before setting Risk Safety. Quantify non-compete and tail in the Volume tab.",
      })
    );
  }

  function renderVolumeContractHint() {
    if (!currentSpec) return;
    let hint = $("volumeContractHint");
    const host = document.querySelector("#volume .section-head");
    if (!host) return;
    if (!hint) {
      hint = e("div", { className: "notice volume-contract-hint", id: "volumeContractHint" });
      host.after(hint);
    }
    hint.textContent =
      "Contract rows (bottom of table): enter non-compete miles, duration (months), and tail payer/estimate. Example: \"20\" / \"18\" / \"Employer-paid occurrence\".";
  }

  function injectHelpWorkflowSection() {
    const grid = document.querySelector("#helpDialog .grid");
    if (!grid || $("helpWorkflowCard")) return;
    grid.prepend(
      e("article", { className: "qcard", id: "helpWorkflowCard" }, [
        e("h3", { textContent: "Offer diligence workflow" }),
        e("ul", {}, [
          e("li", { textContent: "Answer Contract risk questions for every lead (Questions tab)." }),
          e("li", { textContent: "Enter non-compete miles/months and tail estimate in Volume (last 3 rows)." }),
          e("li", { textContent: "Use Benchmarks for licensed data; community reference panel shows forum/salary-report ranges." }),
          e("li", { textContent: "Log deal-breakers in Cons and Follow-up on each lead." }),
          e("li", { textContent: "Set Risk Safety score only after contract diligence is documented." }),
        ]),
        e("p", { className: "muted-copy", textContent: benchData?.disclaimer || "Community benchmarks are illustrative only." }),
      ])
    );
  }

  function updateHomeWorkflowSteps() {
    const steps = document.querySelectorAll("#home .workflow .step");
    if (steps.length < 3 || !guideData) return;
    const copy = [
      ["Pick a specialty", "Each workspace has checklist, volume (incl. contract rows), and diligence questions."],
      ["Document every offer", "Comp, contract terms, benchmarks, APP/quality — complete Contract risk before scoring risk."],
      ["Compare and export", "Side-by-side compare, community reference ranges, attorney-ready report."],
    ];
    steps.forEach((step, i) => {
      if (!copy[i]) return;
      const h = step.querySelector("h3");
      const p = step.querySelector("p");
      if (h) h.textContent = copy[i][0];
      if (p) p.textContent = copy[i][1];
    });
  }

  async function refreshWorkflowUi() {
    await loadGuideData();
    renderWorkflowPanel();
    renderCommunityBenchmarkPanel();
    renderQuestionsWorkflowBanner();
    renderVolumeContractHint();
    injectHelpWorkflowSection();
    updateHomeWorkflowSteps();
  }

  function hookRenderPipeline() {
    const p1 = window.__p1Render;
    if (p1 && !p1.__workflowWrapped) {
      window.__p1Render = function workflowRender(opts) {
        const out = p1(opts);
        refreshWorkflowUi();
        return out;
      };
      window.__p1Render.__workflowWrapped = true;
      window.render = window.__p1Render;
    }
    const sv = window.switchView;
    if (sv && !sv.__workflowWrapped) {
      window.switchView = function workflowSwitchView(v) {
        sv(v);
        refreshWorkflowUi();
      };
      window.switchView.__workflowWrapped = true;
    }
  }

  function bindWorkflowButton() {
    const btn = $("workflowGuideBtn");
    if (!btn || btn.__workflowBound) return;
    btn.__workflowBound = true;
    btn.addEventListener("click", () => {
      switchView("dashboard");
      panelOpen = true;
      setTimeout(() => {
        const panel = $("workflowGuidePanel");
        const body = $("workflowGuideBody");
        if (body) body.hidden = false;
        if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    });
  }

  async function initWorkflowGuide() {
    await loadGuideData();
    hookRenderPipeline();
    bindWorkflowButton();
    injectHelpWorkflowSection();
    updateHomeWorkflowSteps();
    if (currentSpec) refreshWorkflowUi();
  }

  window.initWorkflowGuide = initWorkflowGuide;
  window.refreshWorkflowUi = refreshWorkflowUi;
  window.prefillBenchmarkFromCommunity = prefillBenchmarkFromCommunity;
})();

/* Phase 3: Free/Pro tiers, watermarked reports, Stripe scaffold, cloud backup */
(function () {
  "use strict";

  const CONFIG_URL = "config/monetization.json";
  const CLOUD_STORE = "sjc-cloud-snapshots-v1";

  let config = {
    limits: { freeMaxLeadsPerSpecialty: 3, freeMaxCompareJobs: 2, freeHistoryEntries: 100 },
    devLicenseKeys: [],
    stripePaymentLink: "",
    stripeAnnualPaymentLink: "",
    cloudBackupUrl: "",
  };

  let _openLead;
  let _saveLead;
  let _openSettings;
  let _saveSettings;
  const _coreInit = window.coreInit;
  if (typeof _coreInit !== "function") {
    throw new Error("[SJC] coreInit missing — check script order: phase2.js → app.js → phase1.js → phase3.js → phase4.js → bootstrap.js");
  }

  function installWrappers() {
    _openLead = window.openLead;
    _saveLead = window.saveLead;
    _openSettings = window.openSettings;
    _saveSettings = window.saveSettings;
  }

  function ensurePlanSettings() {
    if (!state.settings) state.settings = {};
    if (!state.settings.plan) state.settings.plan = "free";
    if (!state.settings.licenseKey) state.settings.licenseKey = "";
    if (!state.settings.cloudBackupToken) state.settings.cloudBackupToken = "";
    if (!state.settings.proActivatedAt) state.settings.proActivatedAt = null;
    if (!state.settings.lastCloudBackup) state.settings.lastCloudBackup = null;
  }

  function isPro() {
    ensurePlanSettings();
    if (state.settings.plan === "pro") {
      if (state.settings.proExpiresAt) {
        const exp = new Date(state.settings.proExpiresAt);
        if (Number.isFinite(exp.getTime()) && exp < new Date()) {
          state.settings.plan = "free";
          scheduleSave();
          return false;
        }
      }
      return true;
    }
    return false;
  }

  function leadLimit() {
    return isPro() ? Infinity : (config.limits?.freeMaxLeadsPerSpecialty || 3);
  }

  function compareLimit() {
    return isPro() ? Infinity : (config.limits?.freeMaxCompareJobs || 2);
  }

  function freeSpecialtyList() {
    return Array.isArray(config.freeSpecialties) && config.freeSpecialties.length
      ? config.freeSpecialties
      : ["pain", "peds"];
  }

  function canOpenSpecialty(key) {
    return isPro() || freeSpecialtyList().includes(key);
  }

  function canAddLead() {
    if (!currentSpec) return true;
    return specState().leads.length < leadLimit();
  }

  function activatePro(source) {
    ensurePlanSettings();
    state.settings.plan = "pro";
    state.settings.proActivatedAt = new Date().toISOString();
    state.settings.proSource = sanitize(String(source || "upgrade"), 80);
    delete state.settings.proExpiresAt;
    scheduleSave();
    refreshPlanUi();
    toast("Pro activated. Enjoy unlimited leads and clean PDF reports.");
  }

  function validateLicenseKey(key) {
    const k = String(key || "").trim().toUpperCase();
    if (!k) return false;
    const allowed = (config.devLicenseKeys || []).map((x) => String(x).trim().toUpperCase());
    return allowed.includes(k);
  }

  async function loadConfig() {
    try {
      const res = await fetch(CONFIG_URL);
      if (res.ok) Object.assign(config, await res.json());
    } catch (err) {
      console.warn("Monetization config not loaded", err);
    }
  }

  function refreshPlanUi() {
    const badge = $("planBadge");
    if (badge) {
      badge.textContent = isPro() ? "Pro" : "Free";
      badge.className = "plan-badge " + (isPro() ? "pro" : "free");
      badge.title = isPro() ? "Pro plan active" : "Free plan — upgrade for clean PDFs and cloud backup";
    }
    document.body.classList.toggle("is-pro", isPro());
    document.body.classList.toggle("is-free", !isPro());
    const report = $("report");
    if (report) report.classList.toggle("report-watermarked", !isPro());
  }

  function openUpgrade(reason) {
    const backdrop = $("upgradeBackdrop");
    if (!backdrop) return;
    const note = $("upgradeReason");
    if (note) note.textContent = reason || "Unlock unlimited leads, clean attorney-ready PDFs, and encrypted cloud backup.";
    backdrop.classList.add("open");
    document.body.classList.add("modal-open");
  }

  function closeUpgrade() {
    $("upgradeBackdrop")?.classList.remove("open");
    if (!document.querySelector(".backdrop.open")) document.body.classList.remove("modal-open");
  }

  function startStripeCheckout(annual) {
    const url = annual ? config.stripeAnnualPaymentLink || config.stripePaymentLink : config.stripePaymentLink;
    if (!url) {
      toast("Stripe checkout URL not configured yet. Use a license key in Settings for testing.");
      openSettings();
      return;
    }
    const returnUrl = new URL(location.href);
    returnUrl.searchParams.set(config.successReturnParam || "upgrade", "success");
    const checkout = new URL(url);
    if (checkout.searchParams.has("client_reference_id") === false) {
      checkout.searchParams.set("client_reference_id", "sjc-local");
    }
    checkout.searchParams.set("success_url", returnUrl.toString());
    checkout.searchParams.set("cancel_url", location.href);
    window.open(checkout.toString(), "_blank", "noopener");
    closeUpgrade();
    toast("Complete checkout in the new tab. Pro unlocks when you return.");
  }

  function handleUpgradeReturn() {
    const param = config.successReturnParam || "upgrade";
    const params = new URLSearchParams(location.search);
    if (params.get(param) === "success") {
      activatePro("stripe");
      params.delete(param);
      const next = params.toString();
      history.replaceState({}, "", location.pathname + (next ? "?" + next : "") + location.hash);
    }
  }

  function printReport() {
    if (!isPro()) {
      document.body.classList.add("printing-watermarked");
      const report = $("report");
      if (report) report.classList.add("report-watermarked");
    }
    window.print();
    setTimeout(() => {
      document.body.classList.remove("printing-watermarked");
    }, 500);
  }

  async function saveCloudSnapshot(label) {
    const pkg = await makePackage();
    const snapshot = {
      id: uid(),
      label: sanitize(label || "Manual backup", 120),
      at: new Date().toISOString(),
      plan: state.settings.plan,
      payload: pkg,
    };
    const raw = await appStorageGet(CLOUD_STORE);
    let list = [];
    try {
      list = raw ? JSON.parse(raw) : [];
    } catch {
      list = [];
    }
    if (!Array.isArray(list)) list = [];
    list.unshift(snapshot);
    list = list.slice(0, 12);
    await appStorageSet(CLOUD_STORE, JSON.stringify(list));
    state.settings.lastCloudBackup = snapshot.at;
    scheduleSave();
    return snapshot;
  }

  async function syncCloudBackup() {
    if (!isPro()) {
      openUpgrade("Cloud backup is a Pro feature. Keep a local copy with Export until you upgrade.");
      return;
    }
    const url = String(config.cloudBackupUrl || "").trim();
    if (!url) {
      const snap = await saveCloudSnapshot("Local Pro snapshot");
      toast("Cloud endpoint not configured. Saved local Pro snapshot (" + new Date(snap.at).toLocaleString() + ").");
      refreshCloudStatus();
      return;
    }
    try {
      setStatus("Syncing…", "saving");
      const pkg = await makePackage();
      const token = state.settings.cloudBackupToken || "";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({
          version: APP_VERSION,
          at: new Date().toISOString(),
          plan: "pro",
          payload: pkg,
        }),
      });
      if (!res.ok) throw new Error("Backup failed (" + res.status + ")");
      state.settings.lastCloudBackup = new Date().toISOString();
      await saveCloudSnapshot("Post-sync snapshot");
      scheduleSave();
      setStatus("Saved", "saved");
      toast("Cloud backup synced successfully.");
      refreshCloudStatus();
    } catch (err) {
      console.error(err);
      setStatus("Error", "error");
      toast("Cloud backup failed: " + (err.message || err));
    }
  }

  async function restoreLatestCloudSnapshot() {
    const raw = await appStorageGet(CLOUD_STORE);
    if (!raw) {
      toast("No local cloud snapshots found.");
      return;
    }
    let list = [];
    try {
      list = JSON.parse(raw);
    } catch {
      toast("Snapshot store is corrupted.");
      return;
    }
    const snap = Array.isArray(list) ? list[0] : null;
    if (!snap?.payload) {
      toast("No snapshots to restore.");
      return;
    }
    if (!confirm("Restore backup from " + new Date(snap.at).toLocaleString() + "? Current data will be replaced.")) return;
    if (!(await validatePackage(snap.payload))) {
      toast("Snapshot failed validation.");
      return;
    }
    state = await cleanState(snap.payload.payload.state);
    renderHome();
    if (currentSpec) render({ all: true });
    scheduleSave();
    toast("Restored from cloud snapshot.");
  }

  function refreshCloudStatus() {
    const el = $("cloudBackupStatus");
    if (!el) return;
    const at = state.settings.lastCloudBackup;
    el.textContent = at ? "Last backup: " + new Date(at).toLocaleString() : "No backup yet";
  }

  function injectUpgradeModal() {
    if ($("upgradeBackdrop")) return;
    document.body.append(
      e("div", { className: "backdrop", id: "upgradeBackdrop" }, [
        e("section", { className: "modal upgrade-modal", role: "dialog", ariaModal: "true", id: "upgradeDialog", tabIndex: "-1" }, [
          e("header", { className: "modalhead" }, [
            e("div", {}, [
              e("h2", { textContent: "Upgrade to Pro" }),
              e("p", { id: "upgradeReason", textContent: "Unlock unlimited leads, clean attorney-ready PDFs, and encrypted cloud backup." }),
            ]),
            e("button", { className: "icon", id: "closeUpgradeBtn", type: "button", textContent: "×" }),
          ]),
          e("section", { className: "pricing-grid" }, [
            e("article", { className: "pricing-card" }, [
              e("h3", { textContent: "Free" }),
              e("p", { className: "price", textContent: "$0" }),
              e("ul", {}, [
                e("li", { textContent: "Up to 3 leads per specialty" }),
                e("li", { textContent: "Watermarked PDF reports" }),
                e("li", { textContent: "Local save + JSON export" }),
              ]),
              e("button", { className: "btn", type: "button", textContent: "Current plan", disabled: true }),
            ]),
            e("article", { className: "pricing-card featured" }, [
              e("span", { className: "pricing-badge", textContent: "Recommended" }),
              e("h3", { textContent: "Pro" }),
              e("p", { className: "price", textContent: config.pricing?.annual?.label || "$99 / year" }),
              e("ul", {}, [
                e("li", { textContent: "Unlimited job leads" }),
                e("li", { textContent: "Clean, attorney-ready PDF reports" }),
                e("li", { textContent: "Encrypted cloud backup sync" }),
                e("li", { textContent: "Full negotiation history" }),
              ]),
              e("div", { className: "btns" }, [
                e("button", { className: "primary", type: "button", id: "upgradeAnnualBtn", textContent: "Upgrade annually" }),
                e("button", { className: "btn", type: "button", id: "upgradeMonthlyBtn", textContent: "Monthly plan" }),
              ]),
            ]),
          ]),
          e("div", { className: "notice", style: "margin-top:16px" }, [
            e("strong", { textContent: "Testing: " }),
            "Enter license key ",
            e("code", { textContent: "DEMO-PRO-2026" }),
            " in Settings to unlock Pro without Stripe.",
          ]),
        ]),
      ])
    );
  }

  function injectPlanBadge() {
    const btns = document.querySelector(".top .btns");
    if (!btns || $("planBadge")) return;
    const badge = e("button", {
      className: "plan-badge free",
      id: "planBadge",
      type: "button",
      textContent: "Free",
      title: "View plans",
      onclick: () => (isPro() ? openSettings() : openUpgrade()),
    });
    btns.insertBefore(badge, btns.firstChild);
  }

  function extendSettingsModal() {
    const dialog = $("settingsDialog");
    if (!dialog || $("planSettingsSection")) return;
    const grid = dialog.querySelector(".formgrid");
    if (!grid) return;

    const section = e("div", { id: "planSettingsSection", className: "plan-settings" }, [
      e("hr", { className: "divider" }),
      e("h3", { textContent: "Plan & billing" }),
      e("p", { className: "muted-copy", textContent: "Pro unlocks unlimited leads, clean PDF exports, and cloud backup." }),
      e("label", {}, ["License key (optional)", e("input", { id: "settingLicenseKey", maxlength: 80, placeholder: "Enter Pro license key" })]),
      e("label", {}, ["Cloud backup token (optional)", e("input", { id: "settingCloudToken", maxlength: 200, placeholder: "Bearer token for your backup API" })]),
      e("div", { className: "cloud-actions" }, [
        e("button", { className: "btn", type: "button", id: "cloudBackupBtn", textContent: "Sync cloud backup" }),
        e("button", { className: "btn", type: "button", id: "cloudRestoreBtn", textContent: "Restore latest snapshot" }),
      ]),
      e("p", { className: "cloud-status", id: "cloudBackupStatus", textContent: "No backup yet" }),
      e("button", { className: "primary", type: "button", id: "openUpgradeFromSettings", textContent: "View Pro plans", style: "margin-top:12px;width:100%" }),
    ]);
    grid.append(section);
  }

  function bindPhase3Events() {
    $("closeUpgradeBtn")?.addEventListener("click", closeUpgrade, { signal });
    $("upgradeBackdrop")?.addEventListener("click", (ev) => {
      if (ev.target === $("upgradeBackdrop")) closeUpgrade();
    }, { signal });
    $("upgradeAnnualBtn")?.addEventListener("click", () => startStripeCheckout(true), { signal });
    $("upgradeMonthlyBtn")?.addEventListener("click", () => startStripeCheckout(false), { signal });
    $("openUpgradeFromSettings")?.addEventListener("click", () => {
      closeModal();
      openUpgrade();
    }, { signal });
    $("cloudBackupBtn")?.addEventListener("click", syncCloudBackup, { signal });
    $("cloudRestoreBtn")?.addEventListener("click", restoreLatestCloudSnapshot, { signal });
  }

  function openLead(id) {
    if (id == null && !canAddLead()) {
      openUpgrade("Free plan supports up to " + leadLimit() + " leads per specialty. Upgrade for unlimited comparisons.");
      return;
    }
    _openLead(id);
  }

  function saveLead(ev) {
    const id = $("leadId")?.value;
    const isNew = !id || !specState().leads.some((l) => l.id === id);
    if (isNew && !canAddLead()) {
      ev.preventDefault();
      openUpgrade("Free plan supports up to " + leadLimit() + " leads per specialty.");
      return;
    }
    _saveLead(ev);
  }

  function openSettings() {
    _openSettings();
    $("settingLicenseKey").value = state.settings.licenseKey || "";
    $("settingCloudToken").value = state.settings.cloudBackupToken || "";
    refreshCloudStatus();
    const up = $("openUpgradeFromSettings");
    if (up) up.hidden = isPro();
  }

  async function saveSettings() {
    const key = $("settingLicenseKey")?.value?.trim() || "";
    const token = $("settingCloudToken")?.value?.trim() || "";
    if (key && validateLicenseKey(key)) {
      state.settings.licenseKey = key.toUpperCase();
      activatePro("license");
    } else if (key) {
      toast("Invalid license key.");
      return;
    } else {
      state.settings.licenseKey = "";
    }
    state.settings.cloudBackupToken = sanitize(token, 200);
    await _saveSettings();
    refreshPlanUi();
  }

  function verifyStartup() {
    const count = Object.keys(window.SPECIALTY_INDEX || {}).length;
    const grid = $("specialtyGrid");
    if (count === 0) {
      console.error("[SJC] Startup verification failed: specialty index is empty after init");
      toast("Specialties failed to load. Hard-refresh (Ctrl+Shift+R) or clear site cache.");
      return false;
    }
    if (grid && !grid.children.length && typeof renderHome === "function") {
      renderHome();
    }
    const settingsBtn = $("settingsBtn");
    if (settingsBtn?.hidden) {
      settingsBtn.hidden = false;
      console.warn("[SJC] Settings button was hidden on home — corrected");
    }
    return true;
  }

  function trimHistoryForFree() {
    if (isPro()) return;
    const days = config.limits?.freeHistoryDays || 30;
    const cutoff = Date.now() - days * 86400000;
    const max = config.limits?.freeHistoryEntries || 100;
    Object.keys(state.data || {}).forEach((key) => {
      const bucket = state.data[key];
      if (!bucket || !Array.isArray(bucket.history)) return;
      bucket.history = bucket.history
        .filter((entry) => {
          const t = Date.parse(entry.at);
          return Number.isFinite(t) ? t >= cutoff : true;
        })
        .slice(-max);
    });
  }

  function wrapOpenSpecialty() {
    const base = window.openSpecialty;
    if (!base || base.__tierWrapped) return;
    window.openSpecialty = async function gatedOpenSpecialty(key) {
      if (!canOpenSpecialty(key)) {
        openUpgrade("Free plan includes " + freeSpecialtyList().map((k) => SPECIALTY_INDEX[k]?.name || k).join(" and ") + ". Upgrade for all " + Object.keys(SPECIALTY_INDEX || {}).length + " specialties.");
        return;
      }
      return base(key);
    };
    window.openSpecialty.__tierWrapped = true;
  }

  async function phase3PreInit() {
    installWrappers();
    await loadConfig();
    injectUpgradeModal();
    injectPlanBadge();
    extendSettingsModal();
    bindPhase3Events();
    handleUpgradeReturn();
    window.openLead = openLead;
    window.saveLead = saveLead;
    window.openSettings = openSettings;
    window.saveSettings = saveSettings;
    window.canOpenSpecialty = canOpenSpecialty;
    window.freeSpecialtyList = freeSpecialtyList;
  }

  async function phase3PostInit() {
    wrapOpenSpecialty();
    verifyStartup();
    ensurePlanSettings();
    if (state.settings.licenseKey && validateLicenseKey(state.settings.licenseKey)) {
      state.settings.plan = "pro";
    }
    trimHistoryForFree();
    refreshPlanUi();
  }

  window.isPro = isPro;
  window.canAddLead = canAddLead;
  window.leadLimit = leadLimit;
  window.compareLimit = compareLimit;
  window.openUpgrade = openUpgrade;
  window.printReport = printReport;
  window.syncCloudBackup = syncCloudBackup;
  window.activatePro = activatePro;
  window.verifyStartup = verifyStartup;
  window.canOpenSpecialty = canOpenSpecialty;
  window.phase3PreInit = phase3PreInit;
  window.phase3PostInit = phase3PostInit;
})();

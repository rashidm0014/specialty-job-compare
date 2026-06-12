/* Unified app bootstrap — single startup pipeline (no recursive init) */
(function () {
  "use strict";

  const steps = [];

  window.registerBootstrapStep = function registerBootstrapStep(name, fn, order) {
    steps.push({ name, fn, order: order ?? steps.length * 10 });
  };

  async function startApp() {
    steps.sort((a, b) => a.order - b.order);
    for (const step of steps) {
      await step.fn();
    }
  }

  window.startApp = startApp;

  registerBootstrapStep("phase4-pre", () => {
    if (typeof initPhase4 === "function") initPhase4();
  }, 10);

  registerBootstrapStep("phase3-pre", async () => {
    if (typeof phase3PreInit === "function") await phase3PreInit();
  }, 20);

  registerBootstrapStep("core", async () => {
    if (typeof coreInit !== "function") throw new Error("[SJC] coreInit missing — load app.js before bootstrap");
    await coreInit();
  }, 30);

  registerBootstrapStep("share-view", async () => {
    if (typeof tryLoadShareView === "function") await tryLoadShareView();
  }, 35);

  registerBootstrapStep("phase3-post", async () => {
    if (typeof phase3PostInit === "function") await phase3PostInit();
  }, 40);

  registerBootstrapStep("workflow-guide", async () => {
    if (typeof initWorkflowGuide === "function") await initWorkflowGuide();
  }, 45);
})();

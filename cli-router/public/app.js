"use strict";

const apiBase = document.documentElement.dataset.apiBase || "/api";
const hosted = document.documentElement.hasAttribute("data-api-base");
const form = document.querySelector("#route-form");
const promptInput = document.querySelector("#prompt");
const directoryInput = document.querySelector("#cwd");
const outputInput = document.querySelector("#output-tokens");
const routeButton = document.querySelector("#route-button");
const errorBox = document.querySelector("#form-error");
const resultPanel = document.querySelector("#result-panel");
const resultContent = document.querySelector("#result-content");
const emptyState = document.querySelector("#empty-state");
const loadingState = document.querySelector("#loading-state");
const agentNames = { codex: "Codex CLI", claude: "Claude Code" };
let config = null;
let currentResult = null;
let activeRequest = null;
let requestVersion = 0;
let toastTimeout = null;

function text(selector, value) {
  document.querySelector(selector).textContent = value;
}

function money(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  if (value === 0) return "$0.00";
  if (Math.abs(value) < 0.0001) return "$" + value.toFixed(6);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
  }).format(value);
}

function unitPrice(value) {
  return typeof value === "number" && Number.isFinite(value) ? "$" + value.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—";
}

function count(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : "unknown";
}

function setState(state) {
  emptyState.hidden = state !== "empty";
  loadingState.hidden = state !== "loading";
  resultContent.hidden = state !== "result";
  resultPanel.setAttribute("aria-busy", String(state === "loading"));
  routeButton.disabled = !config || state === "loading";
  text("#route-button-label", state === "loading" ? "Finding your model…" : "Find my model");
  text("#route-button-icon", state === "loading" ? "·" : "↗");
  text("#result-state", state === "loading" ? "Considering your task" : state === "result" ? "Review, copy, run" : "Ready when you are");
}

function invalidateResult() {
  requestVersion += 1;
  if (activeRequest) activeRequest.abort();
  activeRequest = null;
  currentResult = null;
  text("#native-command", "");
  text("#run-command", "");
  errorBox.hidden = true;
  setState("empty");
  text("#prompt-length", count(promptInput.value.length) + " characters");
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function renderCosts(result) {
  const costs = result.costs || {};
  text("#selected-cost", money(costs.selectedUsd));
  const delta = costs.deltaVsBalancedUsd;
  const deltaElement = document.querySelector("#cost-difference");
  deltaElement.classList.remove("savings", "more");
  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    deltaElement.textContent = "Not available";
  } else if (Math.abs(delta) < 0.00000001) {
    deltaElement.textContent = "Same estimate";
  } else {
    deltaElement.textContent = money(Math.abs(delta)) + (delta < 0 ? " less" : " more");
    deltaElement.classList.add(delta < 0 ? "savings" : "more");
  }
  text("#cost-basis", "≈ " + count(costs.inputTokens) + " prompt tokens · " + count(costs.outputTokens) + " assumed output tokens");
  const tbody = document.querySelector("#cost-rows");
  tbody.replaceChildren();
  for (const row of costs.rows || []) {
    const tr = document.createElement("tr");
    const isSelected = row.tier === result.tier;
    if (isSelected) tr.classList.add("selected");
    const modelCell = document.createElement("td");
    const tier = document.createElement("span");
    tier.className = "table-tier";
    tier.textContent = row.tier;
    if (isSelected) {
      const selected = document.createElement("span");
      selected.className = "selected-indicator";
      selected.textContent = "✓";
      selected.setAttribute("aria-label", "selected");
      tier.append(selected);
    }
    const model = document.createElement("span");
    model.className = "table-model";
    model.textContent = row.model + (row.effort ? " · " + row.effort : "");
    modelCell.append(tier, model);
    const prices = document.createElement("td");
    prices.className = "table-prices";
    prices.textContent = unitPrice(row.inputPerMillion) + " / " + unitPrice(row.outputPerMillion);
    const estimate = document.createElement("td");
    estimate.className = "table-estimate";
    estimate.textContent = money(row.estimatedUsd);
    tr.append(modelCell, prices, estimate);
    tbody.append(tr);
  }
  const notes = [costs.note, "API token estimates, not a subscription bill or a full coding session. Repository context, tool calls, caching, and actual reasoning can change usage."];
  text("#cost-note", notes.filter(Boolean).join(" "));
  text("#pricing-date", config.pricingDate ? "Pricing reference: " + config.pricingDate + ". Review your provider’s current rates." : "Review your provider’s current rates.");
}

function renderResult(result) {
  currentResult = result;
  text("#selected-tier", result.tier);
  text("#selected-model", result.model);
  text("#selected-agent", agentNames[result.agent] || result.agent);
  text("#selected-effort", result.effort ? result.effort + " reasoning effort" : "No configurable reasoning effort");
  const fallback = result.source === "fallback";
  document.querySelector("#routing-note").classList.toggle("fallback", fallback);
  text("#routing-source", fallback ? "Balanced fallback" : "Selected by Jev");
  text("#routing-reason", result.reason || (fallback ? "Jev was unavailable or could not meet the confidence threshold." : "This model fits the scope of your task."));
  const confidence = document.querySelector("#routing-confidence");
  const hasConfidence = typeof result.confidence === "number" && Number.isFinite(result.confidence);
  const hasMargin = typeof result.margin === "number" && Number.isFinite(result.margin);
  confidence.hidden = !hasConfidence && !hasMargin;
  confidence.textContent = [hasConfidence ? Math.round(result.confidence * 100) + "% confidence" : null, hasMargin ? (result.margin * 100).toFixed(1).replace(/\.0$/, "") + "-point margin" : null].filter(Boolean).join(" · ");
  text("#native-command", result.command);
  text("#run-command", result.runCommand || "");
  document.querySelector(".consent-command").hidden = !result.runCommand;
  document.querySelector(".consent-command").open = false;
  renderCosts(result);
  setState("result");
  document.querySelector("#selected-model").focus({ preventScroll: true });
  if (window.matchMedia("(max-width: 780px)").matches) {
    resultPanel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
}

async function routePrompt(event) {
  event.preventDefault();
  if (!config) return;
  const directory = directoryInput.value.trim();
  const absolutePath = directory.startsWith("/") || /^[A-Za-z]:[\\/]/.test(directory) || directory.startsWith("\\\\");
  directoryInput.setCustomValidity(directory && !absolutePath ? "Use an absolute directory path, such as /Users/you/project." : "");
  if (!directoryInput.validity.valid || !outputInput.validity.valid) {
    document.querySelector(".advanced-settings").open = true;
  }
  if (!form.reportValidity()) return;
  const prompt = promptInput.value.trim();
  if (!prompt) {
    showError("Add a prompt so the router can choose a model.");
    promptInput.focus();
    return;
  }
  if (!directoryInput.value.trim()) {
    document.querySelector(".advanced-settings").open = true;
    showError("Add a working directory for the command.");
    directoryInput.focus();
    return;
  }
  const requestId = ++requestVersion;
  if (activeRequest) activeRequest.abort();
  activeRequest = new AbortController();
  currentResult = null;
  errorBox.hidden = true;
  setState("loading");
  const data = new FormData(form);
  try {
    const response = await fetch(`${apiBase}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": config.csrfToken },
      body: JSON.stringify({
        prompt,
        agent: data.get("agent"),
        cwd: directoryInput.value.trim(),
        costPriority: data.get("costPriority"),
        outputTokens: Number(outputInput.value),
        strict: data.get("strict") === "on",
      }),
      signal: activeRequest.signal,
    });
    const result = await response.json();
    if (requestId !== requestVersion) return;
    if (!response.ok) throw new Error(result.error || "Routing could not be completed. Try again.");
    if (!result.model || !result.command) throw new Error("The router returned an incomplete result. Try again.");
    renderResult(result);
  } catch (error) {
    if (error.name === "AbortError" || requestId !== requestVersion) return;
    setState("empty");
    showError(error instanceof TypeError ? (hosted ? "Could not reach the router. Check your connection, then try again." : "Could not reach the local router. Check that the server is running, then try again.") : error.message);
  } finally {
    if (requestId === requestVersion) activeRequest = null;
  }
}

function toast(message) {
  const element = document.querySelector("#toast");
  window.clearTimeout(toastTimeout);
  element.textContent = message;
  element.hidden = false;
  toastTimeout = window.setTimeout(() => { element.hidden = true; }, 3500);
}

async function copyCommand(kind) {
  if (!currentResult) return;
  const command = kind === "run" ? currentResult.runCommand : currentResult.command;
  if (!command) return;
  try {
    await navigator.clipboard.writeText(command);
    toast("Command copied. Nothing has been run.");
  } catch {
    const code = document.querySelector(kind === "run" ? "#run-command" : "#native-command");
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
    toast("Clipboard unavailable. Command selected; press ⌘C or Ctrl+C to copy.");
  }
}

async function initialize() {
  if (hosted) {
    document.title = "CLI Router · AI Model Picker";
    document.querySelector("#home-link").hidden = false;
    document.querySelector(".brand").href = "/cli-router";
    text("#connection-label", "Connecting to router");
    text("#hosting-label", "Commands run in your terminal ↗");
    text("#privacy-copy", "Your prompt, agent, directory path, and routing settings go to this server. Jev receives only the prompt, agent, and path. Repository files are not uploaded.");
  }
  try {
    const response = await fetch(`${apiBase}/config`, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load the router configuration.");
    const settings = await response.json();
    if (!settings.csrfToken) throw new Error("The router did not return a valid session. Reload the page.");
    config = settings;
    directoryInput.value = config.cwd || "";
    directoryInput.placeholder = "/Users/you/project";
    if (!directoryInput.value) {
      document.querySelector(".advanced-settings").open = true;
      text("#cwd-help", "Required: enter the absolute project path on your machine. The website cannot detect it.");
    }
    text("#connection-label", config.jevConfigured ? "Jev configured" : "Balanced fallback ready");
    document.querySelector("#connection-status").classList.add(config.jevConfigured ? "connected" : "fallback");
    setState("empty");
  } catch (error) {
    text("#connection-label", "Router unavailable");
    document.querySelector("#connection-status").classList.add("error");
    showError(error instanceof TypeError ? (hosted ? "Could not connect to the router. Check your connection and reload this page." : "Could not connect to the local router. Start the server and reload this page.") : error.message);
    routeButton.disabled = true;
  }
}

form.addEventListener("submit", routePrompt);
form.addEventListener("input", invalidateResult);
form.addEventListener("change", invalidateResult);
directoryInput.addEventListener("input", () => directoryInput.setCustomValidity(""));
promptInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    if (!routeButton.disabled) form.requestSubmit();
  }
});
document.querySelector("#copy-command").addEventListener("click", () => copyCommand("native"));
document.querySelector("#copy-run-command").addEventListener("click", () => copyCommand("run"));
initialize();

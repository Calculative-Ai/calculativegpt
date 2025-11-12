(() => {
  const DEFAULT_BACKEND = "https://calculativegpt01-50035771436.development.catalystappsail.in";
  const params = new URLSearchParams(window.location.search);
  let backendBase = (params.get("backend") || DEFAULT_BACKEND).replace(/\/+$/, "");

  const elements = {
    overallStatus: document.getElementById("overall-status"),
    lastChecked: document.getElementById("last-checked"),
    healthIndicator: document.getElementById("health-indicator"),
    serviceName: document.getElementById("service-name"),
    healthStatus: document.getElementById("health-status"),
    healthTimestamp: document.getElementById("health-timestamp"),
    refreshHealth: document.getElementById("refresh-health"),
    pingBackend: document.getElementById("ping-backend"),
    pingResponse: document.getElementById("ping-response"),
    backendUrl: document.getElementById("backend-url"),
    toast: document.getElementById("toast"),
    backendSelector: document.getElementById("backend-selector"),
    backendApply: document.getElementById("apply-backend"),
    analyzeIndicator: document.getElementById("analyze-status-indicator"),
    analyzeForm: document.getElementById("analyze-form"),
    analyzeButton: document.getElementById("analyze-submit"),
    csvInput: document.getElementById("csv-file"),
    csvWrapper: document.querySelector(".file-input"),
    fileName: document.getElementById("file-name"),
    clearFile: document.getElementById("clear-file"),
    queryInput: document.getElementById("user-query"),
    freqInput: document.getElementById("freq"),
    horizonInput: document.getElementById("horizon"),
    seasonalityInput: document.getElementById("seasonality"),
    analysisResults: document.getElementById("analysis-results"),
    analysisSummaryText: document.getElementById("analysis-summary-text"),
    analysisCards: document.getElementById("analysis-cards"),
    forecastTableHead: document.querySelector("#forecast-table thead"),
    forecastTableBody: document.querySelector("#forecast-table tbody"),
    rawJson: document.getElementById("raw-json"),
  };

  const badgeToneMap = {
    success: "badge--success",
    warning: "badge--neutral",
    danger: "badge--danger",
    neutral: "badge--neutral",
  };

  const indicatorTones = {
    success: "status-indicator--success",
    warning: "status-indicator--warning",
    danger: "status-indicator--danger",
    neutral: "status-indicator--neutral",
  };

  const toastColors = {
    success: "#12b76a",
    warning: "#f79009",
    danger: "#f04438",
    neutral: "#64748b",
  };

  let toastTimeout = null;
  let healthInterval = null;

  function showToast(message, tone = "neutral") {
    if (!elements.toast) return;

    elements.toast.textContent = message;
    elements.toast.style.background = toastColors[tone] || toastColors.neutral;
    elements.toast.classList.add("toast--visible");

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      elements.toast.classList.remove("toast--visible");
    }, 4000);
  }

  function setBadgeTone(tone, text) {
    Object.values(badgeToneMap).forEach((cls) => elements.overallStatus.classList.remove(cls));
    elements.overallStatus.classList.add(badgeToneMap[tone] || badgeToneMap.neutral);
    elements.overallStatus.textContent = text;
  }

  function setIndicatorTone(indicator, tone) {
    if (!indicator) return;
    Object.values(indicatorTones).forEach((cls) => indicator.classList.remove(cls));
    indicator.classList.add(indicatorTones[tone] || indicatorTones.neutral);
  }

  function formatTimestamp(date = new Date()) {
    return date.toLocaleString("en-IN", {
      hour12: true,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function updateBackendLink() {
    if (elements.backendUrl) {
      elements.backendUrl.href = backendBase;
      elements.backendUrl.textContent = backendBase;
    }
    if (elements.backendSelector) {
      elements.backendSelector.value = backendBase;
    }
  }

  function normalizeBase(url) {
    try {
      const parsed = new URL(url);
      return parsed.origin + parsed.pathname.replace(/\/+$/, "");
    } catch {
      return backendBase;
    }
  }

  async function applyBackend(url) {
    backendBase = normalizeBase(url || DEFAULT_BACKEND);
    updateBackendLink();
    showToast("Backend endpoint updated.", "success");
    elements.pingResponse.textContent = "Click the button to call the API.";
    await checkHealth(false).catch(() => {});
  }

  async function checkHealth(manual = false) {
    if (!backendBase) return;
    const url = `${backendBase}/healthz`;
    elements.refreshHealth.disabled = true;

    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      elements.serviceName.textContent = data.service || "Unknown";
      elements.healthStatus.textContent = data.status || "unknown";
      const timestamp = formatTimestamp();
      elements.healthTimestamp.textContent = timestamp;
      elements.lastChecked.textContent = `Last checked · ${timestamp}`;

      const healthy = (data.status || "").toLowerCase() === "ok";
      setBadgeTone(healthy ? "success" : "warning", healthy ? "Backend Healthy" : "Check Backend");
      setIndicatorTone(elements.healthIndicator, healthy ? "success" : "warning");

      if (manual) {
        showToast(`Health check ${healthy ? "passed" : "needs attention"}.`, healthy ? "success" : "warning");
      }
    } catch (error) {
      const timestamp = formatTimestamp();
      elements.healthStatus.textContent = "Unavailable";
      elements.healthTimestamp.textContent = timestamp;
      elements.lastChecked.textContent = `Last checked · ${timestamp}`;
      setBadgeTone("danger", "Backend Unreachable");
      setIndicatorTone(elements.healthIndicator, "danger");
      showToast(`Health check failed: ${error.message}`, "danger");
      throw error;
    } finally {
      elements.refreshHealth.disabled = false;
    }
  }

  async function pingBackend() {
    const url = `${backendBase}/`;
    elements.pingBackend.disabled = true;
    elements.pingResponse.textContent = "Waiting for response…";

    try {
      const response = await fetch(url);
      const text = await response.text();
      elements.pingResponse.textContent = text || "(Empty response)";
      showToast("Backend responded successfully.", "success");
    } catch (error) {
      elements.pingResponse.textContent = `Error: ${error.message}`;
      showToast("Failed to reach backend.", "danger");
    } finally {
      elements.pingBackend.disabled = false;
    }
  }

  function updateFileName() {
    if (!elements.csvInput || !elements.fileName || !elements.csvWrapper) return;
    const file = elements.csvInput.files?.[0];
    if (file) {
      elements.fileName.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      elements.csvWrapper.dataset.empty = "Change File";
    } else {
      elements.fileName.textContent = "No file selected";
      elements.csvWrapper.dataset.empty = "Select CSV file";
    }
  }

  function renderMiniCards(output = {}) {
    if (!elements.analysisCards) return;
    const cards = [];
    if (output.selected_model) {
      cards.push({ title: "Selected Model", value: output.selected_model });
    }
    if (typeof output.is_better_than_seasonal_naive === "boolean") {
      cards.push({
        title: "Beats Seasonal Naive",
        value: output.is_better_than_seasonal_naive ? "Yes" : "No",
      });
    }
    if (output.reason_for_selection) {
      cards.push({ title: "Reason for Selection", value: output.reason_for_selection });
    }
    if (Array.isArray(output.cross_validation_results) && output.cross_validation_results.length) {
      cards.push({
        title: "Cross Validation",
        value: output.cross_validation_results
          .slice(0, 3)
          .map(String)
          .join(" · "),
      });
    }
    if (output.tsfeatures_analysis) {
      cards.push({ title: "Feature Analysis", value: output.tsfeatures_analysis });
    }

    elements.analysisCards.innerHTML = "";
    cards.slice(0, 6).forEach((card) => {
      const div = document.createElement("div");
      div.className = "mini-card";
      div.innerHTML = `<h4>${card.title}</h4><p>${card.value}</p>`;
      elements.analysisCards.appendChild(div);
    });
  }

  function renderForecastTable(forecast = []) {
    if (!elements.forecastTableHead || !elements.forecastTableBody) return;
    elements.forecastTableHead.innerHTML = "";
    elements.forecastTableBody.innerHTML = "";
    if (!Array.isArray(forecast) || !forecast.length) {
      elements.forecastTableHead.innerHTML = "<tr><th>No forecast data</th></tr>";
      return;
    }

    const columns = Object.keys(forecast[0]);
    const headRow = document.createElement("tr");
    columns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col;
      headRow.appendChild(th);
    });
    elements.forecastTableHead.appendChild(headRow);

    forecast.slice(0, 100).forEach((row) => {
      const tr = document.createElement("tr");
      columns.forEach((col) => {
        const td = document.createElement("td");
        const value = row[col];
        td.textContent = typeof value === "number" ? value.toLocaleString() : String(value ?? "");
        tr.appendChild(td);
      });
      elements.forecastTableBody.appendChild(tr);
    });
  }

  function renderAnalysis(result) {
    if (!elements.analysisResults || !elements.analysisSummaryText || !elements.rawJson) return;
    const output = result?.output || {};
    const summary =
      output.user_query_response ||
      output.forecast_analysis ||
      output.tsfeatures_analysis ||
      "Analysis completed. See detailed results below.";

    elements.analysisSummaryText.textContent = summary;
    renderMiniCards(output);
    renderForecastTable(result?.forecast || []);
    elements.rawJson.textContent = JSON.stringify(result, null, 2);
    elements.analysisResults.hidden = false;
  }

  async function submitAnalysis(event) {
    event.preventDefault();
    const file = elements.csvInput.files?.[0];
    if (!file) {
      showToast("Please select a CSV file first.", "warning");
      return;
    }

    const formData = new FormData();
    formData.append("file", file, file.name);
    const freq = elements.freqInput.value.trim();
    const horizon = elements.horizonInput.value.trim();
    const seasonality = elements.seasonalityInput.value.trim();
    const query = elements.queryInput.value.trim();

    if (freq) formData.append("freq", freq);
    if (horizon) formData.append("horizon", horizon);
    if (seasonality) formData.append("seasonality", seasonality);
    if (query) formData.append("query", query);

    elements.analyzeButton.disabled = true;
    elements.analyzeButton.textContent = "Analyzing…";
    setIndicatorTone(elements.analyzeIndicator, "warning");

    try {
      const response = await fetch(`${backendBase}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const { detail } = await response.json().catch(() => ({}));
        throw new Error(detail || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      renderAnalysis(data);
      setIndicatorTone(elements.analyzeIndicator, "success");
      showToast("Analysis completed successfully.", "success");
    } catch (error) {
      setIndicatorTone(elements.analyzeIndicator, "danger");
      showToast(`Analysis failed: ${error.message}`, "danger");
    } finally {
      elements.analyzeButton.disabled = false;
      elements.analyzeButton.textContent = "Analyze with TimeCopilot";
    }
  }

  function initEventListeners() {
    if (elements.refreshHealth) {
      elements.refreshHealth.addEventListener("click", () => {
        checkHealth(true).catch(() => {});
      });
    }
    if (elements.pingBackend) {
      elements.pingBackend.addEventListener("click", () => pingBackend());
    }
    if (elements.backendApply && elements.backendSelector) {
      elements.backendApply.addEventListener("click", () => {
        applyBackend(elements.backendSelector.value).catch(() => {});
      });
      elements.backendSelector.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          applyBackend(elements.backendSelector.value).catch(() => {});
        }
      });
    }

    if (elements.csvWrapper && elements.csvInput) {
      elements.csvWrapper.addEventListener("click", (event) => {
        if (event.target === elements.clearFile) return;
        elements.csvInput.click();
      });
      elements.csvInput.addEventListener("change", () => updateFileName());
    }

    if (elements.clearFile) {
      elements.clearFile.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (elements.csvInput) {
          elements.csvInput.value = "";
        }
        updateFileName();
      });
    }

    if (elements.analyzeForm) {
      elements.analyzeForm.addEventListener("submit", submitAnalysis);
    }
  }

  function init() {
    updateBackendLink();
    updateFileName();
    initEventListeners();

    checkHealth(false).catch(() => {});
    healthInterval = setInterval(() => {
      checkHealth(false).catch(() => {});
    }, 30000);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (healthInterval) {
        clearInterval(healthInterval);
        healthInterval = null;
      }
    } else if (!healthInterval) {
      checkHealth(false).catch(() => {});
      healthInterval = setInterval(() => {
        checkHealth(false).catch(() => {});
      }, 30000);
    }
  });

  window.addEventListener("DOMContentLoaded", init);
})();

let selectedPath = null;
const elements = {
  selectPathBtn: document.getElementById("select-path-btn"),
  selectedPath: document.getElementById("selected-path"),
  imageCount: document.getElementById("image-count"),

  configForm: document.getElementById("config-form"),
  apiKey: document.getElementById("api-key"),
  titleLength: document.getElementById("title-length"),
  titleLengthValue: document.getElementById("title-length-value"),
  descLength: document.getElementById("desc-length"),
  descLengthValue: document.getElementById("desc-length-value"),
  keywordCount: document.getElementById("keyword-count"),
  keywordCountValue: document.getElementById("keyword-count-value"),
  isPremium: document.getElementById("is-premium"),
  submitBtn: document.getElementById("submit-btn"),

  resultsPanel: document.getElementById("results-panel"),
  progressContainer: document.getElementById("progress-container"),
  progressStatus: document.getElementById("progress-status"),
  progressCount: document.getElementById("progress-count"),
  progressBar: document.getElementById("progress-bar"),

  resultsSummary: document.getElementById("results-summary"),
  totalCount: document.getElementById("total-count"),
  successCount: document.getElementById("success-count"),
  failedCount: document.getElementById("failed-count"),
  outputDir: document.getElementById("output-dir"),

  resultsList: document.getElementById("results-list"),
  noResults: document.getElementById("no-results"),

  settingsBtn: document.getElementById("settings-btn"),
  settingsModal: document.getElementById("settings-modal"),
  closeSettings: document.getElementById("close-settings"),
  settingsForm: document.getElementById("settings-form"),
  settingsApiKey: document.getElementById("settings-api-key"),
  settingsTitleLength: document.getElementById("settings-title-length"),
  settingsTitleLengthValue: document.getElementById(
    "settings-title-length-value"
  ),
  settingsDescLength: document.getElementById("settings-desc-length"),
  settingsDescLengthValue: document.getElementById(
    "settings-desc-length-value"
  ),
  settingsKeywordCount: document.getElementById("settings-keyword-count"),
  settingsKeywordCountValue: document.getElementById(
    "settings-keyword-count-value"
  ),
  settingsIsPremium: document.getElementById("settings-is-premium"),
};

// Initialize the app
async function initApp() {
  // Load settings
  await loadSettings();

  // Set up event listeners
  setupEventListeners();
}

// Load settings from electron store
async function loadSettings() {
  try {
    const settings = await window.electronAPI.loadSettings();

    // Update settings form with loaded values
    elements.settingsApiKey.value = settings.apiKey || "";
    elements.settingsTitleLength.value = settings.titleLength || 90;
    elements.settingsTitleLengthValue.textContent = settings.titleLength || 90;
    elements.settingsDescLength.value = settings.descriptionLength || 120;
    elements.settingsDescLengthValue.textContent =
      settings.descriptionLength || 120;
    elements.settingsKeywordCount.value = settings.keywordCount || 20;
    elements.settingsKeywordCountValue.textContent =
      settings.keywordCount || 20;
    elements.settingsIsPremium.checked = settings.isPremium || false;

    console.log("Settings loaded:", settings);
    return settings;
  } catch (error) {
    console.error("Error loading settings:", error);
    return null;
  }
}

// Save settings to electron store
async function saveSettings() {
  const settings = {
    apiKey: elements.settingsApiKey.value,
    titleLength: parseInt(elements.settingsTitleLength.value),
    descriptionLength: parseInt(elements.settingsDescLength.value),
    keywordCount: parseInt(elements.settingsKeywordCount.value),
    isPremium: elements.settingsIsPremium.checked,
  };

  try {
    const result = await window.electronAPI.saveSettings(settings);
    console.log("Settings saved:", result);
    return result;
  } catch (error) {
    console.error("Error saving settings:", error);
    return false;
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Settings range input value displays
  elements.settingsTitleLength.addEventListener("input", () => {
    elements.settingsTitleLengthValue.textContent =
      elements.settingsTitleLength.value;
  });

  elements.settingsDescLength.addEventListener("input", () => {
    elements.settingsDescLengthValue.textContent =
      elements.settingsDescLength.value;
  });

  elements.settingsKeywordCount.addEventListener("input", () => {
    elements.settingsKeywordCountValue.textContent =
      elements.settingsKeywordCount.value;
  });

  // Settings modal
  elements.settingsBtn.addEventListener("click", () => {
    elements.settingsModal.classList.add("active");
  });

  elements.closeSettings.addEventListener("click", () => {
    elements.settingsModal.classList.remove("active");
  });

  // Close modal when clicking outside
  elements.settingsModal.addEventListener("click", (e) => {
    if (e.target === elements.settingsModal) {
      elements.settingsModal.classList.remove("active");
    }
  });

  // Save settings form
  elements.settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveSettings();
    elements.settingsModal.classList.remove("active");
  });

  // Handle directory selection
  elements.selectPathBtn.addEventListener("click", async () => {
    const result = await window.electronAPI.selectPath();
    if (result) {
      selectedPath = result.path;
      elements.selectedPath.textContent = result.path;
      elements.imageCount.textContent = `${result.imageCount} images`;
      elements.imageCount.style.display =
        result.imageCount > 0 ? "inline-block" : "none";
    }
  });

  // Process images form
  elements.configForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!selectedPath) {
      alert("Please select a directory first");
      return;
    }

    // Set up event listeners for processing
    setupProcessingListeners();

    // Only need to pass the path now, settings are loaded from store
    const config = {
      path: selectedPath,
    };

    try {
      await window.electronAPI.submitConfig(config);
    } catch (error) {
      console.error("Error submitting config:", error);
    }
  });
}

// Set up event listeners for processing events
function setupProcessingListeners() {
  // Clean up any existing listeners
  window.electronAPI.removeAllListeners();

  // Processing start
  window.electronAPI.onProcessingStart((event, data) => {
    console.log("Processing started:", data);

    // Show progress container
    elements.progressContainer.classList.remove("hidden");
    elements.resultsSummary.classList.add("hidden");

    // Reset progress bar
    elements.progressBar.style.width = "0%";
    elements.progressStatus.textContent = "Processing images...";
    elements.progressCount.textContent = `0/${data.total}`;

    // Clear previous results
    elements.resultsList.innerHTML = "";
    elements.noResults.style.display = "block";

    // Disable submit button
    elements.submitBtn.disabled = true;
    elements.submitBtn.textContent = "Processing...";
  });

  // Progress updates
  window.electronAPI.onProcessingProgress((event, data) => {
    console.log("Progress update:", data);

    // Update progress bar
    elements.progressBar.style.width = `${data.percent}%`;
    elements.progressCount.textContent = `${data.current}/${data.total}`;

    if (data.current === data.total) {
      elements.progressStatus.textContent = "Finalizing...";
    }
  });

  // Processing results
  window.electronAPI.onProcessingResults((event, results) => {
    console.log("Processing complete:", results);

    // Hide progress container and show summary
    elements.progressContainer.classList.add("hidden");
    elements.resultsSummary.classList.remove("hidden");

    // Update summary counts
    elements.totalCount.textContent = results.total;
    elements.successCount.textContent = results.successful.length;
    elements.failedCount.textContent = results.failed.length;
    elements.outputDir.textContent = results.outputDir;

    // Display results list
    displayResults(results.allResults);

    // Re-enable submit button
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = "Process Images";
  });

  // Processing error
  window.electronAPI.onProcessingError((event, errorMessage) => {
    console.error("Processing error:", errorMessage);

    // Hide progress container
    elements.progressContainer.classList.add("hidden");

    // Show error in results panel
    elements.resultsList.innerHTML = `
      <div class="result-item error">
        <div class="result-item-header">
          <span class="filename">Error</span>
          <span class="status error">Failed</span>
        </div>
        <div class="result-message">${errorMessage}</div>
      </div>
    `;
    elements.noResults.style.display = "none";

    // Re-enable submit button
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = "Process Images";
  });
}

// Display results in the results list
function displayResults(results) {
  if (!results || results.length === 0) {
    elements.noResults.style.display = "block";
    return;
  }

  elements.noResults.style.display = "none";
  elements.resultsList.innerHTML = "";

  results.forEach((result) => {
    const isError = !!result.error;
    const resultItem = document.createElement("div");
    resultItem.className = `result-item ${isError ? "error" : ""}`;

    resultItem.innerHTML = `
      <div class="result-item-header">
        <span class="filename">${result.filename}</span>
        <span class="status ${isError ? "error" : ""}">${
      isError ? "Failed" : "Success"
    }</span>
      </div>
      <div class="result-message">
        ${
          isError
            ? `Error: ${result.error}`
            : `Metadata added successfully${
                result.outputPath ? ` to ${result.outputPath}` : ""
              }`
        }
      </div>
    `;

    elements.resultsList.appendChild(resultItem);
  });
}

// Initialize the app on load
document.addEventListener("DOMContentLoaded", initApp);

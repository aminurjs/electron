let selectedPath = null;
let outputDirectory = null;

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
  initialState: document.getElementById("initial-state"),

  settingsBtn: document.getElementById("settings-btn"),
  settingsDialog: document.getElementById("settings-dialog"),
  closeSettings: document.getElementById("close-settings"),
  cancelSettings: document.getElementById("cancel-settings"),
  saveSettings: document.getElementById("save-settings"),
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

  helpBtn: document.getElementById("help-btn"),
  helpDialog: document.getElementById("help-dialog"),
  closeHelp: document.getElementById("close-help"),
  closeHelpBtn: document.getElementById("close-help-btn"),
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

  // Settings dialog
  elements.settingsBtn.addEventListener("click", () => {
    elements.settingsDialog.classList.add("active");
  });

  elements.closeSettings.addEventListener("click", () => {
    elements.settingsDialog.classList.remove("active");
  });

  elements.cancelSettings.addEventListener("click", () => {
    elements.settingsDialog.classList.remove("active");
  });

  // Close modal when clicking outside
  elements.settingsDialog.addEventListener("click", (e) => {
    if (e.target === elements.settingsDialog) {
      elements.settingsDialog.classList.remove("active");
    }
  });

  // Save settings form
  elements.settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveSettings();
    elements.settingsDialog.classList.remove("active");
  });

  // This is needed since the form can be submitted by clicking the save button outside the form
  elements.saveSettings.addEventListener("click", async () => {
    await saveSettings();
    elements.settingsDialog.classList.remove("active");
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

    // Check if API key is set in settings
    const settings = await window.electronAPI.loadSettings();
    if (!settings || !settings.apiKey) {
      alert("Please set your API key in settings first");
      elements.settingsDialog.classList.add("active");
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

  // Help dialog
  document.querySelector("#help-btn").addEventListener("click", () => {
    elements.helpDialog.classList.add("active");
  });

  elements.closeHelp.addEventListener("click", () => {
    elements.helpDialog.classList.remove("active");
  });

  elements.closeHelpBtn.addEventListener("click", () => {
    elements.helpDialog.classList.remove("active");
  });

  // Close help modal when clicking outside
  elements.helpDialog.addEventListener("click", (e) => {
    if (e.target === elements.helpDialog) {
      elements.helpDialog.classList.remove("active");
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

    // Hide initial state
    elements.initialState.classList.add("hidden");

    // Show progress container
    elements.progressContainer.classList.remove("hidden");
    elements.resultsSummary.classList.add("hidden");

    // Reset progress bar
    elements.progressBar.style.width = "0%";
    elements.progressStatus.textContent = "Processing images...";
    elements.progressCount.textContent = `0/${data.total}`;

    // Clear previous results
    elements.resultsList.innerHTML = "";
    elements.noResults.classList.add("hidden");

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

    // Save output directory path
    outputDirectory = results.outputDirectory;

    // Hide progress container, initial state, and show summary
    elements.progressContainer.classList.add("hidden");
    elements.initialState.classList.add("hidden");
    elements.resultsSummary.classList.remove("hidden");

    // Update summary counts
    elements.totalCount.textContent = results.total;
    elements.successCount.textContent = results.successful.length;
    elements.failedCount.textContent = results.failed.length;

    // Update output directory and make it clickable if exists
    if (outputDirectory) {
      elements.outputDir.innerHTML = `<i class="fas fa-folder-open"></i> ${outputDirectory}`;
      elements.outputDir.classList.add("clickable");
      elements.outputDir.title = "Click to open folder";

      // Add click event to open the directory
      elements.outputDir.addEventListener("click", async () => {
        try {
          const result = await window.electronAPI.openOutputDirectory(
            outputDirectory
          );
          if (!result.success) {
            console.error("Failed to open directory:", result.message);
            alert(`Could not open the directory: ${result.message}`);
          }
        } catch (error) {
          console.error("Error opening directory:", error);
          alert("An error occurred while trying to open the directory.");
        }
      });
    } else {
      elements.outputDir.textContent = "Not available";
      elements.outputDir.classList.remove("clickable");
      elements.outputDir.title = "";
    }

    // Display results list
    displayResults(results.allResults);

    // Re-enable submit button
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = "Generate Metadata";
  });

  // Processing error
  window.electronAPI.onProcessingError((event, errorMessage) => {
    console.error("Processing error:", errorMessage);

    // Hide progress container and initial state
    elements.progressContainer.classList.add("hidden");
    elements.initialState.classList.add("hidden");

    // Show summary cards with zeros
    elements.resultsSummary.classList.remove("hidden");
    elements.totalCount.textContent = "0";
    elements.successCount.textContent = "0";
    elements.failedCount.textContent = "0";
    elements.outputDir.textContent = "Not available";

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
    elements.noResults.classList.add("hidden");

    // Re-enable submit button
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = "Generate Metadata";
  });
}

// Display results in the results list
function displayResults(results) {
  if (!results || results.length === 0) {
    elements.noResults.classList.remove("hidden");
    return;
  }

  elements.noResults.classList.add("hidden");
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

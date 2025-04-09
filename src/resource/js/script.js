let selectedPath = null;
let outputDirectory = null;

// Global variable to track modified metadata
let modifiedMetadata = new Set();

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

  // Add secret key elements
  settingsSecretKey: document.getElementById("settings-secret-key"),
  toggleSecretKey: document.getElementById("toggle-secret-key"),

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

  // Status message display
  statusMessage: document.getElementById("status-message"),

  // API status display
  apiStatus: document.getElementById("api-status"),
  apiExpires: document.getElementById("api-expires"),
};

// Initialize the app
async function initApp() {
  console.log("Initializing app");

  // Debug: check if all settings elements are found correctly
  console.log("Settings API Key Element:", elements.settingsApiKey);
  console.log("Settings Secret Key Element:", elements.settingsSecretKey);
  console.log("Toggle Secret Key Button:", elements.toggleSecretKey);

  // Get the save all button from the navbar
  const navbarSaveAllBtn = document.getElementById("save-all-btn");

  // Set up event listeners
  setupEventListeners();

  // Set up processing listeners
  setupProcessingListeners();

  // Load settings
  await loadSettings();

  // Get and display app version
  try {
    const version = await window.electronAPI.app.getVersion();
    const versionElement = document.getElementById("app-version");
    if (versionElement) {
      versionElement.textContent = version;
    }
  } catch (error) {
    console.error("Error getting app version:", error);
  }

  // Listen for app messages (like updates)
  window.electronAPI.app.onMessage((message) => {
    if (elements.statusMessage) {
      elements.statusMessage.textContent = message;
    }
    console.log("App message:", message);
  });

  // Listen for API status updates
  window.electronAPI.app.onApiStatusUpdate((status) => {
    console.log("API status update received:", status);

    // Update status display
    if (elements.apiStatus) {
      if (status.status === "error") {
        elements.apiStatus.textContent = "Error";
        elements.apiStatus.className = "status-error";
      } else {
        let statusText = "";
        let statusClass = "";

        switch (status.status) {
          case "active":
            statusText = "Active";
            statusClass = "status-active";
            break;
          case "suspended":
            statusText = "Suspended";
            statusClass = "status-warning";
            break;
          case "expired":
            statusText = "Expired";
            statusClass = "status-error";
            break;
          default:
            statusText = status.status || "Unknown";
            statusClass = "status-unknown";
        }

        elements.apiStatus.textContent = statusText;
        elements.apiStatus.className = statusClass;
      }
    }

    // Update expiration display
    if (elements.apiExpires) {
      if (status.status === "error") {
        elements.apiExpires.textContent = "Unknown";
        elements.apiExpires.className = "status-unknown";
      } else if (status.status === "expired") {
        elements.apiExpires.textContent = "Expired";
        elements.apiExpires.className = "status-error";
      } else {
        const expiresText =
          status.expiresIn > 0 ? `${status.expiresIn} days` : "Today";

        elements.apiExpires.textContent = expiresText;

        // Apply warning class if expiring soon (7 days or less)
        if (status.expiresIn <= 7 && status.expiresIn > 0) {
          elements.apiExpires.className = "status-warning";
        } else if (status.expiresIn > 7) {
          elements.apiExpires.className = "status-active";
        } else {
          elements.apiExpires.className = "status-error";
        }
      }
    }
  });

  // Add event listener to the Save All button in navbar
  if (navbarSaveAllBtn) {
    navbarSaveAllBtn.addEventListener("click", saveAllMetadata);
  }
}

// Load settings from electron store
async function loadSettings() {
  try {
    const settings = await window.electronAPI.settings.load();
    console.log("Raw settings loaded:", settings);

    // Update settings form with loaded values if elements exist
    if (elements.settingsApiKey) {
      elements.settingsApiKey.value = settings.apiKey || "";
    }

    if (elements.settingsSecretKey) {
      elements.settingsSecretKey.value = settings.secretKey || "";
    } else {
      console.error("Settings secret key element not found");
    }

    if (elements.settingsTitleLength) {
      elements.settingsTitleLength.value = settings.titleLength || 90;

      if (elements.settingsTitleLengthValue) {
        elements.settingsTitleLengthValue.textContent =
          settings.titleLength || 90;
      }
    }

    if (elements.settingsDescLength) {
      elements.settingsDescLength.value = settings.descriptionLength || 120;

      if (elements.settingsDescLengthValue) {
        elements.settingsDescLengthValue.textContent =
          settings.descriptionLength || 120;
      }
    }

    if (elements.settingsKeywordCount) {
      elements.settingsKeywordCount.value = settings.keywordCount || 20;

      if (elements.settingsKeywordCountValue) {
        elements.settingsKeywordCountValue.textContent =
          settings.keywordCount || 20;
      }
    }

    if (elements.settingsIsPremium) {
      elements.settingsIsPremium.checked = settings.isPremium || false;
    }

    console.log("Settings loaded successfully");
    return settings;
  } catch (error) {
    console.error("Error loading settings:", error);
    return null;
  }
}

// Save settings to electron store
async function saveSettings() {
  try {
    const settings = {
      apiKey: elements.settingsApiKey ? elements.settingsApiKey.value : "",
      secretKey: elements.settingsSecretKey
        ? elements.settingsSecretKey.value
        : "",
      titleLength: elements.settingsTitleLength
        ? parseInt(elements.settingsTitleLength.value)
        : 90,
      descriptionLength: elements.settingsDescLength
        ? parseInt(elements.settingsDescLength.value)
        : 120,
      keywordCount: elements.settingsKeywordCount
        ? parseInt(elements.settingsKeywordCount.value)
        : 20,
      isPremium: elements.settingsIsPremium
        ? elements.settingsIsPremium.checked
        : false,
    };

    console.log("Saving settings:", settings);
    const result = await window.electronAPI.settings.save(settings);
    console.log("Settings saved:", result);
    return result;
  } catch (error) {
    console.error("Error saving settings:", error);
    return false;
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Get the submit button and wrap it in a form for submission handling
  const submitBtn = document.getElementById("submit-btn");

  // Create a config form handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!selectedPath) {
      alert("Please select a directory first");
      return;
    }

    // Check if API key and secret key are set in settings
    try {
      const settings = await window.electronAPI.settings.load();
      if (!settings || !settings.apiKey) {
        alert("Please set your API key in settings first");
        elements.settingsDialog.classList.add("active");
        return;
      }

      if (!settings.secretKey) {
        alert("Please set your secret key in settings first");
        elements.settingsDialog.classList.add("active");
        return;
      }

      // Set up event listeners for processing
      setupProcessingListeners();

      // Only need to pass the path now, settings are loaded from store
      const config = {
        path: selectedPath,
      };

      await window.electronAPI.processing.submit(config);
    } catch (error) {
      console.error("Error during processing setup:", error);
      alert("An error occurred while setting up processing. Please try again.");
    }
  };

  // Add click handler to submit button
  if (submitBtn) {
    submitBtn.addEventListener("click", handleSubmit);
  }

  // Secret key toggle
  if (elements.toggleSecretKey) {
    elements.toggleSecretKey.addEventListener("click", () => {
      try {
        if (elements.settingsSecretKey) {
          const type =
            elements.settingsSecretKey.type === "password"
              ? "text"
              : "password";
          elements.settingsSecretKey.type = type;

          const icon = elements.toggleSecretKey.querySelector("i");
          if (icon) {
            icon.className =
              type === "password" ? "fas fa-eye" : "fas fa-eye-slash";
          }
        } else {
          console.error("Secret key input element not found");
        }
      } catch (error) {
        console.error("Error toggling secret key visibility:", error);
      }
    });
  } else {
    console.error("Toggle secret key button not found");
  }

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

  // Close help modal when clicking outside
  elements.helpDialog.addEventListener("click", (e) => {
    if (e.target === elements.helpDialog) {
      elements.helpDialog.classList.remove("active");
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
    try {
      const result = await window.electronAPI.files.selectPath();
      if (result) {
        selectedPath = result.path;
        elements.selectedPath.textContent = result.path;
        elements.imageCount.textContent = `${result.imageCount} images`;
        elements.imageCount.style.display =
          result.imageCount > 0 ? "inline-block" : "none";
      }
    } catch (error) {
      console.error("Error selecting path:", error);
      alert("Failed to select directory. Please try again.");
    }
  });

  // Help dialog
  elements.helpBtn.addEventListener("click", () => {
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
  console.log("Setting up processing listeners");

  // Clean up any existing listeners
  window.electronAPI.cleanup.removeListeners();
  console.log("Cleaned up existing listeners");

  // Store removal functions for later cleanup if needed
  const listenerCleanupFunctions = [];

  // Get the Save All button and hide it during processing
  const saveAllBtn = document.getElementById("save-all-btn");
  if (saveAllBtn) {
    saveAllBtn.classList.add("hidden");
  }

  // Processing start event
  console.log("Setting up onStart listener");
  const startRemover = window.electronAPI.processing.onStart((data) => {
    console.log("PROCESSING START received:", data);

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

    // Clear any previous modifications
    modifiedMetadata.clear();

    // Initialize results-related elements for real-time updates
    elements.resultsSummary.classList.remove("hidden");
    elements.totalCount.textContent = data.total;
    elements.successCount.textContent = "0";
    elements.failedCount.textContent = "0";
  });
  listenerCleanupFunctions.push(startRemover);

  // Progress updates
  console.log("Setting up onProgress listener");
  const progressRemover = window.electronAPI.processing.onProgress((data) => {
    console.log("PROGRESS UPDATE received:", data);

    // Update progress bar
    elements.progressBar.style.width = `${data.percent}%`;
    elements.progressCount.textContent = `${data.current}/${data.total}`;

    if (data.current === data.total) {
      elements.progressStatus.textContent = "Finalizing...";
    }
  });
  listenerCleanupFunctions.push(progressRemover);

  // Real-time result item updates
  console.log("Setting up onResultItem listener");
  const resultItemRemover = window.electronAPI.processing.onResultItem(
    (result) => {
      console.log("INDIVIDUAL RESULT received:", result);

      // Add this individual result to the list
      appendResultItem(result);

      // Update success/failure counts
      const successCount = parseInt(elements.successCount.textContent || "0");
      const failedCount = parseInt(elements.failedCount.textContent || "0");

      if (result.error) {
        elements.failedCount.textContent = (failedCount + 1).toString();
      } else {
        elements.successCount.textContent = (successCount + 1).toString();
      }
    }
  );
  listenerCleanupFunctions.push(resultItemRemover);

  // Processing results (final summary)
  console.log("Setting up onResults listener");
  const resultsRemover = window.electronAPI.processing.onResults((results) => {
    console.log("FINAL RESULTS received:", results);

    // Save output directory path
    outputDirectory = results.outputDirectory;

    // Hide progress container and show summary (summary is already visible from real-time updates)
    elements.progressContainer.classList.add("hidden");
    elements.initialState.classList.add("hidden");

    // Update output directory and make it clickable if exists
    if (outputDirectory) {
      elements.outputDir.innerHTML = `<i class="fas fa-folder-open"></i> Open Output Folder`;
      elements.outputDir.classList.add("clickable");
      elements.outputDir.title = "Click to open output folder";

      // Add click event to open the directory
      elements.outputDir.addEventListener("click", async () => {
        try {
          console.log("Opening output directory:", outputDirectory);
          const result = await window.electronAPI.files.openOutputDirectory(
            outputDirectory
          );
          console.log("Open directory result:", result);
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

    // Re-enable submit button
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = "Generate Metadata";

    console.log("Processing complete, cleaning up listeners");
    // Clean up listeners after processing is complete
    cleanupListeners();
  });
  listenerCleanupFunctions.push(resultsRemover);

  // Processing error
  console.log("Setting up onError listener");
  const errorRemover = window.electronAPI.processing.onError((errorMessage) => {
    console.error("PROCESSING ERROR received:", errorMessage);

    // Hide progress container and initial state
    elements.progressContainer.classList.add("hidden");
    elements.initialState.classList.add("hidden");

    // Show summary cards with zeros
    elements.resultsSummary.classList.remove("hidden");
    elements.totalCount.textContent = "0";
    elements.successCount.textContent = "0";
    elements.failedCount.textContent = "0";
    elements.outputDir.textContent = "Not available";

    // Check if the error is related to API validation
    const isApiValidationError = errorMessage.includes("API validation");

    // Show error in results panel
    elements.resultsList.innerHTML = `
      <div class="result-item error">
        <div class="result-item-header">
          <span class="filename">${
            isApiValidationError ? "API Validation Error" : "Error"
          }</span>
          <span class="status error">Failed</span>
        </div>
        <div class="result-message">${errorMessage}</div>
        ${
          isApiValidationError
            ? `
        <div class="result-action">
          <button class="btn secondary open-settings-btn">
            <i class="fas fa-cog"></i> Open Settings
          </button>
        </div>
        `
            : ""
        }
      </div>
    `;

    // Add click event for opening settings if this is an API validation error
    if (isApiValidationError) {
      const openSettingsBtn =
        elements.resultsList.querySelector(".open-settings-btn");
      if (openSettingsBtn) {
        openSettingsBtn.addEventListener("click", () => {
          elements.settingsDialog.classList.add("active");
        });
      }
    }

    elements.noResults.classList.add("hidden");

    // Re-enable submit button
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = "Generate Metadata";

    console.log("Error occurred, cleaning up listeners");
    // Clean up listeners after processing error
    cleanupListeners();
  });
  listenerCleanupFunctions.push(errorRemover);

  // Helper function to clean up all listeners
  function cleanupListeners() {
    console.log("Cleaning up all listeners");
    listenerCleanupFunctions.forEach((removeFunction) => {
      if (typeof removeFunction === "function") {
        removeFunction();
      }
    });
    console.log("All listeners cleaned up");
  }

  // Also add a general app message listener
  console.log("Setting up general message listener");
  window.electronAPI.app.onMessage((message) => {
    console.log("APP MESSAGE received:", message);
    // You can display this message in a status area if needed
  });
}

// Helper function to append an individual result item to the results list
function appendResultItem(result) {
  if (!result) return;

  // If this is the first result, make sure the no-results message is hidden
  elements.noResults.classList.add("hidden");

  const isError = !!result.error;
  const resultItem = document.createElement("div");
  resultItem.className = `result-item ${isError ? "error" : ""}`;

  if (isError) {
    // Error display
    resultItem.innerHTML = `
      <div class="result-item-header">
        <span class="filename">${result.filename}</span>
        <span class="status error">Failed</span>
      </div>
      <div class="result-message">
        Error: ${result.error}
      </div>
    `;
  } else {
    // Use the original filename without any truncation
    let displayName = result.filename;

    // Format keywords with proper spacing between commas
    let formattedKeywords = "";
    if (result.metadata?.keywords) {
      if (Array.isArray(result.metadata.keywords)) {
        formattedKeywords = result.metadata.keywords.join(", ");
      } else if (typeof result.metadata.keywords === "string") {
        // Replace any commas without spaces after them with comma+space
        formattedKeywords = result.metadata.keywords.replace(/,\s*/g, ", ");
      }
    }

    // Success case with improved professional layout
    resultItem.innerHTML = `
      <div class="result-item-header">
        <span class="filename" title="${result.filename}">${displayName}</span>
        <span class="status">Success</span>
      </div>
      <div class="result-content">
        <div class="result-image-row">
          <div class="result-preview">
            <img src="${result.outputPath || result.path}" alt="${
      result.filename
    }" class="preview-image">
          </div>
          <div class="metadata-title-container">
            <div class="metadata-field">
              <label>
                <span class="label-text"><i class="fas fa-heading"></i> Title</span>
                <span class="count-display">0 words | 0 chars</span>
              </label>
              <textarea class="metadata-title" data-filename="${
                result.filename
              }" data-field="title" data-original="${
      result.metadata?.title || ""
    }">${result.metadata?.title || ""}</textarea>
            </div>
          </div>
        </div>
        
        <div class="metadata-field">
          <label>
            <span class="label-text"><i class="fas fa-align-left"></i> Description</span>
            <span class="count-display">0 words | 0 chars</span>
          </label>
          <textarea class="metadata-description" data-filename="${
            result.filename
          }" data-field="description" data-original="${
      result.metadata?.description || ""
    }">${result.metadata?.description || ""}</textarea>
        </div>
        
        <div class="metadata-field">
          <label>
            <span class="label-text"><i class="fas fa-tags"></i> Keywords</span>
            <span class="count-display">0 keywords</span>
          </label>
          <textarea class="metadata-keywords" data-filename="${
            result.filename
          }" data-field="keywords" data-original="${
      result.metadata?.keywords || ""
    }">${formattedKeywords}</textarea>
        </div>
      </div>
    `;

    // Add event listeners for tracking changes to metadata fields
    setTimeout(() => {
      // Make sure textareas can be edited properly
      const textareas = resultItem.querySelectorAll("textarea");
      textareas.forEach((textarea) => {
        // Store the file path for later saving
        textarea.setAttribute(
          "data-filepath",
          result.outputPath || result.path
        );

        // Prevent default behavior that could interfere with editing
        textarea.addEventListener("click", (e) => {
          e.stopPropagation();
        });

        // Track keydown events to detect Backspace
        textarea.addEventListener("keydown", function (e) {
          if (e.key === "Backspace") {
            // Mark this textarea as having a backspace event in progress
            this.dataset.lastKey = "Backspace";
          }
        });

        // Track changes and update the modified set
        textarea.addEventListener("input", function () {
          // Get the identifier for this field
          const filename = this.getAttribute("data-filename");
          const field = this.getAttribute("data-field");
          const id = `${filename}:${field}`;
          const original = this.getAttribute("data-original");

          // Auto-resize textareas based on content
          this.style.height = "auto";
          this.style.height = this.scrollHeight + "px";

          // Update word/char count
          updateCountDisplay(this);

          // Check if the content has changed from the original
          if (this.value.trim() !== original?.trim()) {
            modifiedMetadata.add(id);
            textarea.classList.add("metadata-modified");
          } else {
            modifiedMetadata.delete(id);
            textarea.classList.remove("metadata-modified");
          }

          // Update Save All button state
          updateSaveAllButton();
        });

        // Initial sizing and count display
        textarea.dispatchEvent(new Event("input"));
      });
    }, 0);
  }

  elements.resultsList.appendChild(resultItem);

  // Show the Save All button once we have at least one result
  const saveAllBtn = document.getElementById("save-all-btn");
  if (saveAllBtn) {
    saveAllBtn.classList.remove("hidden");
    saveAllBtn.disabled = true; // Disabled until user makes changes
  }
}

// Function to update the Save All button state
function updateSaveAllButton() {
  const saveAllBtn = document.getElementById("save-all-btn");
  if (saveAllBtn) {
    saveAllBtn.disabled = modifiedMetadata.size === 0;

    // If there are no modifications, we could optionally hide the button
    if (modifiedMetadata.size === 0) {
      // Don't hide the button if it was just saved (it will show success message)
      if (!saveAllBtn.classList.contains("success")) {
        // saveAllBtn.classList.add("hidden");
      }
    } else {
      saveAllBtn.classList.remove("hidden");
    }
  }
}

// Function to save all modified metadata
async function saveAllMetadata() {
  const saveAllBtn = document.getElementById("save-all-btn");
  if (!saveAllBtn || modifiedMetadata.size === 0) return;

  try {
    // Update button to show saving state
    const originalText = saveAllBtn.innerHTML;
    saveAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveAllBtn.disabled = true;

    // Remove any previous state classes
    saveAllBtn.classList.remove("error", "warning", "success");

    // Get all the modified fields
    const textareas = document.querySelectorAll("textarea.metadata-modified");

    // Group by filepath for efficient saving
    const filePathMap = new Map();

    // First, collect all the fields for each file, including unmodified ones
    document.querySelectorAll("textarea[data-filepath]").forEach((element) => {
      const filename = element.getAttribute("data-filename");
      const field = element.getAttribute("data-field");
      const filePath = element.getAttribute("data-filepath");

      if (!filePathMap.has(filePath)) {
        filePathMap.set(filePath, {
          filename,
          filePath,
          metadata: {
            title: "",
            description: "",
            keywords: "",
          },
          modified: false,
        });
      }

      // Store the current value for each field
      const fileData = filePathMap.get(filePath);
      fileData.metadata[field] = element.value.trim();
    });

    // Now mark which files have modified fields
    textareas.forEach((textarea) => {
      const filePath = textarea.getAttribute("data-filepath");
      if (filePathMap.has(filePath)) {
        filePathMap.get(filePath).modified = true;
      }
    });

    // Filter to only include files with modifications
    const saveRequests = Array.from(filePathMap.values()).filter(
      (file) => file.modified
    );

    // Process each file save request
    let successCount = 0;
    let errorCount = 0;

    for (const request of saveRequests) {
      try {
        // Call backend to save the metadata
        const result = await window.electronAPI.processing.saveMetadata({
          filePath: request.filePath,
          metadata: request.metadata,
        });

        if (result.success) {
          successCount++;

          // Update data-original attributes for successful saves
          document
            .querySelectorAll(`textarea[data-filename="${request.filename}"]`)
            .forEach((field) => {
              const fieldName = field.getAttribute("data-field");
              field.setAttribute("data-original", request.metadata[fieldName]);
              field.classList.remove("metadata-modified");

              // Remove from modified set
              const id = `${request.filename}:${fieldName}`;
              modifiedMetadata.delete(id);
            });
        } else {
          errorCount++;
          console.error(
            `Failed to save metadata for ${request.filename}: ${result.message}`
          );
        }
      } catch (err) {
        errorCount++;
        console.error(`Error saving metadata for ${request.filename}:`, err);
      }
    }

    // Show result based on success/error count
    if (errorCount === 0) {
      saveAllBtn.innerHTML = '<i class="fas fa-check"></i> All Changes Saved!';
      saveAllBtn.classList.add("success");
      setTimeout(() => {
        saveAllBtn.innerHTML = originalText;
        saveAllBtn.disabled = true; // All changes saved
        saveAllBtn.classList.remove("success");
        // Hide button if there are no more changes
        updateSaveAllButton();
      }, 2000);
    } else if (successCount > 0) {
      saveAllBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Saved ${successCount}, Failed ${errorCount}`;
      saveAllBtn.classList.add("warning");
      setTimeout(() => {
        saveAllBtn.innerHTML = originalText;
        saveAllBtn.disabled = modifiedMetadata.size === 0;
        saveAllBtn.classList.remove("warning");
        // Update button visibility
        updateSaveAllButton();
      }, 3000);
    } else {
      saveAllBtn.innerHTML = '<i class="fas fa-times"></i> Save Failed';
      saveAllBtn.classList.add("error");
      setTimeout(() => {
        saveAllBtn.innerHTML = originalText;
        saveAllBtn.disabled = modifiedMetadata.size === 0;
        saveAllBtn.classList.remove("error");
        // Update button visibility
        updateSaveAllButton();
      }, 3000);
    }
  } catch (error) {
    console.error("Error in saveAllMetadata:", error);
    saveAllBtn.innerHTML = '<i class="fas fa-times"></i> Save Failed';
    saveAllBtn.classList.add("error");
    setTimeout(() => {
      saveAllBtn.innerHTML = '<i class="fas fa-save"></i> Save All Changes';
      saveAllBtn.disabled = modifiedMetadata.size === 0;
      saveAllBtn.classList.remove("error");
      // Update button visibility
      updateSaveAllButton();
    }, 3000);
  }
}

// Function to update character and word count display
function updateCountDisplay(textarea) {
  const countDisplay = textarea
    .closest(".metadata-field")
    .querySelector(".count-display");

  const field = textarea.getAttribute("data-field");
  let text = textarea.value.trim();

  if (field === "keywords") {
    // Format keywords with spaces between commas, but don't interfere with Backspace
    if (text) {
      // Only format if we're not in the middle of deleting text
      const isBackspaceEvent = textarea.dataset.lastKey === "Backspace";

      if (!isBackspaceEvent) {
        // Replace any commas without spaces after them with comma+space
        const formattedText = text.replace(/,\s*/g, ", ");

        // Only update the textarea if the formatting actually changed something
        if (formattedText !== text) {
          // Get cursor position
          const cursorPos = textarea.selectionStart;
          const addedSpaces = formattedText.length - text.length;

          // Update text
          textarea.value = formattedText;

          // Restore cursor position, adjusted for any added spaces
          textarea.setSelectionRange(
            cursorPos + addedSpaces,
            cursorPos + addedSpaces
          );

          // Update text for count calculation
          text = formattedText;
        }
      }

      // Clear the backspace flag
      delete textarea.dataset.lastKey;
    }

    const keywordCount = text
      ? text.split(",").filter((k) => k.trim()).length
      : 0;
    countDisplay.textContent = `${keywordCount} keywords`;
  } else {
    const charCount = text.length;
    const wordCount = text === "" ? 0 : text.split(/\s+/).length;
    countDisplay.textContent = `${wordCount} words | ${charCount} chars`;
  }
}

// Initialize the app on load
document.addEventListener("DOMContentLoaded", initApp);

let selectedPath = null;

// Handle directory selection
document
  .getElementById("select-path-btn")
  .addEventListener("click", async () => {
    const result = await window.electronAPI.selectPath();
    if (result) {
      selectedPath = result.path;
      document.getElementById("selected-path").textContent = result.path;
      document.getElementById(
        "image-count"
      ).textContent = `Total images found: ${result.imageCount}`;
    }
  });

// Handle form submission
document.getElementById("config-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!selectedPath) {
    alert("Please select a directory first");
    return;
  }

  const config = {
    path: selectedPath,
    apiKey: document.getElementById("api-key").value,
    titleLength: parseInt(document.getElementById("title-length").value),
    descLength: parseInt(document.getElementById("desc-length").value),
    keywordCount: parseInt(document.getElementById("keyword-count").value),
    isFreemium: document.getElementById("is-freemium").checked,
  };

  const response = await window.electronAPI.submitConfig(config);

  // Display the result
  const resultDiv = document.getElementById("result");
  const resultContent = document.getElementById("result-content");
  resultContent.textContent = JSON.stringify(config, null, 2);
  resultDiv.style.display = "block";
});

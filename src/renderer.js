document
  .getElementById("select-path-btn")
  .addEventListener("click", async () => {
    const result = await window.electronAPI.selectPath();
    if (result) {
      document.getElementById(
        "selected-path"
      ).textContent = `Selected path: ${result.path}`;
      document.getElementById(
        "image-count"
      ).textContent = `Total images: ${result.imageCount}`;
    }
  });

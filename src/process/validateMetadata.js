const validateMetadata = (metadata, originalFilename) => {
  // Check if metadata is properly formed
  if (!metadata || typeof metadata !== "object") return false;

  // Check if title is valid (not just the default fallback format)
  if (
    !metadata.title ||
    metadata.title.startsWith("Image ") ||
    metadata.title === originalFilename ||
    metadata.title.length < 20 || // Require longer, more descriptive titles
    metadata.title.includes("image_") ||
    metadata.title.includes("filename")
  ) {
    console.warn(`Invalid title: "${metadata.title}"`);
    return false;
  }

  // Check if description is valid
  if (
    !metadata.description ||
    metadata.description.startsWith("Uploaded image file") ||
    metadata.description.length < 40 || // Require more detailed descriptions
    metadata.description.includes("image file") ||
    metadata.description.includes("upload")
  ) {
    console.warn(
      `Invalid description: "${metadata.description?.substring(0, 40)}..."`
    );
    return false;
  }

  // Check if keywords are valid
  if (
    !Array.isArray(metadata.keywords) ||
    metadata.keywords.length < 10 || // Require a reasonable number of keywords
    (metadata.keywords.length <= 5 &&
      (metadata.keywords.includes("image") ||
        metadata.keywords.includes("upload") ||
        metadata.keywords.includes("photo")))
  ) {
    console.warn(
      `Invalid keywords: ${
        metadata.keywords ? JSON.stringify(metadata.keywords) : "none"
      }`
    );
    return false;
  }

  return true;
};

module.exports = { validateMetadata };

const fs = require("fs");
const { Semaphore } = require("./semaphore");
const { processSingleImage } = require("./processSingleImage");

async function processFallbackIndividual(failedImages, options, apiKey) {
  console.log(
    `Processing ${failedImages.length} failed images individually as fallback`
  );

  // Process images one by one with limited concurrency
  const semaphore = new Semaphore(3); // Lower concurrency for individual processing
  const results = [];

  // Process each image individually
  const processPromises = failedImages.map(async (image) => {
    const release = await semaphore.acquire();
    try {
      // Verify file exists before processing
      if (!image.path || !fs.existsSync(image.path)) {
        console.error(`File not found: ${image.path}`);
        return {
          filename: image.originalname,
          error: `File not found: ${image.path}`,
          status: "failed",
        };
      }

      // Process this single image
      return await processSingleImage(image, options, apiKey);
    } catch (error) {
      console.error(
        `Error processing individual image ${image.originalname}: ${error.message}`
      );
      return {
        filename: image.originalname,
        error: error.message || "Unknown error",
        status: "failed",
      };
    } finally {
      release();
    }
  });

  // Wait for all promises to settle
  const allResults = await Promise.allSettled(processPromises);

  // Process results
  allResults.forEach((result) => {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      results.push({
        filename: "unknown",
        error: result.reason?.message || "Unknown error",
        status: "failed",
      });
    }
  });

  return results;
}
module.exports = { processFallbackIndividual };

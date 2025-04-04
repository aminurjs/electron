const path = require("path");
const { processBatch } = require("./processBatch");
const { Semaphore } = require("./semaphore");

async function processFallbackIndividual(images, options, apiKey) {
  const results = [];
  const concurrencyLimit = 3; // Lower concurrency for individual processing
  const semaphore = new Semaphore(concurrencyLimit);

  console.log(
    `Starting individual processing for ${images.length} failed images...`
  );

  const individualPromises = images.map(async (image, index) => {
    const release = await semaphore.acquire();
    try {
      console.log(
        `Individual processing: ${index + 1}/${images.length} - ${
          image.filename || path.basename(image.path)
        }`
      );

      // Create single-item batch for processing
      const singleItemBatch = [
        {
          path: image.path,
          originalname: image.filename,
          outputPath: image.outputPath,
        },
      ];

      const batchResult = await processBatch(singleItemBatch, options, apiKey);
      return batchResult[0]; // Return the first (and only) result
    } catch (error) {
      console.error(
        `Individual processing failed for ${
          image.filename || path.basename(image.path)
        }: ${error.message}`
      );
      return {
        filename: image.filename || path.basename(image.path),
        error: error.message || "Unknown error during individual processing",
        status: "failed",
      };
    } finally {
      release();
    }
  });

  const individualResults = await Promise.allSettled(individualPromises);

  individualResults.forEach((result) => {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      results.push({
        filename: "unknown",
        error:
          result.reason?.message ||
          "Unknown error during individual processing",
        status: "failed",
      });
    }
  });

  return results;
}

module.exports = { processFallbackIndividual };

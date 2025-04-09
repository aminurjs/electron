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
      const result = batchResult[0]; // Return the first (and only) result

      // Send real-time result if the onResultAvailable callback is provided
      if (global.progressEvents?.onResultAvailable) {
        global.progressEvents.onResultAvailable(result);
      }

      return result;
    } catch (error) {
      console.error(
        `Individual processing failed for ${
          image.filename || path.basename(image.path)
        }: ${error.message}`
      );

      const failedResult = {
        filename: image.filename || path.basename(image.path),
        error: error.message || "Unknown error during individual processing",
        status: "failed",
      };

      // Also notify for failed results
      if (global.progressEvents?.onResultAvailable) {
        global.progressEvents.onResultAvailable(failedResult);
      }

      return failedResult;
    } finally {
      release();
    }
  });

  const individualResults = await Promise.allSettled(individualPromises);

  individualResults.forEach((result) => {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      const failedResult = {
        filename: "unknown",
        error:
          result.reason?.message ||
          "Unknown error during individual processing",
        status: "failed",
      };

      results.push(failedResult);

      // Notify for errors in Promise handling
      if (global.progressEvents?.onResultAvailable) {
        global.progressEvents.onResultAvailable(failedResult);
      }
    }
  });

  return results;
}

module.exports = { processFallbackIndividual };

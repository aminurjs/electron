const fs = require("fs");
const { Semaphore } = require("./semaphore");
const { processBatch } = require("./processBatch");
const { batchImages } = require("./batchImages");

// Define concurrency limits
const PREMIUM_CONCURRENCY_LIMIT = 10;
const FREE_CONCURRENCY_LIMIT = 2;
const IMAGE_BATCH_SIZE = 5;

async function processBatchWithConcurrencyLimit(images, options, apiKey) {
  const results = [];
  const totalImages = images.length;

  // Determine concurrency limit based on isPremium setting
  const { isPremium } = options;
  const concurrencyLimit = isPremium
    ? PREMIUM_CONCURRENCY_LIMIT
    : FREE_CONCURRENCY_LIMIT;

  console.log(
    `Processing ${totalImages} images with concurrency limit ${concurrencyLimit} (${
      isPremium ? "Premium" : "Free"
    } mode)`
  );

  // Extract the callback function if provided
  const { onImageProcessed, ...processingOptions } = options;

  // Group images into batches for multi-image processing
  const imageBatches = batchImages(images, IMAGE_BATCH_SIZE);

  // Process batches with concurrency limit
  const semaphore = new Semaphore(concurrencyLimit);
  const processPromises = imageBatches.map(async (batch, batchIndex) => {
    const release = await semaphore.acquire();
    try {
      // Verify files exist before processing
      const validImages = batch.filter(
        (item) => item.path && fs.existsSync(item.path)
      );

      if (validImages.length === 0) {
        console.error(`No valid files in batch ${batchIndex + 1}`);

        // Call the callback for each image that was skipped
        if (typeof onImageProcessed === "function") {
          batch.forEach(() => onImageProcessed());
        }

        return batch.map((item) => ({
          filename: item.originalname || item.filename,
          error: `File not found: ${item.path}`,
          status: "failed",
        }));
      }

      // Process batch together
      const batchOptions = {
        ...processingOptions,
        onBatchComplete: () => {
          // Call the progress callback for each image in the batch when complete
          if (typeof onImageProcessed === "function") {
            validImages.forEach(() => onImageProcessed());
          }
        },
      };

      const batchResults = await processBatch(
        validImages,
        batchOptions,
        apiKey
      );

      return batchResults;
    } catch (error) {
      console.error(
        `Error processing batch ${batchIndex + 1}: ${error.message}`
      );

      // Call the callback for each image that failed due to the error
      if (typeof onImageProcessed === "function") {
        batch.forEach(() => onImageProcessed());
      }

      return batch.map((item) => ({
        filename: item.originalname || item.filename,
        error: error.message || "Unknown error",
        status: "failed",
      }));
    } finally {
      release();
    }
  });

  // Wait for all promises to settle
  const allResults = await Promise.allSettled(processPromises);

  // Process results
  allResults.forEach((result) => {
    if (result.status === "fulfilled") {
      results.push(...result.value);
    } else {
      results.push({
        filename: "unknown",
        error: result.reason?.message || "Unknown error",
        status: "failed",
      });

      // Call callback for the failure case
      if (typeof onImageProcessed === "function") {
        onImageProcessed();
      }
    }
  });

  return results;
}

module.exports = { processBatchWithConcurrencyLimit };

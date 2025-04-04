const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");
const { uploadToGemini } = require("./uploadGemini");
const { BASE_PROMPT, FORBIDDEN_KEYWORDS, prompt } = require("./ai/prompt");
const { Semaphore } = require("./semaphore");
const getGeminiConfig = require("./ai/config");
const { repairJson } = require("./repairJson");
const { validateMetadata } = require("./validateMetadata");
const { addMetadataToImage } = require("./addMetadataToImage");
const { cleanupTempFilesAsync } = require("./cleanupTempFilesAsync");
const { getMimeType } = require("./utils/getMimeType");

const MAX_CONCURRENT_UPLOAD_REQUESTS = 10;

async function processBatch(batch, options, apiKey) {
  const { model, generationConfig, safetySettings } = getGeminiConfig(apiKey);
  const { titleLength, descriptionLength, keywordCount } = options;
  const results = [];
  const tempFiles = [];

  try {
    const tempDir = path.join(os.tmpdir(), "image-processing");
    if (!fs.existsSync(tempDir)) {
      await fs.promises.mkdir(tempDir, { recursive: true });
    }

    const preparedImages = await Promise.all(
      batch.map(async (image) => {
        if (!image.path) {
          throw new Error("Image object missing path property");
        }

        const mimeType = getMimeType(image.path);
        const imageBuffer = await fs.promises.readFile(image.path);

        const imageFilename =
          image.originalname || image.filename || path.basename(image.path);

        const tempResizedPath = path.join(
          tempDir,
          `resized_${Date.now()}_${path.basename(imageFilename)}`
        );
        await sharp(imageBuffer)
          .resize({ width: 768, withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toFile(tempResizedPath);

        const tempOriginalPath = path.join(
          tempDir,
          `original_${Date.now()}_${path.basename(imageFilename)}`
        );
        await fs.promises.writeFile(tempOriginalPath, imageBuffer);

        tempFiles.push(tempResizedPath, tempOriginalPath);

        return {
          originalImage: {
            ...image,
            originalname: imageFilename,
          },
          resizedPath: tempResizedPath,
          originalPath: tempOriginalPath,
          mimeType,
          imageBuffer,
        };
      })
    );

    const geminiFiles = await Promise.all(
      preparedImages.map(async (item) => ({
        file: await uploadToGemini(item.resizedPath, item.mimeType, apiKey),
        originalItem: item,
      }))
    );

    const parts = geminiFiles.map(({ file }) => ({
      fileData: { mimeType: file.mimeType, fileUri: file.uri },
    }));
    parts.push({ text: BASE_PROMPT });

    let chatSession = model.startChat({
      generationConfig,
      safetySettings,
      history: [{ role: "user", parts }],
    });

    const forbiddenKeywordsStr = FORBIDDEN_KEYWORDS.join(", ");
    const promptStr = prompt(
      titleLength || 90,
      descriptionLength || 120,
      keywordCount || 25
    );

    let metadataArray = null;
    let retryCount = 0;
    const MAX_RETRIES = 2;
    const INITIAL_TIMEOUT = 20000;

    retry_loop: while (retryCount <= MAX_RETRIES) {
      const timeout = INITIAL_TIMEOUT * (1 + retryCount * 0.5);

      try {
        const result = await Promise.race([
          chatSession.sendMessage(`${promptStr}: ${forbiddenKeywordsStr}`),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Gemini API timeout after ${timeout}ms`)),
              timeout
            )
          ),
        ]);

        const jsonResponse = result.response.text();

        let cleanedResponse = jsonResponse;
        const jsonBlockMatch = jsonResponse.match(
          /```(?:json)?\s*([\s\S]*?)```/
        );
        if (jsonBlockMatch) {
          cleanedResponse = jsonBlockMatch[1].trim();
        } else {
          cleanedResponse = jsonResponse
            .replace(/^```json/, "")
            .replace(/```$/, "")
            .trim();
        }

        cleanedResponse = cleanedResponse
          .replace(/^[^{[\s]*/, "")
          .replace(/[^}\]]\s*$/, "")
          .trim();

        try {
          try {
            metadataArray = JSON.parse(cleanedResponse);
          } catch (initialParseError) {
            console.warn(
              `Initial JSON parsing failed: ${initialParseError.message}`
            );
            const repairedJson = repairJson(cleanedResponse);
            if (repairedJson !== cleanedResponse) {
              metadataArray = JSON.parse(repairedJson);
            } else {
              throw initialParseError;
            }
          }

          if (!Array.isArray(metadataArray)) {
            metadataArray = [metadataArray];
          }

          if (metadataArray.length < preparedImages.length) {
            console.warn(
              `Attempt ${retryCount + 1}: Incomplete metadata (${
                metadataArray.length
              } items for ${preparedImages.length} images)`
            );

            if (retryCount === MAX_RETRIES) {
              while (metadataArray.length < preparedImages.length) {
                const missingIdx = metadataArray.length;
                const originalImage = preparedImages[missingIdx].originalImage;

                // Safely get a base name for the image
                let baseName = "image";
                if (originalImage && originalImage.originalname) {
                  baseName = path
                    .basename(
                      originalImage.originalname,
                      path.extname(originalImage.originalname)
                    )
                    .replace(/[-_]/g, " ");
                } else if (originalImage && originalImage.path) {
                  baseName = path
                    .basename(
                      originalImage.path,
                      path.extname(originalImage.path)
                    )
                    .replace(/[-_]/g, " ");
                }

                metadataArray.push({
                  title: `Professional image of ${baseName}`,
                  description: `High quality detailed image showing ${baseName} with professional composition and lighting. Perfect for commercial use and design projects.`,
                  keywords: [
                    "professional",
                    "high quality",
                    "detailed",
                    "commercial use",
                    "photography",
                    "digital image",
                    "stock photo",
                    baseName,
                  ],
                  _generated: "placeholder_from_incomplete_response",
                });
              }
            } else {
              throw new Error(
                `Incomplete metadata: expected ${preparedImages.length} items, got ${metadataArray.length}`
              );
            }
          }

          for (let idx = 0; idx < metadataArray.length; idx++) {
            const isValid = validateMetadata(
              metadataArray[idx],
              path.basename(
                preparedImages[idx]?.originalImage?.originalname ||
                  preparedImages[idx]?.originalImage?.path ||
                  `image_${idx}`
              )
            );
            if (!isValid) {
              console.warn(
                `Attempt ${retryCount + 1}: Invalid metadata for image ${idx}`
              );
              throw new Error(`Invalid metadata format for image ${idx}`);
            }
          }

          break retry_loop;
        } catch (parseError) {
          console.warn(
            `Attempt ${retryCount + 1}: Error: ${parseError.message}`
          );
          metadataArray = null;

          if (retryCount === MAX_RETRIES) {
            throw new Error(
              `Failed to parse or validate Gemini response: ${parseError.message}`
            );
          }
        }
      } catch (apiError) {
        console.warn(
          `Attempt ${retryCount + 1}: Gemini API error: ${apiError.message}`
        );
        if (!apiError.message.includes("timeout")) {
          chatSession = model.startChat({
            generationConfig,
            safetySettings,
            history: [{ role: "user", parts }],
          });
        }

        if (retryCount === MAX_RETRIES) {
          throw new Error(`${apiError.message}`);
        }
      }

      retryCount++;
      const baseDelay = 1000 * Math.pow(2, retryCount);
      const jitter = Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
    }

    if (!metadataArray) {
      throw new Error(`Failed to get valid metadata`);
    }

    const uploadSemaphore = new Semaphore(MAX_CONCURRENT_UPLOAD_REQUESTS);
    const uploadPromises = preparedImages.map(async (item, index) => {
      const release = await uploadSemaphore.acquire();
      try {
        let metadata = metadataArray[index];

        if (
          !metadata ||
          !validateMetadata(
            metadata,
            item.originalImage.originalname ||
              (item.originalImage.path
                ? path.basename(item.originalImage.path)
                : `image_${index}`)
          )
        ) {
          const singleImageParts = [
            {
              fileData: {
                mimeType: item.mimeType,
                fileUri: (
                  await uploadToGemini(item.resizedPath, item.mimeType, apiKey)
                ).uri,
              },
            },
            { text: BASE_PROMPT },
          ];

          const singleImageChat = model.startChat({
            generationConfig,
            safetySettings,
            history: [{ role: "user", parts: singleImageParts }],
          });

          const singleImageResult = await singleImageChat.sendMessage(
            `${promptStr}: ${forbiddenKeywordsStr}`
          );
          const singleImageResponse = singleImageResult.response.text();

          let cleanedSingle = singleImageResponse
            .replace(/^```json/, "")
            .replace(/```$/, "")
            .trim();
          let singleImageMetadata = JSON.parse(cleanedSingle);

          if (!Array.isArray(singleImageMetadata))
            singleImageMetadata = [singleImageMetadata];
          singleImageMetadata = singleImageMetadata[0];

          if (
            validateMetadata(
              singleImageMetadata,
              item.originalImage.originalname ||
                (item.originalImage.path
                  ? path.basename(item.originalImage.path)
                  : `image_${index}`)
            )
          ) {
            metadata = singleImageMetadata;
          } else {
            throw new Error("Invalid metadata for single image");
          }
        }

        const metadataResult = await addMetadataToImage(
          item.originalPath,
          metadata,
          item.originalImage.outputPath
        );

        return {
          filename:
            item.originalImage.originalname ||
            path.basename(item.originalImage.path),
          size: item.originalImage.size,
          metadata,
          outputPath: metadataResult.outputPath,
        };
      } catch (error) {
        return {
          filename:
            item.originalImage.originalname ||
            path.basename(item.originalImage.path),
          error: error.message || "Unknown error",
          status: "failed",
        };
      } finally {
        release();
      }
    });

    const uploadResults = await Promise.allSettled(uploadPromises);

    uploadResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          filename:
            preparedImages[index].originalImage.originalname ||
            path.basename(preparedImages[index].originalImage.path),
          error: result.reason?.message || "Unknown error",
          status: "failed",
        });
      }
    });

    cleanupTempFilesAsync(tempFiles);
    return results;
  } catch (error) {
    cleanupTempFilesAsync(tempFiles);
    return batch.map((image) => ({
      filename: image.originalname || path.basename(image.path),
      error: error.message || "Unknown error",
      status: "failed",
    }));
  }
}

module.exports = { processBatch };

const IMAGE_BATCH_SIZE = 5;

function batchImages(images, batchSize = IMAGE_BATCH_SIZE) {
  const batches = [];
  for (let i = 0; i < images.length; i += batchSize) {
    batches.push(images.slice(i, i + batchSize));
  }
  return batches;
}

module.exports = { batchImages };

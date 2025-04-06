const pngToIco = require("png-to-ico");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

async function convertPngToIco() {
  try {
    console.log("Converting PNG to ICO...");
    const pngPath = path.join(__dirname, "src", "assets", "icon.png");
    const squarePngPath = path.join(
      __dirname,
      "src",
      "assets",
      "icon-square.png"
    );
    const icoPath = path.join(__dirname, "src", "assets", "icon.ico");

    // First, backup the original .ico file which is actually a PNG
    if (fs.existsSync(icoPath)) {
      fs.copyFileSync(
        icoPath,
        path.join(__dirname, "src", "assets", "icon.ico.backup")
      );
      console.log("Backed up original icon.ico file");
    }

    // Resize PNG to a square image
    console.log("Resizing PNG to a square image...");
    await sharp(pngPath).resize(256, 256).toFile(squarePngPath);

    console.log("Square PNG created");

    // Convert PNG to ICO
    const buffer = await pngToIco(squarePngPath);

    // Write the ICO file
    fs.writeFileSync(icoPath, buffer);
    console.log("Successfully converted PNG to ICO");

    // Clean up the temporary square PNG
    fs.unlinkSync(squarePngPath);
    console.log("Cleaned up temporary files");
  } catch (error) {
    console.error("Error converting PNG to ICO:", error);
  }
}

convertPngToIco();

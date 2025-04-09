const rcedit = require("rcedit");
const path = require("path");

module.exports = async function (context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const exePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productName}.exe`
  );
  const iconPath = path.join(__dirname, "src", "assets", "icon.ico");

  try {
    await rcedit(exePath, { icon: iconPath });
    console.log("Icon updated successfully!");
  } catch (error) {
    console.error("Error updating icon:", error);
    throw error;
  }
};

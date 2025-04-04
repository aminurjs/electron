function repairJson(jsonString) {
  if (!jsonString) return "";

  try {
    // First try parsing as-is
    JSON.parse(jsonString);
    return jsonString; // If no error, return unchanged
  } catch (error) {
    // console.log(`Attempting to repair malformed JSON: ${error.message}`);

    let repairedJson = jsonString;

    // The position in the error message can help locate the issue
    const positionMatch = error.message.match(/position (\d+)/);
    const errorPosition = positionMatch ? parseInt(positionMatch[1]) : -1;

    if (errorPosition > 0) {
      console.log(`Error detected near position ${errorPosition}`);

      // Extract context around the error (20 chars before and after)
      const start = Math.max(0, errorPosition - 20);
      const end = Math.min(jsonString.length, errorPosition + 20);
      const context = jsonString.substring(start, end);
      console.log(`Context around error: "${context}"`);
    }

    // Fix dangling commas in objects
    repairedJson = repairedJson.replace(/,\s*}/g, "}");

    // Fix dangling commas in arrays
    repairedJson = repairedJson.replace(/,\s*\]/g, "]");

    // Add missing quotes around property names
    repairedJson = repairedJson.replace(
      /({|,)\s*([a-zA-Z0-9_]+)\s*:/g,
      '$1"$2":'
    );

    // Fix missing commas between properties
    repairedJson = repairedJson.replace(/"\s*}\s*{\s*"/g, '"},{"');
    repairedJson = repairedJson.replace(/"\s*}\s*"/g, '"},"');

    // Fix unescaped quotes in strings - fixed regex without unnecessary escapes
    repairedJson = repairedJson.replace(/(:\s*".*?)(?<!\\)"(.*?")/g, '$1\\"$2');

    // Fix for incomplete arrays or objects
    if (repairedJson.split("{").length > repairedJson.split("}").length) {
      repairedJson += "}";
    }
    if (repairedJson.split("[").length > repairedJson.split("]").length) {
      repairedJson += "]";
    }

    // Ensure the JSON is wrapped in brackets if it seems like an array
    if (!repairedJson.startsWith("[") && repairedJson.includes('{"title":')) {
      repairedJson = "[" + repairedJson + "]";
    }

    return repairedJson;
  }
}
module.exports = { repairJson };

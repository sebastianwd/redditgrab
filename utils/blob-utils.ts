/**
 * Create a blob URL that works in both Chrome Manifest V3 and Firefox
 * Falls back to data URL if URL.createObjectURL is not available
 */
export async function createBlobUrl(blob: Blob): Promise<string> {
  if (typeof URL !== "undefined" && URL.createObjectURL) {
    return URL.createObjectURL(blob);
  }

  return await convertBlobToDataUrl(blob);
}

/**
 * Convert blob to data URL for Chrome Manifest V3 compatibility
 */
function convertBlobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error("Failed to convert blob to data URL"));
    };
    reader.readAsDataURL(blob);
  });
}

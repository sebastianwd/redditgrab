const DATABASE_NAME = "redditgrab-media-hashes";
const DATABASE_VERSION = 1;
const STORE_NAME = "mediaHashes";
const IMAGE_HASH_PREFIX = "image-phash:";
export const IMAGE_HASH_DISTANCE_THRESHOLD = 6;

function openMediaHashDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "hash" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function hashMediaBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Create a 64-bit perceptual hash from a normalized 32x32 image. */
export async function hashImagePerceptually(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  try {
    const size = 32;
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Unable to create image hash canvas");
    context.drawImage(bitmap, 0, 0, size, size);
    const rgba = context.getImageData(0, 0, size, size).data;
    const grayscale = new Float64Array(size * size);
    for (let i = 0; i < grayscale.length; i++) {
      const offset = i * 4;
      grayscale[i] =
        0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2];
    }

    const lowFrequencySize = 8;
    const coefficients: number[] = [];
    for (let v = 0; v < lowFrequencySize; v++) {
      for (let u = 0; u < lowFrequencySize; u++) {
        let coefficient = 0;
        for (let y = 0; y < size; y++) {
          const vertical = Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
          for (let x = 0; x < size; x++) {
            coefficient +=
              grayscale[y * size + x] *
              vertical *
              Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size));
          }
        }
        coefficients.push(coefficient);
      }
    }

    const sortedAc = coefficients.slice(1).sort((a, b) => a - b);
    const median = sortedAc[Math.floor(sortedAc.length / 2)];
    return coefficients
      .map((coefficient) => (coefficient >= median ? "1" : "0"))
      .join("")
      .match(/.{4}/g)!
      .map((bits) => parseInt(bits, 2).toString(16))
      .join("");
  } finally {
    bitmap.close();
  }
}

export function imagePerceptualHashKey(hash: string): string {
  return `${IMAGE_HASH_PREFIX}${hash}`;
}

export async function hasSimilarImageHash(hash: string): Promise<boolean> {
  const database = await openMediaHashDatabase();
  try {
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const candidate = BigInt(`0x${hash}`);
    for (const key of keys) {
      if (typeof key !== "string" || !key.startsWith(IMAGE_HASH_PREFIX)) continue;
      const stored = BigInt(`0x${key.slice(IMAGE_HASH_PREFIX.length)}`);
      let difference = candidate ^ stored;
      let distance = 0;
      while (difference) {
        distance++;
        difference &= difference - 1n;
      }
      if (distance <= IMAGE_HASH_DISTANCE_THRESHOLD) return true;
    }
    return false;
  } finally {
    database.close();
  }
}

export async function saveImagePerceptualHash(hash: string): Promise<void> {
  await saveMediaHash(imagePerceptualHashKey(hash));
}

export async function hasMediaHash(hash: string): Promise<boolean> {
  const database = await openMediaHashDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .getKey(hash);
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function saveMediaHash(hash: string): Promise<void> {
  const database = await openMediaHashDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ hash });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/**
 * Crops an image based on bounding box coordinates [ymin, xmin, ymax, xmax] (0-1000 scale).
 */
export const cropImageFromBox = (base64Image: string, box: number[]): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            if (!box || box.length !== 4) {
                // If no valid box, return original
                resolve(base64Image);
                return;
            }

            const [ymin, xmin, ymax, xmax] = box;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }

            // Calculate pixel coordinates
            // Gemini 0-1000 scale
            const x = (xmin / 1000) * img.width;
            const y = (ymin / 1000) * img.height;
            const w = ((xmax - xmin) / 1000) * img.width;
            const h = ((ymax - ymin) / 1000) * img.height;

            // Add a tiny padding (optional, ensures borders aren't cut too tight)
            const padding = 0; 
            
            // Validate dimensions
            if (w <= 0 || h <= 0) {
                resolve(base64Image);
                return;
            }

            canvas.width = w;
            canvas.height = h;

            // Draw the cropped area
            ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

            // Return as high quality JPEG
            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = () => reject(new Error("Failed to load image for cropping"));
        img.src = base64Image;
    });
};

/**
 * Resizes an image to a maximum width/height to reduce payload size for AI analysis.
 * Does not affect the quality of the final cropped image, only the one sent to API.
 */
export const resizeImage = (base64Str: string, maxWidth: number = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Use standard quality for AI analysis (faster upload)
        resolve(canvas.toDataURL('image/jpeg', 0.8)); 
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};
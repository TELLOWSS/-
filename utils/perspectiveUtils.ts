import { Point } from "../types";

/**
 * Calculates the Homography Matrix to map source points to destination points.
 * Solves the linear system Ax = h using Gaussian elimination.
 */
function getHomographyMatrix(src: Point[], dst: Point[]): number[] {
    let a: number[][] = [];
    let b: number[] = [];

    for (let i = 0; i < 4; i++) {
        let x = src[i].x;
        let y = src[i].y;
        let X = dst[i].x;
        let Y = dst[i].y;

        a.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
        a.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
        b.push(X);
        b.push(Y);
    }

    // Gaussian elimination to solve the system
    const n = 8;
    for (let i = 0; i < n; i++) {
        let pivot = i;
        for (let j = i + 1; j < n; j++) {
            if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) {
                pivot = j;
            }
        }

        [a[i], a[pivot]] = [a[pivot], a[i]];
        [b[i], b[pivot]] = [b[pivot], b[i]];

        for (let j = i + 1; j < n; j++) {
            const factor = a[j][i] / a[i][i];
            b[j] -= factor * b[i];
            for (let k = i; k < n; k++) {
                a[j][k] -= factor * a[i][k];
            }
        }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) {
            sum += a[i][j] * x[j];
        }
        x[i] = (b[i] - sum) / a[i][i];
    }

    return [...x, 1]; // Return the 3x3 matrix as a 9-element array
}

/**
 * Applies the perspective warp to the image source based on 4 corner points.
 * Returns a Base64 string of the warped image.
 */
export const warpPerspective = (imageSrc: string, corners: Point[]): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // 1. Calculate destination dimensions (Max width/height of the quad)
            const topWidth = Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2));
            const bottomWidth = Math.sqrt(Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2));
            const leftHeight = Math.sqrt(Math.pow(corners[3].x - corners[0].x, 2) + Math.pow(corners[3].y - corners[0].y, 2));
            const rightHeight = Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2));

            const width = Math.floor(Math.max(topWidth, bottomWidth));
            const height = Math.floor(Math.max(leftHeight, rightHeight));

            // 2. Define source and destination points
            // Order: TL, TR, BR, BL
            const srcPts = corners;
            const dstPts = [
                { x: 0, y: 0 },
                { x: width, y: 0 },
                { x: width, y: height },
                { x: 0, y: height }
            ];

            // 3. Compute Homography Matrix (Inverse mapping: Dst -> Src)
            // We want to iterate over Dst pixels and find which Src pixel belongs there.
            // So we calculate mapping from Dst to Src.
            const h = getHomographyMatrix(dstPts, srcPts);

            // 4. Create Canvas for pixel manipulation
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject("Canvas context error");

            // Draw original image to an offscreen canvas to get pixel data
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = img.width;
            srcCanvas.height = img.height;
            const srcCtx = srcCanvas.getContext('2d');
            if (!srcCtx) return reject("Source Canvas context error");
            srcCtx.drawImage(img, 0, 0);
            
            const srcData = srcCtx.getImageData(0, 0, img.width, img.height);
            const dstData = ctx.createImageData(width, height);

            const sData = srcData.data;
            const dData = dstData.data;

            // 5. Pixel Iteration (Bilinear Interpolation)
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    // Apply Matrix: Src(u, v, w) = H * Dst(x, y, 1)
                    const u = h[0] * x + h[1] * y + h[2];
                    const v = h[3] * x + h[4] * y + h[5];
                    const w = h[6] * x + h[7] * y + h[8];

                    const srcX = u / w;
                    const srcY = v / w;

                    // Check bounds
                    if (srcX >= 0 && srcX < img.width - 1 && srcY >= 0 && srcY < img.height - 1) {
                        // Bilinear Interpolation
                        const x0 = Math.floor(srcX);
                        const x1 = x0 + 1;
                        const y0 = Math.floor(srcY);
                        const y1 = y0 + 1;

                        const wx = srcX - x0;
                        const wy = srcY - y0;

                        const srcIdx00 = (y0 * img.width + x0) * 4;
                        const srcIdx10 = (y0 * img.width + x1) * 4;
                        const srcIdx01 = (y1 * img.width + x0) * 4;
                        const srcIdx11 = (y1 * img.width + x1) * 4;

                        const dstIdx = (y * width + x) * 4;

                        for (let c = 0; c < 3; c++) { // RGB
                             const val00 = sData[srcIdx00 + c];
                             const val10 = sData[srcIdx10 + c];
                             const val01 = sData[srcIdx01 + c];
                             const val11 = sData[srcIdx11 + c];

                             const top = val00 * (1 - wx) + val10 * wx;
                             const bottom = val01 * (1 - wx) + val11 * wx;
                             
                             dData[dstIdx + c] = top * (1 - wy) + bottom * wy;
                        }
                        dData[dstIdx + 3] = 255; // Alpha
                    }
                }
            }

            ctx.putImageData(dstData, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = () => reject("Failed to load image");
        img.src = imageSrc;
    });
};

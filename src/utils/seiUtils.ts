import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Minimal PNG encoder for grayscale images (based on UPNG.js approach).
 * Creates a valid PNG file from grayscale pixel data.
 */
function encodePNG(pixels: Uint8Array, width: number, height: number): string {
  // Build CRC table
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }

  const crc32 = (data: Uint8Array, off: number, len: number): number => {
    let c = 0xffffffff;
    for (let i = 0; i < len; i++) {
      c = crcTable[(c ^ data[off + i]) & 0xff] ^ (c >>> 8);
    }
    return c ^ 0xffffffff;
  };

  const write32 = (arr: Uint8Array, pos: number, val: number) => {
    arr[pos] = (val >>> 24) & 0xff;
    arr[pos + 1] = (val >>> 16) & 0xff;
    arr[pos + 2] = (val >>> 8) & 0xff;
    arr[pos + 3] = val & 0xff;
  };

  const writeChunk = (out: Uint8Array, pos: number, type: string, data: Uint8Array): number => {
    const len = data.length;
    write32(out, pos, len);
    pos += 4;
    
    out[pos++] = type.charCodeAt(0);
    out[pos++] = type.charCodeAt(1);
    out[pos++] = type.charCodeAt(2);
    out[pos++] = type.charCodeAt(3);
    
    for (let i = 0; i < len; i++) out[pos + i] = data[i];
    const crc = crc32(out, pos - 4, len + 4);
    write32(out, pos + len, crc);
    
    return pos + len + 4;
  };

  // PNG signature
  const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = new Uint8Array(13);
  write32(ihdr, 0, width);
  write32(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Prepare image data with filter bytes
  const bpp = 1; // bytes per pixel
  const lineSize = 1 + width * bpp;
  const rawData = new Uint8Array(height * lineSize);
  for (let y = 0; y < height; y++) {
    const lineStart = y * lineSize;
    rawData[lineStart] = 0; // filter method 0
    for (let x = 0; x < width; x++) {
      rawData[lineStart + 1 + x] = pixels[y * width + x];
    }
  }

  // Compress with zlib (uncompressed DEFLATE)
  const maxBlockSize = 0xffff;
  const numBlocks = Math.ceil(rawData.length / maxBlockSize);
  const zlibData = new Uint8Array(2 + rawData.length + numBlocks * 5 + 4);
  
  zlibData[0] = 0x78; // CMF
  zlibData[1] = 0x01; // FLG
  
  let pos = 2;
  for (let i = 0; i < numBlocks; i++) {
    const start = i * maxBlockSize;
    const end = Math.min(start + maxBlockSize, rawData.length);
    const blockLen = end - start;
    const isLast = (i === numBlocks - 1) ? 1 : 0;
    
    zlibData[pos++] = isLast;
    zlibData[pos++] = blockLen & 0xff;
    zlibData[pos++] = (blockLen >>> 8) & 0xff;
    zlibData[pos++] = (~blockLen) & 0xff;
    zlibData[pos++] = ((~blockLen) >>> 8) & 0xff;
    
    for (let j = start; j < end; j++) {
      zlibData[pos++] = rawData[j];
    }
  }

  // Adler-32
  let s1 = 1, s2 = 0;
  for (let i = 0; i < rawData.length; i++) {
    s1 = (s1 + rawData[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  write32(zlibData, pos, (s2 << 16) | s1);

  const idatData = zlibData.subarray(0, pos + 4);

  // IEND
  const iend = new Uint8Array(0);

  // Calculate total size
  const totalSize = 8 + (4 + 4 + 13 + 4) + (4 + 4 + idatData.length + 4) + (4 + 4 + 0 + 4);
  const output = new Uint8Array(totalSize);

  // Write PNG
  let outPos = 0;
  output.set(pngSignature, outPos);
  outPos += 8;
  outPos = writeChunk(output, outPos, 'IHDR', ihdr);
  outPos = writeChunk(output, outPos, 'IDAT', idatData);
  outPos = writeChunk(output, outPos, 'IEND', iend);

  // Convert to base64
  let binary = '';
  for (let i = 0; i < output.length; i++) {
    binary += String.fromCharCode(output[i]);
  }
  return btoa(binary);
}

export type Landmark = {
  x: number; // original x coordinate (pixels or normalized)
  y: number; // original y coordinate
  z?: number;
  visibility?: number;
};

export type FramePose = {
  landmarks: Landmark[];
};

export type PoseJson = {
  metadata?: { width?: number; height?: number; frame_count?: number };
  frames: FramePose[];
};

export type NormalizedFrame = {
  landmarks: { x: number; y: number }[]; // normalized to 0..1 within crop box
};

/**
 * Load a pose JSON file saved by the WebView extractor.
 * Accepts a file URI (expo FileSystem uri) or a filesystem path.
 */
export async function loadPoseJson(uri: string): Promise<PoseJson> {
  const content = await FileSystem.readAsStringAsync(uri);
  return JSON.parse(content) as PoseJson;
}

/**
 * Compute crop based on min/max Y across all frames and center X based on furthest left/right X.
 * Then normalize all landmark coordinates into 0..1 within that crop box.
 *
 * Options:
 *  - inputIsNormalized: if true, input landmark coords are already normalized (0..1) relative to original video.
 *  - videoWidth/videoHeight: when inputs are absolute pixels, provide video size to normalize first.
 */
export function computeCropAndNormalize(poses: PoseJson, options?: { inputIsNormalized?: boolean; videoWidth?: number; videoHeight?: number; }): { normalizedFrames: NormalizedFrame[]; crop: { left: number; right: number; top: number; bottom: number }; } {
  const inputIsNormalized = options?.inputIsNormalized ?? false;
  const vw = options?.videoWidth ?? 1;
  const vh = options?.videoHeight ?? 1;

  // Collect all x,y across all frames and landmarks
  const xs: number[] = [];
  const ys: number[] = [];

  for (const frame of poses.frames) {
    for (const lm of frame.landmarks || []) {
      if (lm == null) continue;
      const x = inputIsNormalized ? lm.x : (lm.x ?? 0) / vw;
      const y = inputIsNormalized ? lm.y : (lm.y ?? 0) / vh;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      xs.push(x);
      ys.push(y);
    }
  }

  if (xs.length === 0 || ys.length === 0) {
    // Nothing to normalize; return empty
    return { normalizedFrames: [], crop: { left: 0, right: 1, top: 0, bottom: 1 } };
  }

  // Crop in Y: top = minY, bottom = maxY
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // For X: find minX, maxX and compute center; then create symmetric horizontal bounds around center
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  // Compute horizontal center using shoulders and hips midpoints across frames when available
  const SHOULDER_LEFT = 11;
  const SHOULDER_RIGHT = 12;
  const HIP_LEFT = 23;
  const HIP_RIGHT = 24;
  const centers: number[] = [];
  for (const frame of poses.frames) {
    const l = frame.landmarks || [];
    // gather normalized x for required landmarks when possible
    const getX = (idx: number) => {
      const lm = l[idx];
      if (!lm) return NaN;
      return inputIsNormalized ? lm.x : (lm.x ?? 0) / vw;
    };
    const lsx = getX(SHOULDER_LEFT);
    const rsx = getX(SHOULDER_RIGHT);
    const lhx = getX(HIP_LEFT);
    const rhx = getX(HIP_RIGHT);
    if ([lsx, rsx, lhx, rhx].every(Number.isFinite)) {
      const shouldersMid = (lsx + rsx) / 2;
      const hipsMid = (lhx + rhx) / 2;
      centers.push((shouldersMid + hipsMid) / 2);
    }
  }

  const centerX = (centers.length > 0) ? (centers.reduce((a, b) => a + b, 0) / centers.length) : ((minX + maxX) / 2);
  // We'll create left/right such that width = max(maxX-minX, maxY-minY) to keep square aspect if desired.
  const width = Math.max(maxX - minX, maxY - minY);
  // If width is 0 fallback to small epsilon
  const halfW = (width <= 0) ? 0.5 : width / 2;
  let left = centerX - halfW;
  let right = centerX + halfW;

  // Ensure bounds are within [0,1]
  if (left < 0) {
    const shift = -left;
    left += shift;
    right += shift;
  }
  if (right > 1) {
    const shift = right - 1;
    left -= shift;
    right -= shift;
  }
  // Clamp final
  left = Math.max(0, Math.min(1, left));
  right = Math.max(0, Math.min(1, right));
  const top = Math.max(0, Math.min(1, minY));
  const bottom = Math.max(0, Math.min(1, maxY));

  // First: per-frame square crop and normalize each frame into its own 0..1 square.
  const perFrameNorm: NormalizedFrame[] = [];
  for (const frame of poses.frames) {
    const lms = frame.landmarks || [];
    // compute frame bbox in normalized coordinates
    const xs_f: number[] = [];
    const ys_f: number[] = [];
    for (const lm of lms) {
      if (!lm) { xs_f.push(NaN); ys_f.push(NaN); continue; }
      const x = inputIsNormalized ? lm.x : (lm.x ?? 0) / vw;
      const y = inputIsNormalized ? lm.y : (lm.y ?? 0) / vh;
      xs_f.push(x); ys_f.push(y);
    }

    const validXs = xs_f.filter(Number.isFinite);
    const validYs = ys_f.filter(Number.isFinite);
    if (validXs.length === 0 || validYs.length === 0) {
      // produce empty frame with same number of landmarks as input
      perFrameNorm.push({ landmarks: lms.map(() => ({ x: 0.5, y: 0.5 })) });
      continue;
    }

    const fMinX = Math.min(...validXs);
    const fMaxX = Math.max(...validXs);
    const fMinY = Math.min(...validYs);
    const fMaxY = Math.max(...validYs);

    const fWidth = fMaxX - fMinX;
    const fHeight = fMaxY - fMinY;
    const side = Math.max(fWidth, fHeight, 1e-6);
    const cx = (fMinX + fMaxX) / 2;
    const cy = (fMinY + fMaxY) / 2;
    let fLeft = cx - side / 2;
    let fTop = cy - side / 2;
    // clamp to [0,1]
    if (fLeft < 0) fLeft = 0;
    if (fTop < 0) fTop = 0;
    if (fLeft + side > 1) fLeft = Math.max(0, 1 - side);
    if (fTop + side > 1) fTop = Math.max(0, 1 - side);

    const outLms: { x: number; y: number }[] = [];
    for (let i = 0; i < lms.length; i++) {
      const lm = lms[i];
      if (!lm) { outLms.push({ x: 0.5, y: 0.5 }); continue; }
      const xRaw = inputIsNormalized ? lm.x : (lm.x ?? 0) / vw;
      const yRaw = inputIsNormalized ? lm.y : (lm.y ?? 0) / vh;
      const xFr = (xRaw - fLeft) / side;
      const yFr = (yRaw - fTop) / side;
      outLms.push({ x: clamp(xFr), y: clamp(yFr) });
    }
    perFrameNorm.push({ landmarks: outLms });
  }

  // Now compute global vertical crop (top/bottom) and horizontal center using shoulders+hips from per-frame normalized coords
  const allYs: number[] = [];
  const centers2: number[] = [];
  for (const frame of perFrameNorm) {
    for (const lm of frame.landmarks) {
      if (!lm) continue;
      allYs.push(lm.y);
    }
    const l = frame.landmarks;
    const getX = (idx: number) => { const p = l[idx]; return p ? p.x : NaN; };
    const lsx = getX(SHOULDER_LEFT);
    const rsx = getX(SHOULDER_RIGHT);
    const lhx = getX(HIP_LEFT);
    const rhx = getX(HIP_RIGHT);
    if ([lsx, rsx, lhx, rhx].every(Number.isFinite)) {
      const shouldersMid = (lsx + rsx) / 2;
      const hipsMid = (lhx + rhx) / 2;
      centers2.push((shouldersMid + hipsMid) / 2);
    }
  }

  if (allYs.length === 0) {
    return { normalizedFrames: perFrameNorm, crop: { left, right, top, bottom } };
  }

  const globalMinY = Math.min(...allYs);
  const globalMaxY = Math.max(...allYs);

  const centerX2 = (centers2.length > 0) ? (centers2.reduce((a, b) => a + b, 0) / centers2.length) : centerX;

  // final horizontal bounds around centerX2; keep square side equal to max(spanX, spanY)
  const spanX = Math.max(0, maxX - minX);
  const spanY = Math.max(0, maxY - minY);
  const finalSide = Math.max(spanX, spanY, 1e-6);
  let finalLeft = centerX2 - finalSide / 2;
  let finalRight = centerX2 + finalSide / 2;
  if (finalLeft < 0) { finalLeft = 0; finalRight = Math.min(1, finalLeft + finalSide); }
  if (finalRight > 1) { finalRight = 1; finalLeft = Math.max(0, finalRight - finalSide); }

  const finalTop = Math.max(0, Math.min(1, globalMinY));
  const finalBottom = Math.max(0, Math.min(1, globalMaxY));

  // Now remap perFrameNorm coordinates into the final crop box
  const normalizedFrames: NormalizedFrame[] = perFrameNorm.map((frame) => {
    const out: { x: number; y: number }[] = [];
    for (const lm of frame.landmarks) {
      const xNorm = (lm.x - finalLeft) / Math.max(1e-6, (finalRight - finalLeft));
      const yNorm = (lm.y - finalTop) / Math.max(1e-6, (finalBottom - finalTop));
      out.push({ x: clamp(xNorm), y: clamp(yNorm) });
    }
    return { landmarks: out };
  });

  return { normalizedFrames, crop: { left: finalLeft, right: finalRight, top: finalTop, bottom: finalBottom } };
}

/**
 * Convenience: load JSON and compute normalized frames in one call.
 */
export async function loadAndNormalize(uri: string, options?: { inputIsNormalized?: boolean; videoWidth?: number; videoHeight?: number; }) {
  const poses = await loadPoseJson(uri);
  const mergedOptions = { ...options };
  if (!mergedOptions.inputIsNormalized) {
    // if video metadata exists, use it
    if (poses.metadata?.width) mergedOptions.videoWidth = poses.metadata.width;
    if (poses.metadata?.height) mergedOptions.videoHeight = poses.metadata.height;
  }
  return computeCropAndNormalize(poses, mergedOptions);
}

/**
 * Load JSON and perform per-frame square cropping normalization.
 * Returns array of frames normalized inside their own square crop (0..1).
 */
export async function loadAndPerFrameNormalize(uri: string, options?: { inputIsNormalized?: boolean; videoWidth?: number; videoHeight?: number; }) {
  const poses = await loadPoseJson(uri);
  const inputIsNormalized = options?.inputIsNormalized ?? false;
  const vw = options?.videoWidth ?? poses.metadata?.width ?? 1;
  const vh = options?.videoHeight ?? poses.metadata?.height ?? 1;

  const perFrameNorm: NormalizedFrame[] = [];
  for (const frame of poses.frames) {
    const lms = frame.landmarks || [];
    const xs_f: number[] = [];
    const ys_f: number[] = [];
    for (const lm of lms) {
      if (!lm) { xs_f.push(NaN); ys_f.push(NaN); continue; }
      const x = inputIsNormalized ? lm.x : (lm.x ?? 0) / vw;
      const y = inputIsNormalized ? lm.y : (lm.y ?? 0) / vh;
      xs_f.push(x); ys_f.push(y);
    }

    const validXs = xs_f.filter(Number.isFinite);
    const validYs = ys_f.filter(Number.isFinite);
    if (validXs.length === 0 || validYs.length === 0) {
      perFrameNorm.push({ landmarks: lms.map(() => ({ x: 0.5, y: 0.5 })) });
      continue;
    }

    const fMinX = Math.min(...validXs);
    const fMaxX = Math.max(...validXs);
    const fMinY = Math.min(...validYs);
    const fMaxY = Math.max(...validYs);

    const fWidth = fMaxX - fMinX;
    const fHeight = fMaxY - fMinY;
    const side = Math.max(fWidth, fHeight, 1e-6);
    const cx = (fMinX + fMaxX) / 2;
    const cy = (fMinY + fMaxY) / 2;
    let fLeft = cx - side / 2;
    let fTop = cy - side / 2;
    if (fLeft < 0) fLeft = 0;
    if (fTop < 0) fTop = 0;
    if (fLeft + side > 1) fLeft = Math.max(0, 1 - side);
    if (fTop + side > 1) fTop = Math.max(0, 1 - side);

    const outLms: { x: number; y: number }[] = [];
    for (let i = 0; i < lms.length; i++) {
      const lm = lms[i];
      if (!lm) { outLms.push({ x: 0.5, y: 0.5 }); continue; }
      const xRaw = inputIsNormalized ? lm.x : (lm.x ?? 0) / vw;
      const yRaw = inputIsNormalized ? lm.y : (lm.y ?? 0) / vh;
      const xFr = (xRaw - fLeft) / side;
      const yFr = (yRaw - fTop) / side;
      outLms.push({ x: clamp(xFr), y: clamp(yFr) });
    }
    perFrameNorm.push({ landmarks: outLms });
  }

  return perFrameNorm;
}

// ------------------ SEI generation helpers ------------------

function clamp(v: number, a = 0, b = 1) { return Math.max(a, Math.min(b, v)); }

// Draw filled circle with anti-aliasing (value 0-255 based on distance)
function drawFilledCircle(mask: Uint8Array, w: number, h: number, cx: number, cy: number, r: number, value = 255) {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
  
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= r) {
        // Fully inside - max value
        const idx = y * w + x;
        mask[idx] = Math.max(mask[idx], value);
      } else if (dist <= r + 1) {
        // Anti-alias edge - partial value
        const alpha = 1 - (dist - r);
        const idx = y * w + x;
        mask[idx] = Math.max(mask[idx], Math.round(value * alpha));
      }
    }
  }
}

// Anti-aliased line drawing (similar to OpenCV's cv2.line with anti-aliasing)
function drawLine(mask: Uint8Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number, thickness: number, value = 255) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length < 0.5) {
    drawFilledCircle(mask, w, h, x0, y0, thickness / 2, value);
    return;
  }
  
  const stepX = dx / length;
  const stepY = dy / length;
  const radius = thickness / 2;
  
  // Draw circles along the line for smooth thick lines
  const steps = Math.ceil(length);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    drawFilledCircle(mask, w, h, px, py, radius, value);
  }
}

/**
 * Rasterize a single frame into a binary mask (Uint8Array) of size `size` x `size`.
 * - landmarks are expected normalized 0..1 in crop space
 * - connections is optional array of [i,j] pairs to draw lines
 */
export function rasterizeFrame(frame: NormalizedFrame, size = 224, options?: { connections?: number[][]; lineThickness?: number; jointRadius?: number; }): Uint8Array {
  const w = size, h = size;
  const mask = new Uint8Array(w * h);
  const connections = options?.connections;
  const lineThickness = options?.lineThickness ?? 3;
  const jointRadius = options?.jointRadius ?? 3;

  // draw connections first
  if (connections && connections.length > 0) {
    for (const [a, b] of connections) {
      const A = frame.landmarks[a];
      const B = frame.landmarks[b];
      if (!A || !B) continue;
      const x0 = Math.round(clamp(A.x) * (w - 1));
      const y0 = Math.round(clamp(A.y) * (h - 1));
      const x1 = Math.round(clamp(B.x) * (w - 1));
      const y1 = Math.round(clamp(B.y) * (h - 1));
      drawLine(mask, w, h, x0, y0, x1, y1, lineThickness);
    }
  }

  // draw joints
  for (const lm of frame.landmarks) {
    if (!lm) continue;
    const cx = Math.round(clamp(lm.x) * (w - 1));
    const cy = Math.round(clamp(lm.y) * (h - 1));
    drawFilledCircle(mask, w, h, cx, cy, jointRadius);
  }

  return mask;
}

/**
 * 1D Gaussian filter for temporal smoothing (like scipy.ndimage.gaussian_filter1d)
 */
function gaussianFilter1D(data: number[], sigma: number): number[] {
  if (sigma <= 0 || data.length < 2) return [...data];
  
  // Build Gaussian kernel
  const radius = Math.ceil(sigma * 3);
  const kernelSize = 2 * radius + 1;
  const kernel: number[] = [];
  let sum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - radius;
    const val = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(val);
    sum += val;
  }
  // Normalize kernel
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  // Apply convolution with edge handling (reflect mode)
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    let weighted = 0;
    for (let j = 0; j < kernelSize; j++) {
      let idx = i + j - radius;
      // Reflect boundary
      if (idx < 0) idx = -idx;
      if (idx >= data.length) idx = 2 * data.length - idx - 2;
      idx = Math.max(0, Math.min(data.length - 1, idx));
      weighted += data[idx] * kernel[j];
    }
    result.push(weighted);
  }
  return result;
}

/**
 * Generate SEI by rasterizing each frame's skeleton silhouette and averaging the masks.
 * Saves an SVG (pixel-rects) to the app document directory and returns { svg, path }.
 *
 * options:
 *  - size: output size (default 224)
 *  - connections: optional array of [i,j] indices to draw lines
 *  - lineThickness, jointRadius
 *  - smoothSigma: temporal smoothing sigma (default 0.1, like Python)
 */
export async function generateSeiFromPoseJson(jsonUri: string, outBaseName?: string, options?: { size?: number; connections?: number[][]; lineThickness?: number; jointRadius?: number; smoothSigma?: number; }) {
  // Follow Python blazepose_skeleton.py logic per-frame: draw smoothed skeletons scaled by vertical span and centered
  const size = options?.size ?? 224;
  const lineThickness = options?.lineThickness ?? 6; // Increased from 3 for more brightness
  const jointRadius = options?.jointRadius ?? 6; // Increased from 3 for more visibility
  const smoothSigma = options?.smoothSigma ?? 0.1;

  const poses = await loadPoseJson(jsonUri);
  const vw = poses.metadata?.width ?? 1;
  const vh = poses.metadata?.height ?? 1;

  if (!poses.frames || poses.frames.length === 0) throw new Error('No frames to generate SEI');

  // === First pass: collect all keypoints in pixel coordinates ===
  const POSE_LANDMARKS = 33;
  const allKeypoints: (([number, number] | null)[])[] = [];

  for (const frame of poses.frames) {
    const lms = frame.landmarks || [];
    const kp: ([number, number] | null)[] = [];
    for (let i = 0; i < POSE_LANDMARKS; i++) {
      const lm = lms[i];
      if (!lm || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) {
        kp.push(null);
      } else {
        kp.push([lm.x * vw, lm.y * vh]);
      }
    }
    allKeypoints.push(kp);
  }

  // === Temporal smoothing: apply Gaussian filter across time for each joint ===
  // Build a 3D structure: [frames][joints][x/y]
  const numFrames = allKeypoints.length;
  const smoothedKeypoints: (([number, number] | null)[])[] = [];

  for (let j = 0; j < POSE_LANDMARKS; j++) {
    const xValues: number[] = [];
    const yValues: number[] = [];
    const validIndices: number[] = [];

    // Collect valid values for this joint across all frames
    for (let f = 0; f < numFrames; f++) {
      const pt = allKeypoints[f][j];
      if (pt) {
        xValues.push(pt[0]);
        yValues.push(pt[1]);
        validIndices.push(f);
      }
    }

    // Apply smoothing if we have valid points
    let smoothedX: number[] = [];
    let smoothedY: number[] = [];
    if (validIndices.length > 1) {
      smoothedX = gaussianFilter1D(xValues, smoothSigma);
      smoothedY = gaussianFilter1D(yValues, smoothSigma);
    } else {
      smoothedX = xValues;
      smoothedY = yValues;
    }

    // Write back smoothed values
    for (let i = 0; i < validIndices.length; i++) {
      const frameIdx = validIndices[i];
      if (!smoothedKeypoints[frameIdx]) {
        smoothedKeypoints[frameIdx] = new Array(POSE_LANDMARKS).fill(null);
      }
      smoothedKeypoints[frameIdx][j] = [smoothedX[i], smoothedY[i]];
    }
  }

  // Fill in missing frames with nulls
  for (let f = 0; f < numFrames; f++) {
    if (!smoothedKeypoints[f]) {
      smoothedKeypoints[f] = new Array(POSE_LANDMARKS).fill(null);
    }
  }

  const accum = new Float32Array(size * size);
  let framesUsed = 0;

  // We'll build per-frame connections that mirror the Python
  // blazepose_skeleton.py CUSTOM_CONNECTIONS.  After appending
  // torso_top and torso_bottom to the keypoints array, their
  // indices are TORSO_TOP_IDX and TORSO_BOTTOM_IDX and can be
  // used directly in the connections list.

  // === Second pass: process smoothed keypoints ===
  for (const kp of smoothedKeypoints) {

    // compute torso midpoints
    const left_sh = kp[11];
    const right_sh = kp[12];
    const left_hip = kp[23];
    const right_hip = kp[24];
    if (!left_sh || !right_sh || !left_hip || !right_hip) continue;

    const torso_top: [number, number] = [(left_sh[0] + right_sh[0]) / 2, (left_sh[1] + right_sh[1]) / 2];
    const torso_bottom: [number, number] = [(left_hip[0] + right_hip[0]) / 2, (left_hip[1] + right_hip[1]) / 2];

    const custom: ([number, number] | null)[] = [...kp, torso_top, torso_bottom];
    const TORSO_TOP_IDX = custom.length - 2;
    const TORSO_BOTTOM_IDX = custom.length - 1;

    // compute vertical span in pixel coords
    const y_coords = custom.map(p => p ? p[1] : NaN).filter(Number.isFinite);
    if (y_coords.length === 0) continue;
    const min_y = Math.min(...y_coords);
    const max_y = Math.max(...y_coords);
    const height = max_y - min_y;
    if (height < 1) continue;

    const padding_ratio = 0.95;
    const scale = (size * padding_ratio) / height;

    // scale all points
    for (let i = 0; i < custom.length; i++) {
      if (!custom[i]) continue;
      custom[i] = [custom[i]![0] * scale, custom[i]![1] * scale];
    }

    // horizontal centering: compute torso midpoint (in scaled coords) and shift horizontally so midpoint.x -> image center.x
    const torso_top_pt = custom[TORSO_TOP_IDX] as [number, number];
    const torso_bottom_pt = custom[TORSO_BOTTOM_IDX] as [number, number];
    const torso_midpoint_x = (torso_top_pt[0] + torso_bottom_pt[0]) / 2;

    const image_center_x = size / 2;
    const dx = image_center_x - torso_midpoint_x;

    // vertical placement: map the frame's min_y -> top padding so vertical cropping uses min/max keypoints
    const scaled_min_y = min_y * scale;
    const scaled_height = height * scale;
    const top_padding = (size - scaled_height) / 2; // center vertically within padding area
    const dy = top_padding - scaled_min_y;

    for (let i = 0; i < custom.length; i++) {
      if (!custom[i]) continue;
      custom[i] = [ (custom[i] as [number, number])[0] + dx, (custom[i] as [number, number])[1] + dy ];
    }

    // draw on canvas
    const mask = new Uint8Array(size * size);
    // draw connections using the same list as the Python implementation
    const CUSTOM_CONNECTIONS_FRAME: [number, number][] = [
      // torso top <-> torso bottom
      [TORSO_TOP_IDX, TORSO_BOTTOM_IDX],
      // nose to torso_top
      [0, TORSO_TOP_IDX],
      // shoulders to torso_top
      [11, TORSO_TOP_IDX],
      [12, TORSO_TOP_IDX],
      // hips to torso_bottom
      [23, TORSO_BOTTOM_IDX],
      [24, TORSO_BOTTOM_IDX],
      // arms
      [11, 13], [13, 15], [12, 14], [14, 16],
      // legs
      [23, 25], [25, 27], [27, 31], [24, 26], [26, 28], [28, 32],
      // eyes
      [0, 1], [0, 2]
    ];

    for (const [start, end] of CUSTOM_CONNECTIONS_FRAME) {
      if (start < 0 || end < 0 || start >= custom.length || end >= custom.length) continue;
      const A = custom[start];
      const B = custom[end];
      if (!A || !B) continue;
      const x0 = Math.round((A as [number, number])[0]);
      const y0 = Math.round((A as [number, number])[1]);
      const x1 = Math.round((B as [number, number])[0]);
      const y1 = Math.round((B as [number, number])[1]);
      drawLine(mask, size, size, x0, y0, x1, y1, lineThickness);
    }
    // No joint circles - lines with rounded caps are sufficient (like cv2.line in Python)

    // accumulate
    for (let i = 0; i < mask.length; i++) accum[i] += mask[i];
    framesUsed += 1;
  }

  if (framesUsed === 0) throw new Error('No valid frames rasterized');

  // average (values are already 0-255, so just divide by frame count)
  const pixels = new Uint8Array(size * size);
  for (let i = 0; i < accum.length; i++) {
    const v = accum[i] / framesUsed; // average value (0-255)
    pixels[i] = Math.round(clamp(v, 0, 255));
  }

  // Encode to PNG first (in memory)
  console.log('Encoding PNG:', size, 'x', size, 'pixels');
  const pngBase64 = encodePNG(pixels, size, size);
  console.log('PNG base64 length:', pngBase64.length);

  // save PNG to temp file first
  const baseName = outBaseName ?? 'sei';
  const seisDir = `${FileSystem.documentDirectory}seis`;
  await FileSystem.makeDirectoryAsync(seisDir, { intermediates: true });
  const tempPngFile = `${seisDir}/${baseName}_sei_temp.png`;
  await FileSystem.writeAsStringAsync(tempPngFile, pngBase64, { encoding: FileSystem.EncodingType.Base64 });

  // Convert to JPEG using ImageManipulator
  console.log('Converting PNG to JPEG...');
  const result = await ImageManipulator.manipulateAsync(
    tempPngFile,
    [], // no manipulations, just conversion
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Delete temp PNG file
  await FileSystem.deleteAsync(tempPngFile, { idempotent: true });

  // Read JPEG as base64
  const jpegBase64 = await FileSystem.readAsStringAsync(result.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Save JPEG with proper extension
  const outputFile = `${seisDir}/${baseName}_sei.jpg`;
  await FileSystem.writeAsStringAsync(outputFile, jpegBase64, { encoding: FileSystem.EncodingType.Base64 });

  return { png: jpegBase64, path: outputFile };
}


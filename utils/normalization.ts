/**
 * Per-Video Normalization Utilities
 * Matches the exact normalization strategy from Python training code
 *
 * Strategy:
 * - Subtract mean to center at origin (per feature)
 * - Divide by std to normalize scale (per feature)
 * - Applied per video, NOT globally
 */

export interface NormalizationStats {
  mean: number[];
  std: number[];
}

/**
 * Calculate mean and standard deviation for each feature
 * @param features - Array of shape [num_frames, num_features]
 * @returns Object with mean and std arrays
 */
export function calculateNormalizationStats(
  features: number[][]
): NormalizationStats {
  if (!features || features.length === 0) {
    throw new Error("Cannot calculate stats from empty features");
  }

  const numFrames = features.length;
  const numFeatures = features[0].length;

  // Initialize arrays
  const mean = new Array(numFeatures).fill(0);
  const std = new Array(numFeatures).fill(0);

  // Calculate mean for each feature
  for (let featureIdx = 0; featureIdx < numFeatures; featureIdx++) {
    let sum = 0;
    for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
      sum += features[frameIdx][featureIdx];
    }
    mean[featureIdx] = sum / numFrames;
  }

  // Calculate standard deviation for each feature
  for (let featureIdx = 0; featureIdx < numFeatures; featureIdx++) {
    let sumSquaredDiff = 0;
    for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
      const diff = features[frameIdx][featureIdx] - mean[featureIdx];
      sumSquaredDiff += diff * diff;
    }
    std[featureIdx] = Math.sqrt(sumSquaredDiff / numFrames);

    // Avoid division by zero (match Python: std[std == 0] = 1.0)
    if (std[featureIdx] === 0) {
      std[featureIdx] = 1.0;
    }
  }

  return { mean, std };
}

/**
 * Normalize features using provided mean and std
 * Formula: normalized = (features - mean) / std
 *
 * @param features - Array of shape [num_frames, num_features]
 * @param stats - Normalization statistics (mean and std)
 * @returns Normalized features array
 */
export function normalizeFeatures(
  features: number[][],
  stats: NormalizationStats
): number[][] {
  const numFrames = features.length;
  const numFeatures = features[0].length;

  if (stats.mean.length !== numFeatures || stats.std.length !== numFeatures) {
    throw new Error(
      `Stats dimension mismatch: expected ${numFeatures} features, got mean=${stats.mean.length}, std=${stats.std.length}`
    );
  }

  // Create normalized copy
  const normalized: number[][] = [];

  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const normalizedFrame: number[] = [];
    for (let featureIdx = 0; featureIdx < numFeatures; featureIdx++) {
      const value = features[frameIdx][featureIdx];
      const normalizedValue =
        (value - stats.mean[featureIdx]) / stats.std[featureIdx];
      normalizedFrame.push(normalizedValue);
    }
    normalized.push(normalizedFrame);
  }

  return normalized;
}

/**
 * Normalize features by calculating stats from the same data
 * This is the standard approach for per-video normalization
 *
 * @param features - Array of shape [num_frames, num_features]
 * @returns Object with normalized features and stats
 */
export function normalizeWithStats(features: number[][]): {
  normalized: number[][];
  stats: NormalizationStats;
} {
  const stats = calculateNormalizationStats(features);
  const normalized = normalizeFeatures(features, stats);
  return { normalized, stats };
}

/**
 * Denormalize features (for debugging/visualization)
 * Formula: original = (normalized * std) + mean
 *
 * @param normalized - Normalized features
 * @param stats - Original normalization statistics
 * @returns Denormalized features
 */
export function denormalizeFeatures(
  normalized: number[][],
  stats: NormalizationStats
): number[][] {
  const numFrames = normalized.length;
  const numFeatures = normalized[0].length;

  const denormalized: number[][] = [];

  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const denormalizedFrame: number[] = [];
    for (let featureIdx = 0; featureIdx < numFeatures; featureIdx++) {
      const normalizedValue = normalized[frameIdx][featureIdx];
      const originalValue =
        normalizedValue * stats.std[featureIdx] + stats.mean[featureIdx];
      denormalizedFrame.push(originalValue);
    }
    denormalized.push(denormalizedFrame);
  }

  return denormalized;
}

/**
 * Create sliding windows from normalized sequence
 * Matches Python: create_sliding_windows(features, window_size=60, overlap=0.5)
 *
 * @param features - Normalized features [num_frames, num_features]
 * @param windowSize - Number of frames per window (default: 60)
 * @param overlap - Overlap ratio 0.0 to 1.0 (default: 0.5)
 * @returns Array of windows [num_windows, window_size, num_features]
 */
export function createSlidingWindows(
  features: number[][],
  windowSize: number = 60,
  overlap: number = 0.5
): number[][][] {
  const numFrames = features.length;
  const numFeatures = features[0].length;

  if (numFrames < windowSize) {
    throw new Error(
      `Not enough frames for windowing: need ${windowSize}, got ${numFrames}`
    );
  }

  const stepSize = Math.floor(windowSize * (1 - overlap));
  const windows: number[][][] = [];

  for (
    let startIdx = 0;
    startIdx <= numFrames - windowSize;
    startIdx += stepSize
  ) {
    const window = features.slice(startIdx, startIdx + windowSize);
    windows.push(window);
  }

  return windows;
}

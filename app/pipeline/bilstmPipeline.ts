import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";
import { bundleResourceIO } from "@tensorflow/tfjs-react-native";

/**
 * BiLSTM Autoencoder Pipeline for Gait Anomaly Detection
 *
 * This model is an AUTOENCODER (not a classifier):
 * - Trained ONLY on normal gait patterns
 * - Reconstructs input sequences
 * - Abnormal gaits → High reconstruction error
 * - Normal gaits → Low reconstruction error
 */

// Landmark indices for MediaPipe Pose (33 landmarks)
const LANDMARK_INDICES = {
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

// Load normalization statistics (CRITICAL: from training data)
const NORMALIZATION_STATS = require("../../assets/models/bilstm/normalization_stats.json");

// Model configuration (matches Python training)
const CONFIG = {
  SEQUENCE_LENGTH: 60, // 60 frames per window
  NUM_FEATURES: 16, // 8 landmarks × 2 coordinates (x, y)
  OVERLAP: 0.5, // 50% overlap for sliding windows
  THRESHOLD: 0.1768068329674364, // Anomaly detection threshold (from bilstm_autoencoder_20251120_235321_threshold.json)
  // Training data statistics for normalization
  FEATURE_MEAN: NORMALIZATION_STATS.mean,
  FEATURE_STD: NORMALIZATION_STATS.std,
};

let model: tf.LayersModel | null = null;
let isModelLoaded = false;

/**
 * Initialize BiLSTM model
 */
export async function initializeBiLSTMModel(): Promise<void> {
  console.log("[BiLSTM] Initializing TensorFlow.js...");

  try {
    await tf.ready();
    console.log("[BiLSTM] TensorFlow.js backend:", tf.getBackend());

    console.log("[BiLSTM] Loading BiLSTM autoencoder model...");

    // Load model from bundled assets
    const modelJson = require("../../assets/models/bilstm/model.json");
    const modelWeights = require("../../assets/models/bilstm/group1-shard1of1.bin");

    model = await tf.loadLayersModel(
      bundleResourceIO(modelJson, [modelWeights])
    );

    isModelLoaded = true;
    console.log("[BiLSTM] ✅ Model loaded successfully");
    console.log("[BiLSTM] Input shape:", model.inputs[0].shape);
    console.log("[BiLSTM] Output shape:", model.outputs[0].shape);
    console.log("[BiLSTM] Threshold:", CONFIG.THRESHOLD);

    // Warm up model
    console.log("[BiLSTM] Warming up model...");
    const dummyInput = tf.zeros([
      1,
      CONFIG.SEQUENCE_LENGTH,
      CONFIG.NUM_FEATURES,
    ]);
    const warmupPred = model.predict(dummyInput) as tf.Tensor;
    await warmupPred.data();
    dummyInput.dispose();
    warmupPred.dispose();
    console.log("[BiLSTM] ✅ Model warmed up");
  } catch (error: any) {
    console.error("[BiLSTM] ❌ Failed to load model:", error);
    throw new Error(`Failed to load BiLSTM model: ${error.message}`);
  }
}

/**
 * Extract 8 landmarks (16 features) from pose JSON
 * Matches Python feature extraction order
 */
export function extractBiLSTMFeatures(poseJsonData: any): number[][] {
  console.log("[BiLSTM] Extracting features from pose data...");

  const frames = poseJsonData.frames;
  if (!frames || frames.length === 0) {
    throw new Error("No frames found in pose data");
  }

  const features: number[][] = [];

  for (const frame of frames) {
    const landmarks = frame.landmarks;
    if (!landmarks || landmarks.length < 33) {
      // Missing landmarks - fill with NaN for interpolation
      features.push(new Array(CONFIG.NUM_FEATURES).fill(NaN));
      continue;
    }

    // Extract 8 landmarks in the same order as Python training
    const frameFeatures = [
      landmarks[LANDMARK_INDICES.LEFT_HIP].x,
      landmarks[LANDMARK_INDICES.LEFT_HIP].y,
      landmarks[LANDMARK_INDICES.RIGHT_HIP].x,
      landmarks[LANDMARK_INDICES.RIGHT_HIP].y,
      landmarks[LANDMARK_INDICES.LEFT_KNEE].x,
      landmarks[LANDMARK_INDICES.LEFT_KNEE].y,
      landmarks[LANDMARK_INDICES.RIGHT_KNEE].x,
      landmarks[LANDMARK_INDICES.RIGHT_KNEE].y,
      landmarks[LANDMARK_INDICES.LEFT_ANKLE].x,
      landmarks[LANDMARK_INDICES.LEFT_ANKLE].y,
      landmarks[LANDMARK_INDICES.RIGHT_ANKLE].x,
      landmarks[LANDMARK_INDICES.RIGHT_ANKLE].y,
      landmarks[LANDMARK_INDICES.LEFT_FOOT_INDEX].x,
      landmarks[LANDMARK_INDICES.LEFT_FOOT_INDEX].y,
      landmarks[LANDMARK_INDICES.RIGHT_FOOT_INDEX].x,
      landmarks[LANDMARK_INDICES.RIGHT_FOOT_INDEX].y,
    ];

    features.push(frameFeatures);
  }

  console.log(
    `[BiLSTM] Extracted ${features.length} frames with ${CONFIG.NUM_FEATURES} features`
  );

  return features;
}

/**
 * Interpolate NaN values (missing landmarks)
 */
function interpolateNaN(arr: number[]): number[] {
  const result = [...arr];
  const nanIndices: number[] = [];
  const validIndices: number[] = [];

  for (let i = 0; i < result.length; i++) {
    if (isNaN(result[i])) {
      nanIndices.push(i);
    } else {
      validIndices.push(i);
    }
  }

  // If all NaN, return zeros
  if (validIndices.length === 0) {
    return new Array(arr.length).fill(0);
  }

  // Linear interpolation for NaN values
  for (const nanIdx of nanIndices) {
    // Find nearest valid indices
    const before = validIndices.filter((i) => i < nanIdx).slice(-1)[0];
    const after = validIndices.filter((i) => i > nanIdx)[0];

    if (before !== undefined && after !== undefined) {
      // Interpolate between before and after
      const t = (nanIdx - before) / (after - before);
      result[nanIdx] = result[before] * (1 - t) + result[after] * t;
    } else if (before !== undefined) {
      // Use last valid value
      result[nanIdx] = result[before];
    } else if (after !== undefined) {
      // Use next valid value
      result[nanIdx] = result[after];
    }
  }

  return result;
}

/**
 * Smooth signal using convolution (moving average)
 */
function smoothSignal(signal: number[], windowSize: number = 5): number[] {
  if (signal.length < windowSize) {
    return signal;
  }

  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;

    for (let j = -halfWindow; j <= halfWindow; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < signal.length) {
        sum += signal[idx];
        count++;
      }
    }

    result.push(sum / count);
  }

  return result;
}

/**
 * Preprocess features (interpolate + smooth)
 * Matches Python preprocessing
 */
function preprocessFeatures(features: number[][]): number[][] {
  console.log("[BiLSTM] Preprocessing features...");

  // Transpose: frames × features → features × frames
  const numFrames = features.length;
  const numFeatures = CONFIG.NUM_FEATURES;
  const transposed: number[][] = [];

  for (let f = 0; f < numFeatures; f++) {
    const featureColumn: number[] = [];
    for (let t = 0; t < numFrames; t++) {
      featureColumn.push(features[t][f]);
    }
    transposed.push(featureColumn);
  }

  // Interpolate and smooth each feature
  const processed: number[][] = transposed.map((featureColumn) => {
    const interpolated = interpolateNaN(featureColumn);
    const smoothed = smoothSignal(interpolated, 5);
    return smoothed;
  });

  // Transpose back: features × frames → frames × features
  const result: number[][] = [];
  for (let t = 0; t < numFrames; t++) {
    const frame: number[] = [];
    for (let f = 0; f < numFeatures; f++) {
      frame.push(processed[f][t]);
    }
    result.push(frame);
  }

  return result;
}

/**
 * Normalize features using TRAINING DATA statistics
 * CRITICAL: Must use same normalization as training, not per-video stats!
 */
function normalizeFeatures(features: number[][]): number[][] {
  const numFrames = features.length;
  const numFeatures = CONFIG.NUM_FEATURES;

  // Use training data statistics (loaded from normalization_stats.json)
  const mean = CONFIG.FEATURE_MEAN;
  const std = CONFIG.FEATURE_STD;

  console.log("[BiLSTM] Normalizing with training statistics:");
  console.log(
    `  Mean: [${mean
      .slice(0, 3)
      .map((v: number) => v.toFixed(4))
      .join(", ")}...]`
  );
  console.log(
    `  Std: [${std
      .slice(0, 3)
      .map((v: number) => v.toFixed(4))
      .join(", ")}...]`
  );

  // Normalize using training statistics
  const normalized: number[][] = [];
  for (let t = 0; t < numFrames; t++) {
    const frame: number[] = [];
    for (let f = 0; f < numFeatures; f++) {
      frame.push((features[t][f] - mean[f]) / std[f]);
    }
    normalized.push(frame);
  }

  return normalized;
}

/**
 * Create sliding windows from features
 */
function createSlidingWindows(features: number[][]): number[][][] {
  const numFrames = features.length;
  const windowSize = CONFIG.SEQUENCE_LENGTH;
  const stepSize = Math.floor(windowSize * (1 - CONFIG.OVERLAP));

  const windows: number[][][] = [];

  for (let start = 0; start <= numFrames - windowSize; start += stepSize) {
    const window = features.slice(start, start + windowSize);
    windows.push(window);
  }

  console.log(
    `[BiLSTM] Created ${windows.length} windows (${windowSize} frames, ${
      CONFIG.OVERLAP * 100
    }% overlap)`
  );

  return windows;
}

/**
 * Run BiLSTM anomaly detection on pose data
 *
 * Returns:
 * - isAbnormal: Boolean indicating if gait is abnormal
 * - meanError: Mean reconstruction error across all windows
 * - maxError: Maximum reconstruction error
 * - numWindows: Number of windows analyzed
 * - threshold: Detection threshold used
 */
export async function detectGaitAnomaly(poseJsonPath: string): Promise<{
  isAbnormal: boolean;
  meanError: number;
  maxError: number;
  numWindows: number;
  threshold: number;
  confidence: number;
}> {
  if (!isModelLoaded || !model) {
    throw new Error(
      "BiLSTM model not loaded. Call initializeBiLSTMModel() first."
    );
  }

  console.log("[BiLSTM] Starting gait anomaly detection...");
  const startTime = Date.now();

  try {
    // Load pose JSON
    const FileSystem = require("expo-file-system/legacy");
    const poseJsonContent = await FileSystem.readAsStringAsync(poseJsonPath);
    const poseJsonData = JSON.parse(poseJsonContent);

    // Step 1: Extract features (8 landmarks × 2 coords = 16 features)
    let features = extractBiLSTMFeatures(poseJsonData);

    // Step 2: Preprocess (interpolate + smooth)
    features = preprocessFeatures(features);

    // Step 3: Normalize features using TRAINING statistics
    const normalized = normalizeFeatures(features);

    // Step 4: Create sliding windows
    const windows = createSlidingWindows(normalized);

    if (windows.length === 0) {
      throw new Error(
        `Video too short. Need at least ${CONFIG.SEQUENCE_LENGTH} frames, got ${features.length}`
      );
    }

    // Step 5: Convert to tensor
    const inputTensor = tf.tensor3d(windows); // Shape: [numWindows, 60, 16]

    console.log(`[BiLSTM] Input tensor shape: ${inputTensor.shape}`);

    // Step 6: Run inference (reconstruction)
    const reconstructionTensor = model.predict(inputTensor) as tf.Tensor;

    // Step 7: Calculate reconstruction errors for each window
    const errorTensor = tf.square(tf.sub(inputTensor, reconstructionTensor));
    const windowErrors = await tf.mean(errorTensor, [1, 2]).data(); // Mean per window

    // Cleanup tensors
    inputTensor.dispose();
    reconstructionTensor.dispose();
    errorTensor.dispose();

    // Step 8: Calculate statistics
    const meanError =
      Array.from(windowErrors).reduce((a, b) => a + b, 0) / windowErrors.length;
    const maxError = Math.max(...Array.from(windowErrors));

    // Step 9: Classify (abnormal if ANY window exceeds threshold)
    const isAbnormal = maxError >= CONFIG.THRESHOLD;

    // Calculate confidence based on distance from threshold
    // For normal gait: confidence increases as error decreases below threshold
    // For abnormal gait: confidence increases as error increases above threshold
    let confidence: number;
    if (isAbnormal) {
      // Abnormal: confidence = how much we exceeded threshold (as percentage)
      const excessRatio = (maxError - CONFIG.THRESHOLD) / CONFIG.THRESHOLD;
      confidence = Math.min(100, 50 + excessRatio * 50); // 50-100%
    } else {
      // Normal: confidence = how far below threshold (as percentage)
      const safetyRatio = (CONFIG.THRESHOLD - maxError) / CONFIG.THRESHOLD;
      confidence = Math.min(100, 50 + safetyRatio * 50); // 50-100%
    }

    const elapsed = Date.now() - startTime;
    console.log(`[BiLSTM] ✅ Detection complete in ${elapsed}ms`);
    console.log(`[BiLSTM] Mean error: ${meanError.toFixed(6)}`);
    console.log(`[BiLSTM] Max error: ${maxError.toFixed(6)}`);
    console.log(`[BiLSTM] Threshold: ${CONFIG.THRESHOLD.toFixed(6)}`);
    console.log(`[BiLSTM] Result: ${isAbnormal ? "ABNORMAL" : "NORMAL"}`);

    return {
      isAbnormal,
      meanError,
      maxError,
      numWindows: windows.length,
      threshold: CONFIG.THRESHOLD,
      confidence,
    };
  } catch (error: any) {
    console.error("[BiLSTM] ❌ Detection failed:", error);
    throw new Error(`BiLSTM detection failed: ${error.message}`);
  }
}

/**
 * Get model info
 */
export function getBiLSTMModelInfo() {
  return {
    isLoaded: isModelLoaded,
    backend: tf.getBackend(),
    config: CONFIG,
    modelShape: model
      ? {
          input: model.inputs[0].shape,
          output: model.outputs[0].shape,
        }
      : null,
  };
}

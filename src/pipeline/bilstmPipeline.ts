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

// Model configuration (matches Python training)
const CONFIG = {
  SEQUENCE_LENGTH: 60, // 60 frames per window
  NUM_FEATURES: 16, // 8 landmarks × 2 coordinates (x, y)
  OVERLAP: 0.5, // 50% overlap for sliding windows
  GLOBAL_THRESHOLD: 0.1768068329674364, // Global threshold (legacy, for backward compatibility)
  // Per-joint thresholds (to be updated with empirically computed values)
  JOINT_THRESHOLDS: {
    LEFT_HIP: 0.5543604445155327,
    RIGHT_HIP: 0.6172293541221003,
    LEFT_KNEE: 0.5403470171983461,
    RIGHT_KNEE: 0.5625000450807769,
    LEFT_ANKLE: 0.5979195635077637,
    RIGHT_ANKLE: 0.6394362561662352,
    LEFT_FOOT_INDEX: 0.5445324308178958,
    RIGHT_FOOT_INDEX: 0.6486219410648343,
  },
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
    console.log("[BiLSTM] Global Threshold:", CONFIG.GLOBAL_THRESHOLD);
    console.log("[BiLSTM] Per-joint thresholds configured");

    // Warm up model
    console.log("\n[BiLSTM] Warming up model...");
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

  // If all NaN, return as-is (matches Python behavior)
  if (validIndices.length === 0) {
    return result;
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
 * Normalize features using PER-VIDEO z-score normalization
 * CRITICAL: Must match Python training - each video normalized independently!
 * 
 * Python equivalent:
 *   mean = np.mean(features, axis=0)
 *   std = np.std(features, axis=0)
 *   normalized = (features - mean) / std
 */
function normalizeFeatures(features: number[][]): number[][] {
  const numFrames = features.length;
  const numFeatures = CONFIG.NUM_FEATURES;

  // Calculate mean for each feature across all frames
  const mean: number[] = new Array(numFeatures).fill(0);
  for (let t = 0; t < numFrames; t++) {
    for (let f = 0; f < numFeatures; f++) {
      mean[f] += features[t][f];
    }
  }
  for (let f = 0; f < numFeatures; f++) {
    mean[f] /= numFrames;
  }

  // Calculate standard deviation for each feature
  const std: number[] = new Array(numFeatures).fill(0);
  for (let t = 0; t < numFrames; t++) {
    for (let f = 0; f < numFeatures; f++) {
      const diff = features[t][f] - mean[f];
      std[f] += diff * diff;
    }
  }
  for (let f = 0; f < numFeatures; f++) {
    std[f] = Math.sqrt(std[f] / numFrames);
    // Avoid division by zero
    if (std[f] === 0 || isNaN(std[f])) {
      std[f] = 1.0;
    }
  }

  // Z-score normalization: (value - mean) / std
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
 * - jointErrors: Per-joint error analysis
 */
export async function detectGaitAnomaly(poseJsonPath: string): Promise<{
  isAbnormal: boolean;
  meanError: number;
  maxError: number;
  numWindows: number;
  globalThreshold: number;
  confidence: number;
  jointErrors: Array<{
    joint: string;
    error: number;
    isAbnormal: boolean;
    threshold: number;
    xError: number;
    yError: number;
  }>;
  worstJoint: string;
  worstJointError: number;
  abnormalJointCount: number;
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

    // Step 3: Normalize features using PER-VIDEO z-score normalization
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

    // Step 6: Run inference (reconstruction)
    const reconstructionTensor = model.predict(inputTensor) as tf.Tensor;

    // Step 7: Calculate reconstruction errors for each window
    const errorTensor = tf.square(tf.sub(inputTensor, reconstructionTensor));
    const windowErrors = await tf.mean(errorTensor, [1, 2]).data(); // Mean per window

    // Step 7b: Calculate per-feature errors (averaged across windows and time)
    const featureErrorsTensor = tf.mean(errorTensor, [0, 1]); // [16]
    const featureErrors = await featureErrorsTensor.data();
    featureErrorsTensor.dispose();

    // Convert 16 features → 8 joint errors (average x,y for each joint)
    const jointNames = [
      'LEFT_HIP',
      'RIGHT_HIP',
      'LEFT_KNEE',
      'RIGHT_KNEE',
      'LEFT_ANKLE',
      'RIGHT_ANKLE',
      'LEFT_FOOT_INDEX',
      'RIGHT_FOOT_INDEX',
    ];

    const jointErrorsArray = [];
    for (let i = 0; i < 8; i++) {
      const jointName = jointNames[i] as keyof typeof CONFIG.JOINT_THRESHOLDS;
      const jointThreshold = CONFIG.JOINT_THRESHOLDS[jointName];
      const xError = featureErrors[i * 2]; // x coordinate error
      const yError = featureErrors[i * 2 + 1]; // y coordinate error
      const avgError = (xError + yError) / 2; // Average x,y error for this joint

      jointErrorsArray.push({
        joint: jointName,
        error: avgError,
        isAbnormal: avgError >= jointThreshold,
        threshold: jointThreshold,
        xError: xError,
        yError: yError,
      });
    }

    // Sort by error (descending) to identify worst joints
    jointErrorsArray.sort((a, b) => b.error - a.error);
    
    // Filter out hip joints for pattern analysis (only use lower limb joints)
    const lowerLimbJoints = jointErrorsArray.filter(
      j => j.joint !== 'LEFT_HIP' && j.joint !== 'RIGHT_HIP'
    );
    
    // Count abnormal joints (excluding hips)
    const abnormalJointCount = lowerLimbJoints.filter(j => j.isAbnormal).length;

    // Step 8: Calculate statistics
    const meanError =
      Array.from(windowErrors).reduce((a, b) => a + b, 0) / windowErrors.length;
    const maxError = Math.max(...Array.from(windowErrors));

    // Step 9: Classify based on per-joint thresholds (excluding hips)
    // Overall gait is abnormal if ANY lower limb joint exceeds its specific threshold
    const isAbnormal = abnormalJointCount > 0;

    // Calculate confidence based on worst lower limb joint's distance from its threshold
    // This provides more clinically relevant confidence than global mean
    let confidence: number;
    const worstLowerLimbJoint = lowerLimbJoints[0];
    if (isAbnormal) {
      // Abnormal: confidence based on how much worst joint exceeded its threshold
      const worstJointThreshold = worstLowerLimbJoint.threshold;
      const excessRatio = (worstLowerLimbJoint.error - worstJointThreshold) / worstJointThreshold;
      confidence = Math.min(100, 50 + excessRatio * 50); // 50-100%
    } else {
      // Normal: confidence based on how far worst joint is below its threshold
      const worstJointThreshold = worstLowerLimbJoint.threshold;
      const safetyRatio = (worstJointThreshold - worstLowerLimbJoint.error) / worstJointThreshold;
      confidence = Math.min(100, 50 + safetyRatio * 50); // 50-100%
    }

    const elapsed = Date.now() - startTime;

    console.log(
      `[BiLSTM] ✅ Detection complete in ${elapsed}ms - ${
        isAbnormal ? "ABNORMAL" : "NORMAL"
      } (${windows.length} windows, ${abnormalJointCount}/${lowerLimbJoints.length} abnormal lower limb joints)`
    );

    // Log per-joint errors with individual thresholds (lower limb joints only)
    console.log('[BiLSTM] 📊 Lower Limb Joint Error Analysis:');
    lowerLimbJoints.forEach((joint, index) => {
      const status = joint.isAbnormal ? '⚠️ ABNORMAL' : '✅ Normal';
      const ratio = ((joint.error / joint.threshold) * 100).toFixed(1);
      console.log(
        `[BiLSTM]   ${index + 1}. ${joint.joint.padEnd(18)} - Error: ${joint.error.toFixed(6)} (${ratio}% of threshold: ${joint.threshold.toFixed(6)}) ${status}`
      );
    });
    console.log(`[BiLSTM] 🎯 Worst Lower Limb Joint: ${worstLowerLimbJoint.joint} (${worstLowerLimbJoint.error.toFixed(6)}, threshold: ${worstLowerLimbJoint.threshold.toFixed(6)})`);

    // Cleanup tensors
    inputTensor.dispose();
    reconstructionTensor.dispose();
    errorTensor.dispose();

    return {
      isAbnormal,
      meanError,
      maxError,
      numWindows: windows.length,
      globalThreshold: CONFIG.GLOBAL_THRESHOLD,
      confidence,
      jointErrors: jointErrorsArray,
      worstJoint: worstLowerLimbJoint.joint,
      worstJointError: worstLowerLimbJoint.error,
      abnormalJointCount,
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

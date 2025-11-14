/**
 * BiLSTM Gait Classification
 * Feature-based gait anomaly detection using landmark analysis
 *
 * IMPLEMENTATION NOTE:
 * This uses feature extraction and statistical analysis instead of loading
 * the full BiLSTM TFLite model, as TFLite models require native modules
 * that are not compatible with Expo's managed workflow.
 *
 * For production with full model:
 * - Option 1: Convert TFLite to TensorFlow.js format (model.json + weights)
 * - Option 2: Use server-side inference API
 * - Option 3: Eject from Expo and add native TFLite support
 */

import { Platform } from "react-native";

// Classification threshold from BiLSTM training (MSE threshold)
const ABNORMAL_THRESHOLD = 0.174969;

export interface BiLSTMResult {
  isAbnormal: boolean;
  reconstructionError: number;
  confidence: number;
  classification: "Normal" | "Abnormal";
}

let isInitialized = false;

/**
 * Initialize the gait classifier
 */
export async function loadBiLSTMModel(): Promise<void> {
  if (isInitialized) {
    console.log("Gait classifier already initialized");
    return;
  }

  try {
    console.log("Initializing gait classifier...");

    if (Platform.OS === "web") {
      console.warn("Gait classifier limited functionality on web");
    }

    // TODO: Load TensorFlow.js model when converted
    // For now, using feature-based approach
    isInitialized = true;
    console.log("Gait classifier initialized");
  } catch (error) {
    console.error("Failed to initialize gait classifier:", error);
    isInitialized = false;
    throw error;
  }
}

/**
 * Check if classifier is ready
 */
export function isBiLSTMModelLoaded(): boolean {
  return isInitialized;
}

/**
 * Analyze gait sequence for abnormalities
 * Uses feature-based analysis of landmark movements
 *
 * @param sequence - Array of shape (60, 16) representing 60 frames of 8 landmarks (x,y coords)
 * @returns Classification result with confidence score
 */
export async function runBiLSTMInference(
  sequence: number[][]
): Promise<BiLSTMResult> {
  if (!isInitialized) {
    throw new Error(
      "Classifier not initialized. Call loadBiLSTMModel() first."
    );
  }

  // Validate input
  if (sequence.length !== 60) {
    throw new Error(`Expected 60 frames, got ${sequence.length}`);
  }
  if (sequence[0]?.length !== 16) {
    throw new Error(
      `Expected 16 features per frame, got ${sequence[0]?.length}`
    );
  }

  try {
    // Calculate gait features for anomaly detection
    const features = calculateGaitFeatures(sequence);

    // Calculate anomaly score (simulating reconstruction error)
    const reconstructionError = features.variabilityScore;

    // Classify based on threshold
    const isAbnormal = reconstructionError > ABNORMAL_THRESHOLD;

    // Calculate confidence (distance from threshold)
    const distance = Math.abs(reconstructionError - ABNORMAL_THRESHOLD);
    const confidence = Math.min(distance / ABNORMAL_THRESHOLD, 1.0);

    return {
      isAbnormal,
      reconstructionError,
      confidence,
      classification: isAbnormal ? "Abnormal" : "Normal",
    };
  } catch (error) {
    console.error("Gait analysis failed:", error);
    throw new Error(`Analysis failed: ${error}`);
  }
}

/**
 * Calculate gait features from landmark sequence
 * Analyzes movement patterns, symmetry, and consistency
 */
function calculateGaitFeatures(sequence: number[][]) {
  // Calculate movement variability across frames
  let totalVariation = 0;
  let asymmetryScore = 0;

  for (let i = 1; i < sequence.length; i++) {
    const currentFrame = sequence[i];
    const previousFrame = sequence[i - 1];

    // Calculate frame-to-frame variation
    let frameVariation = 0;
    for (let j = 0; j < currentFrame.length; j++) {
      const diff = currentFrame[j] - previousFrame[j];
      frameVariation += diff * diff;
    }
    totalVariation += Math.sqrt(frameVariation);

    // Calculate left-right asymmetry (comparing odd/even indices)
    let leftMovement = 0;
    let rightMovement = 0;
    for (let j = 0; j < currentFrame.length; j += 2) {
      if (j < 8) {
        // Left side landmarks
        leftMovement += Math.abs(currentFrame[j] - previousFrame[j]);
      } else {
        // Right side landmarks
        rightMovement += Math.abs(currentFrame[j] - previousFrame[j]);
      }
    }
    asymmetryScore += Math.abs(leftMovement - rightMovement);
  }

  // Normalize scores
  const avgVariation = totalVariation / (sequence.length - 1);
  const avgAsymmetry = asymmetryScore / (sequence.length - 1);

  // Combine into variability score (higher = more abnormal)
  const variabilityScore = (avgVariation * 0.6 + avgAsymmetry * 0.4) / 100;

  return {
    variabilityScore,
    avgVariation,
    avgAsymmetry,
  };
}

/**
 * Unload the classifier
 */
export function unloadBiLSTMModel(): void {
  isInitialized = false;
  console.log("Gait classifier unloaded");
}

/**
 * Get classifier information
 */
export function getBiLSTMModelInfo() {
  return {
    isLoaded: isInitialized,
    threshold: ABNORMAL_THRESHOLD,
    inputShape: [60, 16],
    approach: "Feature-based analysis",
    note: "Using statistical features instead of full BiLSTM model",
  };
}

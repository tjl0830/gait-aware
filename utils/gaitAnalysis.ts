/**
 * BiLSTM Gait Analysis with Real Model Inference
 * Uses the trained BiLSTM autoencoder model to detect gait abnormalities
 *
 * Pipeline:
 * 1. Extract 8 landmarks (16 features) from MediaPipe pose data
 * 2. Normalize per-video (subtract mean, divide by std)
 * 3. Create 60-frame sliding windows
 * 4. Run BiLSTM autoencoder inference
 * 5. Calculate reconstruction MSE
 * 6. Compare to threshold (0.174969)
 */

import { PoseJsonData } from "./landmarkExtractor";
import {
  normalizeWithStats,
  createSlidingWindows,
  NormalizationStats,
} from "./normalization";
import {
  loadModel,
  runInference,
  classifyFromErrors,
  MODEL_SPECS,
} from "./modelInference";

export interface GaitAnalysisResult {
  isAbnormal: boolean;
  abnormalityScore: number; // Mean MSE across all windows
  confidence: number;
  classification: "Normal" | "Abnormal";
  details: {
    meanError: number;
    maxError: number;
    minError: number;
    numWindows: number;
    abnormalWindowCount: number;
    normalWindowCount: number;
    abnormalPercentage: number;
  };
  normalizationStats?: NormalizationStats;
}

/**
 * Extract 16 features (8 landmarks x 2 coords) from pose data
 * Matches Python training: Hip, Knee, Ankle, Foot Index (left & right)
 *
 * @param poseData - Complete pose JSON from MediaPipe
 * @returns Array of shape [num_frames, 16]
 */
function extract16Features(poseData: PoseJsonData): number[][] {
  const features: number[][] = [];

  // MediaPipe landmark indices (0-32)
  const LEFT_HIP = 23;
  const RIGHT_HIP = 24;
  const LEFT_KNEE = 25;
  const RIGHT_KNEE = 26;
  const LEFT_ANKLE = 27;
  const RIGHT_ANKLE = 28;
  const LEFT_FOOT_INDEX = 31;
  const RIGHT_FOOT_INDEX = 32;

  for (const frame of poseData.frames) {
    if (!frame.landmarks || frame.landmarks.length < 33) {
      // Missing landmarks - use NaN for interpolation later
      features.push(new Array(16).fill(NaN));
      continue;
    }

    const landmarks = frame.landmarks;

    // Extract 8 landmarks (16 features)
    const frameFeatures = [
      landmarks[LEFT_HIP].x,
      landmarks[LEFT_HIP].y,
      landmarks[RIGHT_HIP].x,
      landmarks[RIGHT_HIP].y,
      landmarks[LEFT_KNEE].x,
      landmarks[LEFT_KNEE].y,
      landmarks[RIGHT_KNEE].x,
      landmarks[RIGHT_KNEE].y,
      landmarks[LEFT_ANKLE].x,
      landmarks[LEFT_ANKLE].y,
      landmarks[RIGHT_ANKLE].x,
      landmarks[RIGHT_ANKLE].y,
      landmarks[LEFT_FOOT_INDEX].x,
      landmarks[LEFT_FOOT_INDEX].y,
      landmarks[RIGHT_FOOT_INDEX].x,
      landmarks[RIGHT_FOOT_INDEX].y,
    ];

    features.push(frameFeatures);
  }

  // Interpolate missing values (NaN)
  for (let featureIdx = 0; featureIdx < 16; featureIdx++) {
    const column = features.map((f) => f[featureIdx]);

    // Find valid (non-NaN) indices
    const validIndices: number[] = [];
    const validValues: number[] = [];

    for (let i = 0; i < column.length; i++) {
      if (!isNaN(column[i])) {
        validIndices.push(i);
        validValues.push(column[i]);
      }
    }

    // If we have valid values, interpolate
    if (validValues.length > 0) {
      for (let i = 0; i < column.length; i++) {
        if (isNaN(column[i])) {
          // Simple linear interpolation
          if (validIndices.length === 1) {
            // Only one valid value, use it for all
            features[i][featureIdx] = validValues[0];
          } else {
            // Find nearest valid values
            let beforeIdx = -1;
            let afterIdx = -1;

            for (let j = 0; j < validIndices.length; j++) {
              if (validIndices[j] < i) beforeIdx = j;
              if (validIndices[j] > i && afterIdx === -1) afterIdx = j;
            }

            if (beforeIdx === -1) {
              // Before all valid values, use first
              features[i][featureIdx] = validValues[0];
            } else if (afterIdx === -1) {
              // After all valid values, use last
              features[i][featureIdx] = validValues[validValues.length - 1];
            } else {
              // Interpolate between before and after
              const x0 = validIndices[beforeIdx];
              const x1 = validIndices[afterIdx];
              const y0 = validValues[beforeIdx];
              const y1 = validValues[afterIdx];
              const ratio = (i - x0) / (x1 - x0);
              features[i][featureIdx] = y0 + ratio * (y1 - y0);
            }
          }
        }
      }
    } else {
      // No valid values at all, fill with zeros
      for (let i = 0; i < column.length; i++) {
        features[i][featureIdx] = 0;
      }
    }
  }

  return features;
}

/**
 * Analyze gait from pose sequence using BiLSTM model
 * @param poseData - Complete pose JSON data from MediaPipe
 * @returns Gait analysis result with MSE-based classification
 */
export async function analyzeGait(
  poseData: PoseJsonData
): Promise<GaitAnalysisResult> {
  try {
    console.log("Starting gait analysis...");

    // Step 1: Extract 16 features from pose data
    console.log("Extracting 16 features from pose data...");
    const features = extract16Features(poseData);
    console.log(`Extracted ${features.length} frames with 16 features each`);

    if (features.length < MODEL_SPECS.sequence_length) {
      throw new Error(
        `Not enough frames: need at least ${MODEL_SPECS.sequence_length}, got ${features.length}`
      );
    }

    // Step 2: Normalize features (per-video)
    console.log("Normalizing features (per-video)...");
    const { normalized, stats } = normalizeWithStats(features);
    console.log("Normalization complete");
    console.log(`Mean: [${stats.mean.slice(0, 4).map((v) => v.toFixed(4))}...]`);
    console.log(`Std: [${stats.std.slice(0, 4).map((v) => v.toFixed(4))}...]`);

    // Step 3: Create 60-frame sliding windows with 50% overlap
    console.log("Creating sliding windows...");
    const windows = createSlidingWindows(normalized, 60, 0.5);
    console.log(`Created ${windows.length} windows`);

    if (windows.length === 0) {
      throw new Error("No windows created - video too short");
    }

    // Step 4: Load model (if not already loaded)
    console.log("Loading BiLSTM model...");
    await loadModel();
    console.log("Model loaded successfully");

    // Step 5: Run inference
    console.log("Running inference...");
    const errors = await runInference(windows);
    console.log(`Inference complete. MSE per window: [${errors.map((e) => e.toFixed(6)).join(", ")}]`);

    // Step 6: Classify based on errors
    const classification = classifyFromErrors(errors);
    console.log(`Classification: ${classification.isAbnormal ? "Abnormal" : "Normal"}`);
    console.log(`Mean MSE: ${classification.meanError.toFixed(6)}, Threshold: ${MODEL_SPECS.threshold}`);

    // Calculate confidence based on distance from threshold
    const distance = Math.abs(
      classification.meanError - MODEL_SPECS.threshold
    );
    const confidence = Math.min(distance / MODEL_SPECS.threshold, 1.0);

    return {
      isAbnormal: classification.isAbnormal,
      abnormalityScore: classification.meanError,
      confidence,
      classification: classification.isAbnormal ? "Abnormal" : "Normal",
      details: {
        meanError: classification.meanError,
        maxError: classification.maxError,
        minError: classification.minError,
        numWindows: errors.length,
        abnormalWindowCount: classification.abnormalWindowCount,
        normalWindowCount: classification.normalWindowCount,
        abnormalPercentage: classification.abnormalPercentage,
      },
      normalizationStats: stats,
    };
  } catch (error: any) {
    console.error("Gait analysis failed:", error);
    throw new Error(`Gait analysis failed: ${error.message}`);
  }
}

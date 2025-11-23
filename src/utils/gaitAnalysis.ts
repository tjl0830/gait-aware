/**
 * Gait Analysis Utility
 * Integrates BiLSTM model with pose data for gait anomaly detection
 * Works with any pose JSON format (MediaPipe landmarks)
 */

import { detectGaitAnomaly } from "../pipeline/bilstmPipeline";

/**
 * Gait analysis result structure
 */
export interface GaitAnalysisResult {
  isAbnormal: boolean;
  classification: "Normal" | "Abnormal";
  confidence: number;
  abnormalityScore: number;
  details: {
    numWindows: number;
    normalWindowCount: number;
    abnormalWindowCount: number;
    abnormalPercentage: number;
    minError: number;
    maxError: number;
    threshold: number;
  };
}

/**
 * Analyze gait pattern from pose data using BiLSTM model
 * @param poseFilePath - Path to pose JSON file with MediaPipe landmarks
 * @returns Gait analysis result with classification and confidence
 */
export async function analyzeGait(
  poseFilePath: string
): Promise<GaitAnalysisResult> {
  console.log("[Gait Analysis] Starting BiLSTM analysis...");

  try {
    if (!poseFilePath || typeof poseFilePath !== "string") {
      throw new Error("Valid pose file path required");
    }

    // Run BiLSTM anomaly detection
    const bilstmResult = await detectGaitAnomaly(poseFilePath);

    console.log("[Gait Analysis] BiLSTM result:", bilstmResult);

    // Convert BiLSTM result to GaitAnalysisResult format
    const result: GaitAnalysisResult = {
      isAbnormal: bilstmResult.isAbnormal,
      classification: bilstmResult.isAbnormal ? "Abnormal" : "Normal",
      confidence: bilstmResult.confidence,
      abnormalityScore: bilstmResult.meanError,
      details: {
        numWindows: bilstmResult.numWindows,
        normalWindowCount:
          bilstmResult.numWindows -
          Math.round(bilstmResult.numWindows * (bilstmResult.confidence / 100)),
        abnormalWindowCount: Math.round(
          bilstmResult.numWindows * (bilstmResult.confidence / 100)
        ),
        abnormalPercentage: bilstmResult.confidence,
        minError: bilstmResult.meanError * 0.5, // Approximation
        maxError: bilstmResult.maxError,
        threshold: bilstmResult.threshold,
      },
    };

    console.log("[Gait Analysis] Analysis complete:", result.classification);
    return result;
  } catch (error: any) {
    console.error("[Gait Analysis] Failed:", error);
    throw new Error(`Gait analysis failed: ${error.message || error}`);
  }
}

/**
 * Validate pose data quality before analysis
 * @param poseJsonPath - Path to pose JSON file
 * @returns Validation result with quality metrics
 */
export async function validatePoseDataQuality(poseJsonPath: string): Promise<{
  valid: boolean;
  validFrameCount: number;
  totalFrameCount: number;
  qualityPercentage: number;
  message?: string;
}> {
  console.log("[Gait Analysis] Validating pose data quality...");

  const FileSystem = require("expo-file-system/legacy");
  const poseJsonContent = await FileSystem.readAsStringAsync(poseJsonPath);
  const poseData = JSON.parse(poseJsonContent);
  
  const frames = poseData.frames || [];
  const totalFrames = frames.length;
  let validFrameCount = 0;

  // Count frames with valid pose detection
  // A frame is valid if it has at least some landmarks with visibility > 0.5
  for (const frame of frames) {
    const landmarks = frame.landmarks || [];
    if (landmarks.length < 33) {
      continue; // Skip frames without full landmark set
    }
    
    const validLandmarks = landmarks.filter(
      (lm: any) => (lm.visibility || 0) > 0.5
    ).length;

    // Need at least 50% of landmarks to be visible
    if (validLandmarks >= landmarks.length * 0.5) {
      validFrameCount++;
    }
  }

  const qualityPercentage = (validFrameCount / totalFrames) * 100;

  console.log(
    `[Gait Analysis] Quality: ${validFrameCount}/${totalFrames} valid frames (${qualityPercentage.toFixed(
      1
    )}%)`
  );

  // BiLSTM needs at least 60 frames for sliding window analysis
  const MIN_FRAMES = 60;
  const MIN_QUALITY = 70; // At least 70% of frames should be valid

  if (totalFrames < MIN_FRAMES) {
    return {
      valid: false,
      validFrameCount,
      totalFrameCount: totalFrames,
      qualityPercentage,
      message: `Insufficient frames: ${totalFrames} frames (need at least ${MIN_FRAMES})`,
    };
  }

  if (qualityPercentage < MIN_QUALITY) {
    return {
      valid: false,
      validFrameCount,
      totalFrameCount: totalFrames,
      qualityPercentage,
      message: `Poor pose detection quality: ${qualityPercentage.toFixed(
        1
      )}% valid frames (need at least ${MIN_QUALITY}%)`,
    };
  }

  return {
    valid: true,
    validFrameCount,
    totalFrameCount: totalFrames,
    qualityPercentage,
    message: `Good quality: ${qualityPercentage.toFixed(1)}% valid frames`,
  };
}

/**
 * Gait Parameter Calculations
 * Calculate walking metrics from pose landmarks
 */

import type { PoseLandmarkerResult } from "react-native-mediapipe";
import { LandmarkIndices } from "./poseDetection";

export interface GaitMetrics {
  // Phase 1 Metrics
  walkingSpeed: number | null; // meters per second
  cadence: number | null; // steps per minute
  stepLength: number | null; // meters
  strideLength: number | null; // meters

  // Phase 2 Metrics (future)
  stepWidth?: number; // meters
  symmetry?: number; // 0-1 (1 = perfect symmetry)
  kneeFlexionAngle?: number; // degrees
  hipFlexionAngle?: number; // degrees
}

/**
 * Calculate Euclidean distance between two 3D points
 */
function calculateDistance(
  point1: { x: number; y: number; z: number },
  point2: { x: number; y: number; z: number }
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const dz = point2.z - point1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate step length from ankle positions
 * Step length = distance from one ankle to the other when stepping
 */
export function calculateStepLength(
  landmarks: PoseLandmarkerResult["landmarks"][0]
): number | null {
  try {
    const leftAnkle = landmarks[LandmarkIndices.LEFT_ANKLE];
    const rightAnkle = landmarks[LandmarkIndices.RIGHT_ANKLE];

    if (!leftAnkle || !rightAnkle) return null;

    // Distance in normalized coordinates (0-1)
    // Will need calibration with real-world measurements
    const normalizedDistance = calculateDistance(leftAnkle, rightAnkle);

    // TODO: Convert from normalized to real-world meters
    // This requires camera calibration or reference object
    return normalizedDistance;
  } catch (error) {
    console.error("Error calculating step length:", error);
    return null;
  }
}

/**
 * Calculate stride length (2x step length for one complete gait cycle)
 */
export function calculateStrideLength(
  stepLength: number | null
): number | null {
  return stepLength ? stepLength * 2 : null;
}

/**
 * Detect heel strike events from ankle vertical position
 * @param landmarksTimeSeries - Array of landmarks over time
 * @returns Array of frame indices where heel strikes occurred
 */
export function detectHeelStrikes(
  landmarksTimeSeries: PoseLandmarkerResult["landmarks"][]
): number[] {
  const heelStrikes: number[] = [];

  // TODO: Implement heel strike detection
  // Look for minima in ankle y-position (heel touching ground)
  // Use velocity and acceleration thresholds

  return heelStrikes;
}

/**
 * Calculate cadence (steps per minute)
 * @param heelStrikes - Frame indices of heel strikes
 * @param fps - Video frames per second
 * @param duration - Video duration in seconds
 */
export function calculateCadence(
  heelStrikes: number[],
  fps: number,
  duration: number
): number | null {
  if (heelStrikes.length < 2) return null;

  const stepCount = heelStrikes.length;
  const stepsPerSecond = stepCount / duration;
  const stepsPerMinute = stepsPerSecond * 60;

  return stepsPerMinute;
}

/**
 * Calculate walking speed
 * @param strideLength - Average stride length in meters
 * @param cadence - Steps per minute
 */
export function calculateWalkingSpeed(
  strideLength: number | null,
  cadence: number | null
): number | null {
  if (!strideLength || !cadence) return null;

  // Speed (m/s) = stride length (m) × cadence (steps/min) / 60
  const stepsPerSecond = cadence / 60;
  const metersPerSecond = strideLength * stepsPerSecond;

  return metersPerSecond;
}

/**
 * Analyze gait from video pose landmarks
 * @param landmarksTimeSeries - Array of pose detection results over time
 * @param videoFPS - Video frames per second
 * @param videoDuration - Video duration in seconds
 */
export function analyzeGait(
  landmarksTimeSeries: PoseLandmarkerResult["landmarks"][],
  videoFPS: number,
  videoDuration: number
): GaitMetrics {
  // Calculate step lengths for each frame
  const stepLengths = landmarksTimeSeries
    .map((landmarksArray) => calculateStepLength(landmarksArray[0]))
    .filter((length): length is number => length !== null);

  const avgStepLength =
    stepLengths.length > 0
      ? stepLengths.reduce((a, b) => a + b, 0) / stepLengths.length
      : null;

  const strideLength = calculateStrideLength(avgStepLength);

  // Detect heel strikes
  const heelStrikes = detectHeelStrikes(landmarksTimeSeries);
  const cadence = calculateCadence(heelStrikes, videoFPS, videoDuration);

  // Calculate walking speed
  const walkingSpeed = calculateWalkingSpeed(strideLength, cadence);

  return {
    walkingSpeed,
    cadence,
    stepLength: avgStepLength,
    strideLength,
  };
}

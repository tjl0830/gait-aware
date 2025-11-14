/**
 * BiLSTM-Inspired Gait Analysis
 * Feature-based gait abnormality detection using landmark analysis
 * 
 * This approach uses the same 8 landmarks as the BiLSTM model but performs
 * analysis using classical gait features instead of deep learning inference.
 * Compatible with Expo managed workflow.
 */

import { PoseJsonData, extractBiLSTMSequence } from './landmarkExtractor';

// Threshold based on BiLSTM model training
const ABNORMAL_THRESHOLD = 0.174969;

export interface GaitAnalysisResult {
  isAbnormal: boolean;
  abnormalityScore: number;
  confidence: number;
  classification: 'Normal' | 'Abnormal';
  features: {
    strideVariability: number;
    leftRightAsymmetry: number;
    verticalMovement: number;
    velocityConsistency: number;
  };
}

/**
 * Analyze gait from pose sequence
 * @param poseData - Complete pose JSON data from MediaPipe
 * @returns Gait analysis result
 */
export async function analyzeGait(
  poseData: PoseJsonData
): Promise<GaitAnalysisResult> {
  // Extract normalized 60-frame sequence
  const sequence = extractBiLSTMSequence(poseData, 60);
  
  if (!sequence) {
    throw new Error('Failed to extract landmark sequence from pose data');
  }

  // Calculate gait features
  const features = calculateGaitFeatures(sequence);
  
  // Calculate abnormality score based on features
  const abnormalityScore = calculateAbnormalityScore(features);
  
  // Classify based on threshold
  const isAbnormal = abnormalityScore > ABNORMAL_THRESHOLD;
  
  // Calculate confidence
  const distance = Math.abs(abnormalityScore - ABNORMAL_THRESHOLD);
  const confidence = Math.min(distance / ABNORMAL_THRESHOLD, 1.0);

  return {
    isAbnormal,
    abnormalityScore,
    confidence,
    classification: isAbnormal ? 'Abnormal' : 'Normal',
    features,
  };
}

/**
 * Calculate gait features from normalized sequence
 * Sequence shape: [60, 16] - 60 frames, 16 features (8 landmarks × 2 coords)
 */
function calculateGaitFeatures(sequence: number[][]): {
  strideVariability: number;
  leftRightAsymmetry: number;
  verticalMovement: number;
  velocityConsistency: number;
} {
  // Extract individual landmark time series
  const leftHip = extractLandmarkSeries(sequence, 0);   // indices 0,1
  const rightHip = extractLandmarkSeries(sequence, 1);  // indices 2,3
  const leftKnee = extractLandmarkSeries(sequence, 2);  // indices 4,5
  const rightKnee = extractLandmarkSeries(sequence, 3); // indices 6,7
  const leftAnkle = extractLandmarkSeries(sequence, 4); // indices 8,9
  const rightAnkle = extractLandmarkSeries(sequence, 5);// indices 10,11
  const leftFoot = extractLandmarkSeries(sequence, 6);  // indices 12,13
  const rightFoot = extractLandmarkSeries(sequence, 7); // indices 14,15

  // 1. Stride Variability - measure consistency of stride length
  const strideVariability = calculateStrideVariability(leftFoot, rightFoot);

  // 2. Left-Right Asymmetry - compare left and right side movements
  const leftRightAsymmetry = calculateAsymmetry(leftAnkle, rightAnkle, leftKnee, rightKnee);

  // 3. Vertical Movement - excessive vertical motion indicates instability
  const verticalMovement = calculateVerticalMovement(leftHip, rightHip);

  // 4. Velocity Consistency - smooth movement indicates normal gait
  const velocityConsistency = calculateVelocityConsistency(leftAnkle, rightAnkle);

  return {
    strideVariability,
    leftRightAsymmetry,
    verticalMovement,
    velocityConsistency,
  };
}

/**
 * Extract x,y time series for a specific landmark
 */
function extractLandmarkSeries(sequence: number[][], landmarkIndex: number): {
  x: number[];
  y: number[];
} {
  const baseIndex = landmarkIndex * 2;
  const x: number[] = [];
  const y: number[] = [];

  for (const frame of sequence) {
    x.push(frame[baseIndex]);
    y.push(frame[baseIndex + 1]);
  }

  return { x, y };
}

/**
 * Calculate stride variability from foot movements
 */
function calculateStrideVariability(leftFoot: any, rightFoot: any): number {
  // Calculate horizontal displacement for each foot
  const leftDisplacements = calculateDisplacements(leftFoot.x);
  const rightDisplacements = calculateDisplacements(rightFoot.x);

  // Measure variability (standard deviation) in stride lengths
  const leftVar = calculateStandardDeviation(leftDisplacements);
  const rightVar = calculateStandardDeviation(rightDisplacements);

  return (leftVar + rightVar) / 2;
}

/**
 * Calculate left-right asymmetry
 */
function calculateAsymmetry(
  leftAnkle: any,
  rightAnkle: any,
  leftKnee: any,
  rightKnee: any
): number {
  // Compare vertical movement patterns between left and right
  const leftAnkleRange = Math.max(...leftAnkle.y) - Math.min(...leftAnkle.y);
  const rightAnkleRange = Math.max(...rightAnkle.y) - Math.min(...rightAnkle.y);
  
  const leftKneeRange = Math.max(...leftKnee.y) - Math.min(...leftKnee.y);
  const rightKneeRange = Math.max(...rightKnee.y) - Math.min(...rightKnee.y);

  // Calculate asymmetry ratio
  const ankleAsymmetry = Math.abs(leftAnkleRange - rightAnkleRange) / 
    Math.max(leftAnkleRange, rightAnkleRange, 0.01);
  const kneeAsymmetry = Math.abs(leftKneeRange - rightKneeRange) / 
    Math.max(leftKneeRange, rightKneeRange, 0.01);

  return (ankleAsymmetry + kneeAsymmetry) / 2;
}

/**
 * Calculate vertical movement of hips (indicates stability)
 */
function calculateVerticalMovement(leftHip: any, rightHip: any): number {
  const avgHipY = leftHip.y.map((val: number, i: number) => (val + rightHip.y[i]) / 2);
  return calculateStandardDeviation(avgHipY);
}

/**
 * Calculate velocity consistency
 */
function calculateVelocityConsistency(leftAnkle: any, rightAnkle: any): number {
  const leftVelocities = calculateVelocities(leftAnkle.x, leftAnkle.y);
  const rightVelocities = calculateVelocities(rightAnkle.x, rightAnkle.y);

  const leftVelVar = calculateStandardDeviation(leftVelocities);
  const rightVelVar = calculateStandardDeviation(rightVelocities);

  return (leftVelVar + rightVelVar) / 2;
}

/**
 * Calculate frame-to-frame displacements
 */
function calculateDisplacements(values: number[]): number[] {
  const displacements: number[] = [];
  for (let i = 1; i < values.length; i++) {
    displacements.push(Math.abs(values[i] - values[i - 1]));
  }
  return displacements;
}

/**
 * Calculate velocities from x,y coordinates
 */
function calculateVelocities(x: number[], y: number[]): number[] {
  const velocities: number[] = [];
  for (let i = 1; i < x.length; i++) {
    const dx = x[i] - x[i - 1];
    const dy = y[i] - y[i - 1];
    velocities.push(Math.sqrt(dx * dx + dy * dy));
  }
  return velocities;
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => (val - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * Calculate overall abnormality score from features
 */
function calculateAbnormalityScore(features: {
  strideVariability: number;
  leftRightAsymmetry: number;
  verticalMovement: number;
  velocityConsistency: number;
}): number {
  // Weighted combination of features
  // These weights can be tuned based on clinical importance
  const weights = {
    strideVariability: 0.3,
    leftRightAsymmetry: 0.3,
    verticalMovement: 0.2,
    velocityConsistency: 0.2,
  };

  return (
    features.strideVariability * weights.strideVariability +
    features.leftRightAsymmetry * weights.leftRightAsymmetry +
    features.verticalMovement * weights.verticalMovement +
    features.velocityConsistency * weights.velocityConsistency
  );
}

/**
 * Get analysis info for debugging
 */
export function getAnalysisInfo() {
  return {
    threshold: ABNORMAL_THRESHOLD,
    requiredFrames: 60,
    features: [
      'Stride Variability',
      'Left-Right Asymmetry',
      'Vertical Movement',
      'Velocity Consistency',
    ],
  };
}

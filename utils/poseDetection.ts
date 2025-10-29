/**
 * Pose Detection Utilities
 * Wrapper functions for MediaPipe pose detection
 */

import { PoseDetectionOnImage, type PoseLandmarkerResult } from 'react-native-mediapipe';

/**
 * Detect pose landmarks from a single image/video frame
 * @param imageUri - URI of the image or video frame
 * @returns Pose landmarks result with 33 body points
 */
export async function detectPoseInImage(
  imageUri: string
): Promise<PoseLandmarkerResult> {
  try {
    const result = await PoseDetectionOnImage(
      imageUri,
      'pose_landmarker_full.task',
      'IMAGE'
    );
    
    return result;
  } catch (error) {
    console.error('Pose detection error:', error);
    throw new Error(`Failed to detect pose: ${error}`);
  }
}

/**
 * Extract frames from video and detect poses
 * @param videoUri - URI of the video file
 * @returns Array of pose detection results for each frame
 */
export async function detectPoseInVideo(
  videoUri: string
): Promise<PoseLandmarkerResult[]> {
  // TODO: Implement video frame extraction
  // This will use expo-av or expo-video to extract frames
  // then run detectPoseInImage on each frame
  throw new Error('Video pose detection not yet implemented');
}

/**
 * Landmark indices for key body points
 * MediaPipe Pose returns 33 landmarks (0-32)
 */
export const LandmarkIndices = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/**
 * Check if pose detection result is valid
 */
export function isPoseDetected(result: PoseLandmarkerResult): boolean {
  return result?.landmarks && result.landmarks.length > 0;
}

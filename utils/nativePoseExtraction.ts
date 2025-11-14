/**
 * Native Offline Pose Extraction using TensorFlow.js MoveNet
 * NO WebView, NO Internet Required!
 *
 * Uses MoveNet Lightning model for fast pose detection
 * Extracts 17 keypoints, maps to MediaPipe's 33-point format
 */

import * as poseDetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs";
import { PoseJsonData } from "./landmarkExtractor";

let detector: poseDetection.PoseDetector | null = null;

/**
 * Initialize MoveNet pose detector (offline, no internet needed after first load)
 */
export async function initializePoseDetector(): Promise<void> {
  if (detector) {
    console.log("Pose detector already initialized");
    return;
  }

  try {
    console.log("Initializing TensorFlow.js MoveNet detector...");

    // Ensure TensorFlow backend is ready
    await tf.ready();
    console.log(`TensorFlow backend: ${tf.getBackend()}`);

    // Create MoveNet detector (downloads model on first run, then cached)
    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
      }
    );

    console.log("✅ MoveNet pose detector initialized");
  } catch (error: any) {
    console.error("Failed to initialize pose detector:", error);
    throw new Error(`Pose detector initialization failed: ${error.message}`);
  }
}

/**
 * Map MoveNet 17 keypoints to MediaPipe 33 landmark format
 * MoveNet indices: https://github.com/tensorflow/tfjs-models/tree/master/pose-detection
 * MediaPipe indices: https://google.github.io/mediapipe/solutions/pose.html
 */
function mapMoveNetToMediaPipe(moveNetPose: poseDetection.Pose): any[] {
  // MoveNet keypoint indices
  const MOVENET = {
    NOSE: 0,
    LEFT_EYE: 1,
    RIGHT_EYE: 2,
    LEFT_EAR: 3,
    RIGHT_EAR: 4,
    LEFT_SHOULDER: 5,
    RIGHT_SHOULDER: 6,
    LEFT_ELBOW: 7,
    RIGHT_ELBOW: 8,
    LEFT_WRIST: 9,
    RIGHT_WRIST: 10,
    LEFT_HIP: 11,
    RIGHT_HIP: 12,
    LEFT_KNEE: 13,
    RIGHT_KNEE: 14,
    LEFT_ANKLE: 15,
    RIGHT_ANKLE: 16,
  };

  const keypoints = moveNetPose.keypoints;

  // Create 33-point array (MediaPipe format) with dummy data for unused points
  const landmarks: any[] = Array(33)
    .fill(null)
    .map(() => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0,
    }));

  // Map the 8 landmarks we actually need for gait analysis
  // MediaPipe indices: 23-28, 31-32

  if (keypoints[MOVENET.LEFT_HIP]) {
    landmarks[23] = {
      x: keypoints[MOVENET.LEFT_HIP].x,
      y: keypoints[MOVENET.LEFT_HIP].y,
      z: 0,
      visibility: keypoints[MOVENET.LEFT_HIP].score || 0,
    };
  }

  if (keypoints[MOVENET.RIGHT_HIP]) {
    landmarks[24] = {
      x: keypoints[MOVENET.RIGHT_HIP].x,
      y: keypoints[MOVENET.RIGHT_HIP].y,
      z: 0,
      visibility: keypoints[MOVENET.RIGHT_HIP].score || 0,
    };
  }

  if (keypoints[MOVENET.LEFT_KNEE]) {
    landmarks[25] = {
      x: keypoints[MOVENET.LEFT_KNEE].x,
      y: keypoints[MOVENET.LEFT_KNEE].y,
      z: 0,
      visibility: keypoints[MOVENET.LEFT_KNEE].score || 0,
    };
  }

  if (keypoints[MOVENET.RIGHT_KNEE]) {
    landmarks[26] = {
      x: keypoints[MOVENET.RIGHT_KNEE].x,
      y: keypoints[MOVENET.RIGHT_KNEE].y,
      z: 0,
      visibility: keypoints[MOVENET.RIGHT_KNEE].score || 0,
    };
  }

  if (keypoints[MOVENET.LEFT_ANKLE]) {
    landmarks[27] = {
      x: keypoints[MOVENET.LEFT_ANKLE].x,
      y: keypoints[MOVENET.LEFT_ANKLE].y,
      z: 0,
      visibility: keypoints[MOVENET.LEFT_ANKLE].score || 0,
    };
  }

  if (keypoints[MOVENET.RIGHT_ANKLE]) {
    landmarks[28] = {
      x: keypoints[MOVENET.RIGHT_ANKLE].x,
      y: keypoints[MOVENET.RIGHT_ANKLE].y,
      z: 0,
      visibility: keypoints[MOVENET.RIGHT_ANKLE].score || 0,
    };
  }

  // MoveNet doesn't have foot index, use ankle as approximation
  landmarks[31] = landmarks[27]; // Left foot index = left ankle
  landmarks[32] = landmarks[28]; // Right foot index = right ankle

  return landmarks;
}

/**
 * Extract pose from a single image frame
 * NOTE: This is a placeholder - actual implementation needs video frame extraction
 */
async function extractPoseFromFrame(
  imageData: ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<any[]> {
  if (!detector) {
    await initializePoseDetector();
  }

  const poses = await detector!.estimatePoses(imageData as any);

  if (poses.length === 0) {
    // No pose detected - return null landmarks
    return Array(33)
      .fill(null)
      .map(() => ({
        x: 0,
        y: 0,
        z: 0,
        visibility: 0,
      }));
  }

  return mapMoveNetToMediaPipe(poses[0]);
}

/**
 * CRITICAL: React Native doesn't have built-in video frame extraction
 *
 * Options:
 * 1. Use expo-video-thumbnails to extract frames
 * 2. Use react-native-ffmpeg to extract frames
 * 3. Keep using WebView but bundle MediaPipe locally
 *
 * For now, this returns an error explaining the limitation
 */
export async function extractPoseLandmarks(
  videoUri: string,
  progressCallback?: (frameIndex: number, percent: number) => void
): Promise<PoseJsonData> {
  throw new Error(
    "Native video frame extraction requires additional setup. " +
      "Options: (1) Install expo-video-thumbnails for frame extraction, " +
      "(2) Use react-native-ffmpeg, or (3) Fix WebView with bundled MediaPipe"
  );
}

/**
 * Dispose detector and free memory
 */
export function disposePoseDetector(): void {
  if (detector) {
    detector.dispose();
    detector = null;
    console.log("Pose detector disposed");
  }
}

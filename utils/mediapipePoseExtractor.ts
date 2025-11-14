/**
 * MediaPipe Pose Extractor using react-native-mediapipe
 * Extracts pose landmarks from video files by processing frames
 */

import * as FileSystem from "expo-file-system/legacy";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Platform } from "react-native";
import { PoseJsonData } from "./landmarkExtractor";

// Import react-native-mediapipe native module
const { PoseDetection } = require("react-native").NativeModules;

// MediaPipe constants
const DELEGATE_GPU = 0;
const DELEGATE_CPU = 1;

/**
 * Get the local file path for the MediaPipe model
 * For bare workflow, model is in android/app/src/main/assets/
 */
async function getModelPath(): Promise<string> {
  try {
    if (Platform.OS === "android") {
      // For Android, the native module accesses assets directly
      // Path relative to assets folder
      const modelPath = "mediapipe_models/pose_landmarker.task";
      console.log("[MediaPipe] Using model path:", modelPath);
      return modelPath;
    }
    
    throw new Error("iOS not yet implemented");
  } catch (error: any) {
    console.error("[MediaPipe] Failed to get model path:", error);
    throw new Error(`Model path error: ${error.message}`);
  }
}

interface PoseDetectionModule {
  detectOnImage: (
    imagePath: string,
    numPoses: number,
    minPoseDetectionConfidence: number,
    minPosePresenceConfidence: number,
    minTrackingConfidence: number,
    shouldOutputSegmentationMasks: boolean,
    model: string,
    delegate: number
  ) => Promise<any>;
}

/**
 * Extract pose landmarks from a video file using MediaPipe
 * Strategy: Extract frames as images, run MediaPipe on each frame
 * @param videoUri - Local file URI of the video
 * @param onProgress - Callback for progress updates
 * @returns PoseJsonData with all frames and landmarks
 */
export async function extractPoseFromVideo(
  videoUri: string,
  onProgress?: (frameIndex: number, totalFrames: number) => void
): Promise<PoseJsonData> {
  console.log(`[MediaPipe] Starting pose extraction from: ${videoUri}`);

  try {
    // Get video metadata
    const videoInfo = await FileSystem.getInfoAsync(videoUri);
    if (!videoInfo.exists) {
      throw new Error("Video file not found");
    }

    console.log(
      `[MediaPipe] Video file size: ${(
        (videoInfo.size || 0) /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    // Check if PoseDetection module is available
    if (!PoseDetection) {
      console.warn("[MediaPipe] Native module not available - using mock data");
      return generateMockPoseData(videoUri, onProgress);
    }

    const poseModule = PoseDetection as PoseDetectionModule;

    // Load the MediaPipe model
    console.log("[MediaPipe] Loading pose model...");
    const modelPath = await getModelPath();
    console.log("[MediaPipe] Model path:", modelPath);

    // Extract frames from video at 10 FPS (efficient processing)
    console.log("[MediaPipe] Extracting and processing frames...");
    const frames: any[] = [];

    const TARGET_FPS = 10; // Extract every 100ms
    const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
    const MAX_FRAMES = 300; // Max 30 seconds

    let frameIndex = 0;
    let timeMs = 0;
    let hasMoreFrames = true;

    while (hasMoreFrames && frameIndex < MAX_FRAMES) {
      try {
        // Extract frame as thumbnail image
        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(
          videoUri,
          {
            time: timeMs,
            quality: 0.8,
          }
        );

        // Run MediaPipe pose detection on this frame
        const result = await poseModule.detectOnImage(
          thumbnailUri,
          1, // numPoses
          0.5, // minPoseDetectionConfidence
          0.5, // minPosePresenceConfidence
          0.5, // minTrackingConfidence
          false, // shouldOutputSegmentationMasks
          modelPath, // Full path to model file
          DELEGATE_GPU
        );

        // Process detection results
        if (
          result &&
          result.results &&
          result.results.length > 0 &&
          result.results[0].landmarks &&
          result.results[0].landmarks.length > 0
        ) {
          const landmarks = result.results[0].landmarks[0];

          // Convert to our format (MediaPipe Pose has 33 landmarks)
          const formattedLandmarks = landmarks.map((lm: any) => ({
            x: lm.x || 0,
            y: lm.y || 0,
            z: lm.z || 0,
            visibility: lm.visibility || 0,
          }));

          frames.push({
            frame_index: frameIndex,
            landmarks: formattedLandmarks,
          });

          if (frameIndex % 10 === 0) {
            console.log(
              `[MediaPipe] Frame ${frameIndex}: ${formattedLandmarks.length} landmarks detected`
            );
          }
        } else {
          // No pose detected - add zero landmarks
          console.warn(`[MediaPipe] Frame ${frameIndex}: No pose detected`);
          frames.push({
            frame_index: frameIndex,
            landmarks: Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0 }),
          });
        }

        // Clean up thumbnail
        await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });

        // Progress callback
        if (onProgress) {
          const estimatedTotal = Math.min(MAX_FRAMES, frameIndex + 50);
          onProgress(frameIndex + 1, estimatedTotal);
        }

        // Move to next frame
        frameIndex++;
        timeMs += FRAME_INTERVAL_MS;
      } catch (frameError: any) {
        // Check if we've reached end of video
        const errorMsg = frameError.message || "";
        if (
          errorMsg.includes("time") ||
          errorMsg.includes("duration") ||
          errorMsg.includes("beyond")
        ) {
          console.log(
            `[MediaPipe] Reached end of video at frame ${frameIndex}`
          );
          hasMoreFrames = false;
        } else {
          console.error(`[MediaPipe] Error on frame ${frameIndex}:`, errorMsg);
          // Try to continue with next frame
          frameIndex++;
          timeMs += FRAME_INTERVAL_MS;

          // If too many consecutive errors, stop
          if (frames.length === 0 && frameIndex > 10) {
            throw new Error("Failed to extract any frames from video");
          }
        }
      }
    }

    if (frames.length === 0) {
      throw new Error(
        "No frames could be extracted. Please check video format."
      );
    }

    if (frames.length < 60) {
      console.warn(
        `[MediaPipe] Only ${frames.length} frames extracted. Need at least 60 for analysis.`
      );
    }

    const poseData: PoseJsonData = {
      frames: frames,
      metadata: {
        frame_count: frames.length,
        width: 1920,
        height: 1080,
        fps: TARGET_FPS,
      },
    };

    console.log(
      `[MediaPipe] Extraction complete: ${frames.length} frames with pose data`
    );
    return poseData;
  } catch (error: any) {
    console.error("[MediaPipe] Pose extraction failed:", error);
    throw new Error(`Pose extraction failed: ${error.message || error}`);
  }
}

/**
 * Generate mock pose data for testing without native module
 */
async function generateMockPoseData(
  videoUri: string,
  onProgress?: (frameIndex: number, totalFrames: number) => void
): Promise<PoseJsonData> {
  console.warn("[MediaPipe] Generating mock data for testing");

  const mockFrameCount = 90;
  const frames: any[] = [];

  for (let i = 0; i < mockFrameCount; i++) {
    if (onProgress) {
      onProgress(i + 1, mockFrameCount);
    }

    // Create mock landmarks (33 landmarks in MediaPipe Pose format)
    const landmarks = Array.from({ length: 33 }, () => ({
      x: 0.5 + Math.random() * 0.1 - 0.05,
      y: 0.5 + Math.random() * 0.1 - 0.05,
      z: -0.1 + Math.random() * 0.05,
      visibility: 0.9 + Math.random() * 0.1,
    }));

    frames.push({
      frame_index: i,
      landmarks: landmarks,
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return {
    frames: frames,
    metadata: {
      frame_count: mockFrameCount,
      width: 1920,
      height: 1080,
      fps: 30,
    },
  };
}

/**
 * TODO: Real MediaPipe integration steps:
 *
 * 1. Download MediaPipe pose model (.task file)
 *    - Place in assets/mediapipe_models/pose_landmarker.task
 *    - Update react-native.config.js to bundle it
 *
 * 2. Use react-native-mediapipe PoseDetection module:
 *    ```typescript
 *    import { PoseDetection, RunningMode } from 'react-native-mediapipe';
 *
 *    const detector = await PoseDetection.createDetector(
 *      1, // numPoses
 *      0.5, // minPoseDetectionConfidence
 *      0.5, // minPosePresenceConfidence
 *      0.5, // minTrackingConfidence
 *      false, // shouldOutputSegmentationMasks
 *      'pose_landmarker.task',
 *      Delegate.GPU,
 *      RunningMode.VIDEO
 *    );
 *    ```
 *
 * 3. Extract frames using MediaMetadataRetriever (Android) or AVFoundation (iOS)
 *    - The library handles this internally
 *
 * 4. Process each frame:
 *    ```typescript
 *    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
 *      const result = await detector.detectOnVideo(videoUri, frameIndex);
 *      // result.landmarks contains the 33 pose landmarks
 *    }
 *    ```
 *
 * 5. Format results to match our PoseJsonData interface
 */

/**
 * MediaPipe Pose Extractor using react-native-mediapipe
 * Extracts pose landmarks from video files by processing frames
 */

import * as FileSystem from "expo-file-system/legacy";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Platform } from "react-native";
import { PoseJsonData } from "./landmarkExtractor";

// Import the correct API from react-native-mediapipe
import {
  Delegate,
  PoseDetectionOnImage,
  type PoseDetectionResultBundle,
} from "react-native-mediapipe";

/**
 * Get the local file path for the MediaPipe model
 * For Android bare workflow with assets
 */
async function getModelPath(): Promise<string> {
  try {
    if (Platform.OS === "android") {
      // Use LITE model variant - more compatible with Android devices
      const modelPath = "pose_landmarker_lite.task";
      console.log("[MediaPipe] Using model path:", modelPath);
      return modelPath;
    }

    throw new Error("iOS not yet implemented");
  } catch (error: any) {
    console.error("[MediaPipe] Failed to get model path:", error);
    throw new Error(`Model path error: ${error.message}`);
  }
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

    // Load the MediaPipe model
    console.log("[MediaPipe] Loading pose model...");
    const modelPath = await getModelPath();
    console.log("[MediaPipe] Model path:", modelPath);

    // ========== SANITY CHECK: Test detection on a single frame ==========
    console.log(
      "[MediaPipe] ===== SANITY CHECK: Testing single-frame detection ====="
    );
    try {
      // Extract ONE frame at 1 second mark
      const testFrame = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 1000,
        quality: 1.0,
      });
      console.log("[MediaPipe] SANITY: Test frame extracted:", testFrame.uri);

      // Try absolute path
      let testPath = testFrame.uri;
      if (Platform.OS === "android" && testPath.startsWith("file://")) {
        testPath = testPath.replace("file://", "");
      }

      console.log(
        "[MediaPipe] SANITY: Attempting detection with CPU delegate..."
      );
      const sanityResult = await PoseDetectionOnImage(testPath, modelPath, {
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        shouldOutputSegmentationMasks: false,
        delegate: Delegate.CPU,
      });

      console.log("[MediaPipe] SANITY: ✅ SUCCESS! Raw result structure:", {
        hasResults: !!sanityResult.results,
        resultsLength: sanityResult.results?.length || 0,
        inferenceTime: sanityResult.inferenceTime,
        inputSize: `${sanityResult.inputImageWidth}x${sanityResult.inputImageHeight}`,
        firstResultLandmarks: sanityResult.results?.[0]?.landmarks?.length || 0,
      });

      if (sanityResult.results?.[0]?.landmarks?.[0]?.length > 0) {
        console.log(
          "[MediaPipe] SANITY: Detected",
          sanityResult.results[0].landmarks[0].length,
          "landmarks"
        );
        console.log(
          "[MediaPipe] SANITY: Sample landmark 0 (nose):",
          sanityResult.results[0].landmarks[0][0]
        );
      } else {
        console.warn(
          "[MediaPipe] SANITY: ⚠️ Detection succeeded but returned no landmarks"
        );
      }

      // Clean up test frame
      await FileSystem.deleteAsync(testFrame.uri, { idempotent: true });
      console.log(
        "[MediaPipe] SANITY: Test complete. Proceeding with full extraction..."
      );
    } catch (sanityError: any) {
      console.error(
        "[MediaPipe] SANITY: ❌ FAILED - This indicates fundamental incompatibility"
      );
      console.error(
        "[MediaPipe] SANITY: Error:",
        sanityError?.message || sanityError
      );
      console.error("[MediaPipe] SANITY: Stack:", sanityError?.stack);
      throw new Error(
        `Sanity check failed: ${sanityError?.message || sanityError}. ` +
          `Model or environment incompatible. Try different model variant.`
      );
    }
    console.log("[MediaPipe] ===== SANITY CHECK COMPLETE =====");

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
        console.log(
          `[MediaPipe] Processing frame ${frameIndex} at ${timeMs}ms...`
        );

        // Extract frame as thumbnail image
        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(
          videoUri,
          {
            time: timeMs,
            quality: 1.0, // Maximum quality for better detection
          }
        );

        console.log(`[MediaPipe] Frame ${frameIndex} extracted:`, thumbnailUri);

        // Verify thumbnail exists and log size (helps diagnose path issues)
        try {
          const info = await FileSystem.getInfoAsync(thumbnailUri);
          console.log(`[MediaPipe] Thumb info:`, info as any);
        } catch (e) {
          console.warn(`[MediaPipe] Could not stat thumbnail:`, e);
        }

        // Convert file:// URI to absolute path for Android
        // MediaPipe native module might need path without file:// prefix
        let imagePath = thumbnailUri;
        if (Platform.OS === "android" && imagePath.startsWith("file://")) {
          imagePath = imagePath.replace("file://", "");
          console.log(`[MediaPipe] Converted to path:`, imagePath);
        }

        // Run MediaPipe pose detection on this frame
        console.log(
          `[MediaPipe] Running detectOnImage for frame ${frameIndex}...`
        );

        let result: PoseDetectionResultBundle | undefined;
        try {
          // Use PoseDetectionOnImage API with absolute path
          result = await PoseDetectionOnImage(imagePath, modelPath, {
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            shouldOutputSegmentationMasks: false,
            delegate: Delegate.CPU,
          });
        } catch (detectionError: any) {
          // Retry with file:// URI format
          try {
            console.warn(
              `[MediaPipe] First attempt failed, retry with URI for frame ${frameIndex}`
            );
            result = await PoseDetectionOnImage(thumbnailUri, modelPath, {
              numPoses: 1,
              minPoseDetectionConfidence: 0.5,
              minPosePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
              shouldOutputSegmentationMasks: false,
              delegate: Delegate.CPU,
            });
          } catch (retryError: any) {
            console.error(
              `[MediaPipe] Detection failed on frame ${frameIndex}:`,
              detectionError?.message || detectionError
            );
            console.warn(`[MediaPipe] Model path tried: ${modelPath}`);
            console.warn(
              `[MediaPipe] Error details: ${JSON.stringify({
                firstError: detectionError?.message || String(detectionError),
                retryError: retryError?.message || String(retryError),
                imagePath,
                thumbnailUri,
              })}`
            );
            // Optional GPU fallback for first few frames only
            if (frameIndex < 3) {
              try {
                console.warn(
                  `[MediaPipe] Attempting GPU fallback on frame ${frameIndex}`
                );
                result = await PoseDetectionOnImage(imagePath, modelPath, {
                  numPoses: 1,
                  minPoseDetectionConfidence: 0.4,
                  minPosePresenceConfidence: 0.4,
                  minTrackingConfidence: 0.4,
                  shouldOutputSegmentationMasks: false,
                  delegate: Delegate.GPU,
                });
              } catch (gpuError: any) {
                console.warn(
                  `[MediaPipe] GPU fallback failed frame ${frameIndex}: ${
                    gpuError?.message || gpuError
                  }`
                );
              }
            }
            // Push zero landmarks and continue
            frames.push({
              frame_index: frameIndex,
              landmarks: Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0 }),
            });
            await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
            frameIndex++;
            timeMs += FRAME_INTERVAL_MS;
            continue;
          }
        }

        if (result) {
          console.log(
            `[MediaPipe] Frame ${frameIndex} detection complete (inferenceTime=${result.inferenceTime}ms)`
          );
        } else {
          console.warn(
            `[MediaPipe] Frame ${frameIndex} detection produced no result object`
          );
        }

        // Process detection results
        // result.results is an array of PoseLandmarkerResult
        if (
          result &&
          Array.isArray(result.results) &&
          result.results.length > 0 &&
          result.results[0].landmarks &&
          result.results[0].landmarks.length > 0 &&
          result.results[0].landmarks[0].length > 0
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
      throw new Error("No frames processed. Detection failed on all attempts.");
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

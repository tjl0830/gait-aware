/**
 * MediaPipe Pose Extractor using MediaPipe JS via WebView
 * Extracts pose landmarks from video files by processing frames
 */

import * as FileSystem from "expo-file-system/legacy";
import * as VideoThumbnails from "expo-video-thumbnails";
import { PoseJsonData } from "./landmarkExtractor";
import type { PoseDetectorRef } from "../components/MediaPipePoseDetector";

/**
 * Extract pose landmarks from a video file using MediaPipe JS
 * This function requires a PoseDetectorRef (WebView component) to be passed in
 * @param videoUri - Local file URI of the video
 * @param poseDetector - Reference to the MediaPipePoseDetector component
 * @param onProgress - Callback for progress updates
 * @returns PoseJsonData with all frames and landmarks
 */
export async function extractPoseFromVideo(
  videoUri: string,
  poseDetector: PoseDetectorRef,
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

    // Initialize MediaPipe in WebView
    console.log("[MediaPipe] Initializing pose detector...");
    await poseDetector.initialize();
    console.log("[MediaPipe] Pose detector initialized");

    // Extract frames from video at 10 FPS
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

        // Run MediaPipe pose detection via WebView
        try {
          const landmarks = await poseDetector.detectFrame(
            thumbnailUri,
            frameIndex
          );

          if (landmarks && landmarks.length > 0) {
            // MediaPipe returns 33 landmarks
            const formattedLandmarks = landmarks.map((lm) => ({
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
        } catch (detectionError: any) {
          console.error(
            `[MediaPipe] Detection failed on frame ${frameIndex}:`,
            detectionError?.message || detectionError
          );
          // Push zero landmarks and continue
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

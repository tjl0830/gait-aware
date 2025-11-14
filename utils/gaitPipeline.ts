/**
 * Unified Gait Analysis Pipeline
 * Combines video processing, keypoint extraction, and gait analysis
 */

import * as FileSystem from 'expo-file-system/legacy';
import { analyzeGait, GaitAnalysisResult } from './gaitAnalysis';
import { validatePoseDataQuality, PoseJsonData } from './landmarkExtractor';
import { VIDEO_ERRORS } from './videoValidation';

export interface AnalysisProgress {
  stage: 'extracting' | 'analyzing' | 'complete';
  frameIndex?: number;
  percent?: number;
  message: string;
}

export interface AnalysisResult {
  success: boolean;
  gaitAnalysis?: GaitAnalysisResult;
  error?: string;
  poseData?: {
    frameCount: number;
    validFrameCount: number;
    outputFile: string;
  };
}

/**
 * Run complete gait analysis pipeline
 * 1. Extract keypoints from video (via WebView)
 * 2. Validate pose data quality
 * 3. Analyze gait pattern
 */
export async function runGaitAnalysisPipeline(
  videoUri: string,
  fileName: string,
  webViewRef: any,
  onProgress: (progress: AnalysisProgress) => void
): Promise<AnalysisResult> {
  try {
    // Stage 1: Extract keypoints
    onProgress({
      stage: 'extracting',
      message: 'Extracting pose keypoints from video...',
    });

    const poseResult = await extractKeypointsFromVideo(
      videoUri,
      fileName,
      webViewRef,
      (frameIndex, percent) => {
        onProgress({
          stage: 'extracting',
          frameIndex,
          percent,
          message: `Processing frame ${frameIndex}...`,
        });
      }
    );

    if (!poseResult.success || !poseResult.outputFile) {
      return {
        success: false,
        error: poseResult.error || 'Failed to extract keypoints',
      };
    }

    // Stage 2: Validate pose data
    const poseJson = await FileSystem.readAsStringAsync(
      poseResult.outputFile,
      { encoding: 'utf8' }
    );
    const poseData: PoseJsonData = JSON.parse(poseJson);

    const validation = validatePoseDataQuality(poseData);
    if (!validation.valid) {
      // Provide user-friendly error messages
      let errorMessage = validation.message || 'Invalid pose data';
      
      if (validation.validFrameCount !== undefined) {
        if (validation.validFrameCount === 0) {
          errorMessage = VIDEO_ERRORS.NO_PERSON;
        } else if (validation.validFrameCount < 20) {
          errorMessage = VIDEO_ERRORS.INSUFFICIENT_FRAMES;
        }
      }

      return {
        success: false,
        error: errorMessage,
        poseData: {
          frameCount: poseData.frames.length,
          validFrameCount: validation.validFrameCount || 0,
          outputFile: poseResult.outputFile,
        },
      };
    }

    // Stage 3: Analyze gait
    onProgress({
      stage: 'analyzing',
      message: 'Analyzing gait pattern...',
    });

    const gaitAnalysis = await analyzeGait(poseData);

    onProgress({
      stage: 'complete',
      message: 'Analysis complete',
    });

    return {
      success: true,
      gaitAnalysis,
      poseData: {
        frameCount: poseData.frames.length,
        validFrameCount: validation.validFrameCount || 0,
        outputFile: poseResult.outputFile,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Analysis failed',
    };
  }
}

/**
 * Extract keypoints from video using WebView
 */
function extractKeypointsFromVideo(
  videoUri: string,
  fileName: string,
  webViewRef: any,
  onProgress: (frameIndex: number, percent: number) => void
): Promise<{ success: boolean; outputFile?: string; error?: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      // Read video as base64
      const base64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: 'base64',
      });

      // Set up message handler
      const messageHandler = async (event: any) => {
        try {
          const message = JSON.parse(event.nativeEvent.data);

          switch (message.type) {
            case 'progress':
              onProgress(message.frameIndex, message.percent);
              break;

            case 'complete':
              if (!message.results) {
                resolve({
                  success: false,
                  error: 'No results returned from pose detection',
                });
                return;
              }

              // Save results to file
              const baseName = fileName?.split('.')[0] || 'video';
              const posesDir = `${FileSystem.documentDirectory}poses`;
              const outputFile = `${posesDir}/${baseName}_pose.json`;

              await FileSystem.makeDirectoryAsync(posesDir, {
                intermediates: true,
              });
              await FileSystem.writeAsStringAsync(
                outputFile,
                JSON.stringify(message.results, null, 2),
                { encoding: 'utf8' }
              );

              resolve({
                success: true,
                outputFile,
              });
              break;

            case 'error':
              resolve({
                success: false,
                error: message.message || 'Pose detection failed',
              });
              break;
          }
        } catch (err: any) {
          resolve({
            success: false,
            error: err.message || 'Failed to process results',
          });
        }
      };

      // Attach handler (note: in real implementation, this needs proper event handling)
      // For now, this is a placeholder - the actual implementation should use
      // the existing WebView message handler pattern

      // Send video to WebView for processing
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'process_video',
          video: `data:video/mp4;base64,${base64}`,
          options: {
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.4,
            fps: 30,
          },
        })
      );
    } catch (error: any) {
      resolve({
        success: false,
        error: error.message || 'Failed to read video',
      });
    }
  });
}

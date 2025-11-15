/**
 * MediaPipe Web Bridge
 * Uses MediaPipe JS in a hidden WebView to extract pose landmarks from video frames
 * This approach uses Google's official MediaPipe implementation via WebView bridge
 */

import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

/**
 * HTML page that loads MediaPipe JS and processes frames
 * This will be loaded in a hidden WebView
 */
export function getMediaPipeHTML(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js" crossorigin="anonymous"></script>
  <style>
    body { margin: 0; padding: 0; background: #000; }
    #output { display: none; }
  </style>
</head>
<body>
  <canvas id="output" width="640" height="480"></canvas>
  
  <script>
    let pose = null;
    let isInitialized = false;
    let processingQueue = [];
    let currentProcessing = false;

    // Initialize MediaPipe Pose
    async function initializePose() {
      console.log('[MediaPipe Web] Initializing Pose...');
      
      pose = new Pose({
        locateFile: (file) => {
          return \`https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/\${file}\`;
        }
      });

      pose.setOptions({
        modelComplexity: 1, // 0=lite, 1=full, 2=heavy
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults(onPoseResults);

      await pose.initialize();
      isInitialized = true;
      
      // Notify React Native that we're ready
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'initialized',
        success: true
      }));
      
      console.log('[MediaPipe Web] Pose initialized successfully');
    }

    // Handle pose detection results
    function onPoseResults(results) {
      const message = {
        type: 'landmarks',
        frameIndex: results.frameIndex || 0,
        landmarks: results.poseLandmarks || [],
        worldLandmarks: results.poseWorldLandmarks || []
      };
      
      // Send results back to React Native
      window.ReactNativeWebView?.postMessage(JSON.stringify(message));
      
      currentProcessing = false;
      processNextFrame();
    }

    // Process next frame in queue
    function processNextFrame() {
      if (currentProcessing || processingQueue.length === 0) {
        return;
      }

      currentProcessing = true;
      const frame = processingQueue.shift();
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = async () => {
        try {
          await pose.send({ image: img, frameIndex: frame.frameIndex });
        } catch (error) {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'error',
            frameIndex: frame.frameIndex,
            message: error.message || 'Detection failed'
          }));
          currentProcessing = false;
          processNextFrame();
        }
      };
      
      img.onerror = () => {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'error',
          frameIndex: frame.frameIndex,
          message: 'Failed to load image'
        }));
        currentProcessing = false;
        processNextFrame();
      };
      
      img.src = frame.imageData;
    }

    // Handle messages from React Native
    window.addEventListener('message', (event) => {
      const data = event.data;
      
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data);
          handleMessage(message);
        } catch (e) {
          console.error('[MediaPipe Web] Failed to parse message:', e);
        }
      } else if (data && typeof data === 'object') {
        handleMessage(data);
      }
    });

    function handleMessage(message) {
      if (message.type === 'initialize') {
        if (!isInitialized) {
          initializePose();
        }
      } else if (message.type === 'detectFrame') {
        if (!isInitialized) {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'error',
            message: 'Pose not initialized'
          }));
          return;
        }
        
        processingQueue.push({
          imageData: message.imageData,
          frameIndex: message.frameIndex
        });
        
        if (!currentProcessing) {
          processNextFrame();
        }
      } else if (message.type === 'reset') {
        processingQueue = [];
        currentProcessing = false;
      }
    }

    // Auto-initialize on load
    window.addEventListener('load', () => {
      console.log('[MediaPipe Web] Page loaded, ready to initialize');
    });
  </script>
</body>
</html>
  `;
}

/**
 * Message types for WebView communication
 */
export interface MediaPipeMessage {
  type: "initialized" | "landmarks" | "error" | "progress";
  frameIndex?: number;
  landmarks?: Array<{ x: number; y: number; z: number; visibility: number }>;
  worldLandmarks?: Array<{ x: number; y: number; z: number; visibility: number }>;
  message?: string;
  success?: boolean;
}

/**
 * Convert base64 image to data URI
 */
export async function imageToDataUri(imagePath: string): Promise<string> {
  try {
    // Read image as base64
    const base64 = await FileSystem.readAsStringAsync(imagePath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Detect image type from path
    let mimeType = "image/jpeg";
    if (imagePath.toLowerCase().endsWith(".png")) {
      mimeType = "image/png";
    } else if (imagePath.toLowerCase().endsWith(".jpg") || imagePath.toLowerCase().endsWith(".jpeg")) {
      mimeType = "image/jpeg";
    }

    return `data:${mimeType};base64,${base64}`;
  } catch (error: any) {
    throw new Error(`Failed to convert image to data URI: ${error.message}`);
  }
}

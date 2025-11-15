/**
 * MediaPipe Pose Detector Component
 * Hidden WebView that runs MediaPipe JS for pose detection
 */

import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import {
  getMediaPipeHTML,
  imageToDataUri,
  type MediaPipeMessage,
} from "../utils/mediapipeWebBridge";

export interface PoseDetectorRef {
  initialize: () => Promise<void>;
  detectFrame: (
    imagePath: string,
    frameIndex: number
  ) => Promise<Array<{ x: number; y: number; z: number; visibility: number }>>;
  reset: () => void;
}

interface Props {
  onError?: (error: string) => void;
}

export const MediaPipePoseDetector = forwardRef<PoseDetectorRef, Props>(
  ({ onError }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const isInitializedRef = useRef(false);
    const pendingFramesRef = useRef<
      Map<
        number,
        {
          resolve: (
            landmarks: Array<{
              x: number;
              y: number;
              z: number;
              visibility: number;
            }>
          ) => void;
          reject: (error: Error) => void;
        }
      >
    >(new Map());

    // Handle messages from WebView
    const handleMessage = (event: any) => {
      try {
        const message: MediaPipeMessage = JSON.parse(event.nativeEvent.data);

        if (message.type === "initialized") {
          console.log("[MediaPipe] WebView initialized successfully");
          isInitializedRef.current = true;
        } else if (message.type === "landmarks") {
          const frameIndex = message.frameIndex ?? 0;
          const pending = pendingFramesRef.current.get(frameIndex);

          if (pending) {
            const landmarks = message.landmarks || [];
            pending.resolve(landmarks);
            pendingFramesRef.current.delete(frameIndex);
          }
        } else if (message.type === "error") {
          const frameIndex = message.frameIndex ?? -1;
          const errorMsg = message.message || "Unknown error";

          if (frameIndex >= 0) {
            const pending = pendingFramesRef.current.get(frameIndex);
            if (pending) {
              pending.reject(new Error(errorMsg));
              pendingFramesRef.current.delete(frameIndex);
            }
          }

          onError?.(errorMsg);
          console.error("[MediaPipe] Error:", errorMsg);
        }
      } catch (error: any) {
        console.error("[MediaPipe] Failed to handle message:", error);
      }
    };

    // Initialize MediaPipe in WebView
    const initialize = async (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (isInitializedRef.current) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error("MediaPipe initialization timeout"));
        }, 10000);

        const checkInit = setInterval(() => {
          if (isInitializedRef.current) {
            clearTimeout(timeout);
            clearInterval(checkInit);
            resolve();
          }
        }, 100);

        webViewRef.current?.postMessage(
          JSON.stringify({ type: "initialize" })
        );
      });
    };

    // Detect pose in a single frame
    const detectFrame = async (
      imagePath: string,
      frameIndex: number
    ): Promise<
      Array<{ x: number; y: number; z: number; visibility: number }>
    > => {
      if (!isInitializedRef.current) {
        throw new Error("MediaPipe not initialized");
      }

      return new Promise(async (resolve, reject) => {
        try {
          // Convert image to data URI
          const imageData = await imageToDataUri(imagePath);

          // Store promise callbacks
          pendingFramesRef.current.set(frameIndex, { resolve, reject });

          // Send to WebView
          webViewRef.current?.postMessage(
            JSON.stringify({
              type: "detectFrame",
              imageData,
              frameIndex,
            })
          );

          // Timeout after 10 seconds
          setTimeout(() => {
            if (pendingFramesRef.current.has(frameIndex)) {
              pendingFramesRef.current.delete(frameIndex);
              reject(new Error(`Frame ${frameIndex} detection timeout`));
            }
          }, 10000);
        } catch (error: any) {
          pendingFramesRef.current.delete(frameIndex);
          reject(error);
        }
      });
    };

    // Reset detector state
    const reset = () => {
      pendingFramesRef.current.clear();
      webViewRef.current?.postMessage(JSON.stringify({ type: "reset" }));
    };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      initialize,
      detectFrame,
      reset,
    }));

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html: getMediaPipeHTML() }}
          onMessage={handleMessage}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={["*"]}
          mixedContentMode="always"
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error("[MediaPipe] WebView error:", nativeEvent);
            onError?.(
              `WebView error: ${nativeEvent.description || "Unknown"}`
            );
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error("[MediaPipe] HTTP error:", nativeEvent.statusCode);
          }}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: -10000,
    top: -10000,
    width: 1,
    height: 1,
    opacity: 0,
  },
  webview: {
    width: 640,
    height: 480,
    backgroundColor: "transparent",
  },
});

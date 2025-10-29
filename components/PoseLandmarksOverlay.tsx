/**
 * PoseLandmarksOverlay Component
 * Draws pose skeleton overlay on video using Skia
 */

import { Canvas, Circle, Line, vec } from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, View } from "react-native";
import type { PoseLandmarkerResult } from "react-native-mediapipe";
import { LandmarkIndices } from "../utils/poseDetection";

interface PoseLandmarksOverlayProps {
  poseResult: PoseLandmarkerResult | null;
  videoWidth?: number;
  videoHeight?: number;
}

// Define skeleton connections based on MediaPipe pose model
const POSE_CONNECTIONS = [
  // Face
  [LandmarkIndices.NOSE, LandmarkIndices.LEFT_EYE],
  [LandmarkIndices.NOSE, LandmarkIndices.RIGHT_EYE],
  [LandmarkIndices.LEFT_EYE, LandmarkIndices.LEFT_EAR],
  [LandmarkIndices.RIGHT_EYE, LandmarkIndices.RIGHT_EAR],

  // Torso
  [LandmarkIndices.LEFT_SHOULDER, LandmarkIndices.RIGHT_SHOULDER],
  [LandmarkIndices.LEFT_SHOULDER, LandmarkIndices.LEFT_HIP],
  [LandmarkIndices.RIGHT_SHOULDER, LandmarkIndices.RIGHT_HIP],
  [LandmarkIndices.LEFT_HIP, LandmarkIndices.RIGHT_HIP],

  // Left Arm
  [LandmarkIndices.LEFT_SHOULDER, LandmarkIndices.LEFT_ELBOW],
  [LandmarkIndices.LEFT_ELBOW, LandmarkIndices.LEFT_WRIST],
  [LandmarkIndices.LEFT_WRIST, LandmarkIndices.LEFT_PINKY],
  [LandmarkIndices.LEFT_WRIST, LandmarkIndices.LEFT_INDEX],
  [LandmarkIndices.LEFT_WRIST, LandmarkIndices.LEFT_THUMB],

  // Right Arm
  [LandmarkIndices.RIGHT_SHOULDER, LandmarkIndices.RIGHT_ELBOW],
  [LandmarkIndices.RIGHT_ELBOW, LandmarkIndices.RIGHT_WRIST],
  [LandmarkIndices.RIGHT_WRIST, LandmarkIndices.RIGHT_PINKY],
  [LandmarkIndices.RIGHT_WRIST, LandmarkIndices.RIGHT_INDEX],
  [LandmarkIndices.RIGHT_WRIST, LandmarkIndices.RIGHT_THUMB],

  // Left Leg
  [LandmarkIndices.LEFT_HIP, LandmarkIndices.LEFT_KNEE],
  [LandmarkIndices.LEFT_KNEE, LandmarkIndices.LEFT_ANKLE],
  [LandmarkIndices.LEFT_ANKLE, LandmarkIndices.LEFT_HEEL],
  [LandmarkIndices.LEFT_ANKLE, LandmarkIndices.LEFT_FOOT_INDEX],
  [LandmarkIndices.LEFT_HEEL, LandmarkIndices.LEFT_FOOT_INDEX],

  // Right Leg
  [LandmarkIndices.RIGHT_HIP, LandmarkIndices.RIGHT_KNEE],
  [LandmarkIndices.RIGHT_KNEE, LandmarkIndices.RIGHT_ANKLE],
  [LandmarkIndices.RIGHT_ANKLE, LandmarkIndices.RIGHT_HEEL],
  [LandmarkIndices.RIGHT_ANKLE, LandmarkIndices.RIGHT_FOOT_INDEX],
  [LandmarkIndices.RIGHT_HEEL, LandmarkIndices.RIGHT_FOOT_INDEX],
];

export function PoseLandmarksOverlay({
  poseResult,
  videoWidth = 320,
  videoHeight = 200,
}: PoseLandmarksOverlayProps) {
  if (
    !poseResult ||
    !poseResult.landmarks ||
    poseResult.landmarks.length === 0
  ) {
    return null;
  }

  // Get the first detected pose
  const landmarks = poseResult.landmarks[0];

  return (
    <View
      style={[styles.container, { width: videoWidth, height: videoHeight }]}
    >
      <Canvas style={{ flex: 1 }}>
        {/* Draw skeleton connections */}
        {POSE_CONNECTIONS.map((connection, index) => {
          const [startIdx, endIdx] = connection;
          const start = landmarks[startIdx];
          const end = landmarks[endIdx];

          if (!start || !end) return null;

          // Convert normalized coordinates (0-1) to canvas coordinates
          const x1 = start.x * videoWidth;
          const y1 = start.y * videoHeight;
          const x2 = end.x * videoWidth;
          const y2 = end.y * videoHeight;

          // Use visibility score to determine line opacity
          const opacity = Math.min(start.visibility || 1, end.visibility || 1);

          return (
            <Line
              key={`line-${index}`}
              p1={vec(x1, y1)}
              p2={vec(x2, y2)}
              color={`rgba(0, 255, 0, ${opacity})`}
              strokeWidth={2}
            />
          );
        })}

        {/* Draw landmark points */}
        {landmarks.map((landmark, index) => {
          if (!landmark) return null;

          const x = landmark.x * videoWidth;
          const y = landmark.y * videoHeight;
          const visibility = landmark.visibility || 1;

          // Different colors for key landmarks
          let color = `rgba(255, 255, 255, ${visibility})`; // Default: white

          // Highlight key gait analysis landmarks
          const keyLandmarks = [
            LandmarkIndices.LEFT_HIP,
            LandmarkIndices.RIGHT_HIP,
            LandmarkIndices.LEFT_KNEE,
            LandmarkIndices.RIGHT_KNEE,
            LandmarkIndices.LEFT_ANKLE,
            LandmarkIndices.RIGHT_ANKLE,
          ];

          if (keyLandmarks.includes(index as (typeof keyLandmarks)[number])) {
            color = `rgba(255, 0, 0, ${visibility})`; // Red for lower body
          }

          return (
            <Circle key={`point-${index}`} cx={x} cy={y} r={4} color={color} />
          );
        })}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});

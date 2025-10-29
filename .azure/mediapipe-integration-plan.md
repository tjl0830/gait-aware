# MediaPipe Integration Plan for GaitAware

## Overview

This document outlines the step-by-step plan for integrating MediaPipe pose estimation into the GaitAware thesis project. MediaPipe will enable real-time pose detection from walking videos, extracting 33 body landmarks for gait parameter analysis.

---

## Phase 2.1: Setup Dependencies & Environment

### Install Required Packages

#### 1. MediaPipe Core Package

```bash
npx expo install react-native-mediapipe
```

**Package:** `react-native-mediapipe` by @cdiddy77

- Provides pose detection, face landmark detection, object detection
- Supports both IMAGE and LIVE_STREAM running modes
- Returns 33 pose landmarks (nose, eyes, shoulders, hips, knees, ankles, etc.)

#### 2. Vision Camera (Required Dependency)

```bash
npx expo install react-native-vision-camera
```

**Purpose:**

- MediaPipe uses Vision Camera's frame processor API
- Required for LIVE_STREAM mode (camera feed)
- Also needed for VIDEO mode (our primary use case)

#### 3. Skia Graphics (For Visualization)

```bash
npx expo install @shopify/react-native-skia
```

**Purpose:**

- Draw pose landmarks and connections on video frames
- Render skeleton overlay for user feedback
- High-performance graphics rendering

#### 4. Reanimated Worklets (Already Installed ✅)

```bash
# Already in package.json: react-native-reanimated: ~4.1.1
```

**Purpose:**

- Required by react-native-mediapipe for frame processing
- Enables high-performance worklet-based processing

---

## Phase 2.2: Download MediaPipe Models

### Model Options (Pose Landmarker)

**Source:** Google MediaPipe Models Repository

| Model     | Accuracy | Speed  | Size    | Use Case                   |
| --------- | -------- | ------ | ------- | -------------------------- |
| **Lite**  | Good     | Fast   | ~4.3 MB | Real-time, low-end devices |
| **Full**  | Better   | Medium | ~5.5 MB | Balanced (Recommended)     |
| **Heavy** | Best     | Slow   | ~6.0 MB | Highest accuracy           |

**Recommendation:** Start with **`pose_landmarker_full.task`** for clinical-grade accuracy.

### Download URLs

```bash
# Lite Model
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task

# Full Model (Recommended)
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task

# Heavy Model
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
```

### Asset Management

1. Create `assets/models/` directory
2. Download model files to `assets/models/`
3. Configure `react-native.config.js` to bundle models:

```javascript
// react-native.config.js (CREATE THIS FILE)
module.exports = {
  assets: ["./assets/models"],
};
```

4. **Important:** After adding models, rebuild the development build with EAS:
   ```bash
   eas build --profile development --platform android
   ```
   ⚠️ **Native modules require new development build!**

---

## Phase 2.3: Code Implementation

### File Structure

```
gait-aware/
├── app/
│   └── (tabs)/
│       ├── index.tsx              # Video upload (existing)
│       └── analysis.tsx           # NEW: Pose analysis screen
├── components/
│   ├── PoseAnalyzer.tsx           # NEW: Pose detection component
│   ├── PoseLandmarksOverlay.tsx   # NEW: Skeleton visualization
│   └── GaitMetricsDisplay.tsx     # NEW: Display calculated metrics
├── utils/
│   ├── poseDetection.ts           # NEW: MediaPipe wrapper functions
│   └── gaitCalculations.ts        # NEW: Calculate gait parameters
└── assets/
    └── models/
        └── pose_landmarker_full.task
```

### Implementation Steps

#### Step 1: Create Pose Detection Utility

**File:** `utils/poseDetection.ts`

```typescript
import {
  PoseDetectionOnImage,
  type PoseLandmarkerResult,
} from "react-native-mediapipe";

export async function detectPoseInImage(
  videoFramePath: string
): Promise<PoseLandmarkerResult> {
  try {
    const result = await PoseDetectionOnImage(
      videoFramePath,
      "pose_landmarker_full.task",
      {
        numPoses: 1, // Detect one person at a time
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        shouldOutputSegmentationMasks: false,
        delegate: "GPU", // Use GPU acceleration
      }
    );
    return result;
  } catch (error) {
    console.error("Pose detection failed:", error);
    throw error;
  }
}
```

#### Step 2: Create Gait Calculations Module

**File:** `utils/gaitCalculations.ts`

```typescript
import { type Landmark } from "react-native-mediapipe";

// MediaPipe landmark indices
export const KnownPoseLandmarks = {
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
};

export interface GaitMetrics {
  walkingSpeed: number; // meters per second
  cadence: number; // steps per minute
  stepLength: number; // meters
  strideLength: number; // meters
  gaitCycle: number; // seconds
}

/**
 * Calculate gait parameters from pose landmarks across video frames
 * Reference: janstenum/GaitAnalysis-PoseEstimation, batking24/OpenPose-for-2D-Gait-Analysis
 */
export function calculateGaitMetrics(
  landmarkFrames: Landmark[][][], // Array of frames, each containing array of landmarks
  frameRate: number, // Video frame rate (fps)
  videoHeight: number, // Video height in pixels
  videoWidth: number // Video width in pixels
): GaitMetrics {
  // TODO: Implement gait calculations
  // Algorithm from research papers:
  // 1. Detect heel strikes (local minima in ankle y-coordinate)
  // 2. Calculate step length (distance between consecutive heel strikes)
  // 3. Calculate stride length (2 × step length)
  // 4. Calculate cadence (steps per minute)
  // 5. Calculate walking speed (stride length × cadence / 60)

  return {
    walkingSpeed: 0,
    cadence: 0,
    stepLength: 0,
    strideLength: 0,
    gaitCycle: 0,
  };
}

/**
 * Convert pixel coordinates to real-world meters
 * Requires calibration (e.g., user height input)
 */
export function pixelsToMeters(
  pixels: number,
  userHeightMeters: number,
  landmarkHeight: number
): number {
  // Use user's actual height to calibrate pixel-to-meter conversion
  return (pixels / landmarkHeight) * userHeightMeters;
}
```

#### Step 3: Create Pose Analyzer Component

**File:** `components/PoseAnalyzer.tsx`

```typescript
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Button,
  StyleSheet,
} from "react-native";
import { detectPoseInImage } from "@/utils/poseDetection";
import type { PoseLandmarkerResult } from "react-native-mediapipe";

interface PoseAnalyzerProps {
  videoUri: string;
  onAnalysisComplete: (results: PoseLandmarkerResult[]) => void;
}

export function PoseAnalyzer({
  videoUri,
  onAnalysisComplete,
}: PoseAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const analyzeVideo = useCallback(async () => {
    setIsAnalyzing(true);
    setProgress(0);

    try {
      // TODO: Extract video frames using expo-av or expo-video
      // For now, placeholder for frame extraction
      const frames: string[] = []; // Array of frame file paths

      const results: PoseLandmarkerResult[] = [];

      for (let i = 0; i < frames.length; i++) {
        const result = await detectPoseInImage(frames[i]);
        results.push(result);
        setProgress(((i + 1) / frames.length) * 100);
      }

      onAnalysisComplete(results);
    } catch (error) {
      console.error("Video analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [videoUri, onAnalysisComplete]);

  return (
    <View style={styles.container}>
      {isAnalyzing ? (
        <>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.progressText}>
            Analyzing: {progress.toFixed(0)}%
          </Text>
        </>
      ) : (
        <Button title="Analyze Gait" onPress={analyzeVideo} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
  },
  progressText: {
    marginTop: 10,
    fontSize: 16,
  },
});
```

#### Step 4: Create Skeleton Visualization Component

**File:** `components/PoseLandmarksOverlay.tsx`

```typescript
import React from "react";
import { StyleSheet } from "react-native";
import { Canvas, Points, type SkPoint } from "@shopify/react-native-skia";
import type { Landmark } from "react-native-mediapipe";

// MediaPipe pose landmark connections (skeleton lines)
const POSE_CONNECTIONS = [
  [11, 12], // Shoulders
  [11, 13], // Left arm
  [13, 15], // Left elbow
  [12, 14], // Right arm
  [14, 16], // Right elbow
  [11, 23], // Left torso
  [12, 24], // Right torso
  [23, 24], // Hips
  [23, 25], // Left thigh
  [25, 27], // Left shin
  [24, 26], // Right thigh
  [26, 28], // Right shin
  [27, 29], // Left ankle
  [28, 30], // Right ankle
  [29, 31], // Left foot
  [30, 32], // Right foot
];

interface PoseLandmarksOverlayProps {
  landmarks: Landmark[];
  width: number;
  height: number;
}

export function PoseLandmarksOverlay({
  landmarks,
  width,
  height,
}: PoseLandmarksOverlayProps) {
  // Convert normalized landmarks (0-1) to pixel coordinates
  const points: SkPoint[] = landmarks.map((landmark) => ({
    x: landmark.x * width,
    y: landmark.y * height,
  }));

  // Create connection lines
  const connectionPoints: SkPoint[] = [];
  for (const [a, b] of POSE_CONNECTIONS) {
    connectionPoints.push(points[a], points[b]);
  }

  return (
    <Canvas style={[styles.canvas, { width, height }]}>
      {/* Draw skeleton lines */}
      <Points
        points={connectionPoints}
        mode="lines"
        color="lightblue"
        style="stroke"
        strokeWidth={3}
      />
      {/* Draw landmark points */}
      <Points
        points={connectionPoints}
        mode="points"
        color="red"
        style="stroke"
        strokeWidth={10}
        strokeCap="round"
      />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
```

#### Step 5: Update Tab Navigation

**File:** `app/(tabs)/_layout.tsx`

Add new "Analysis" tab (after Record, Glossary, History):

```typescript
<Tabs.Screen
  name="analysis"
  options={{
    title: "Analysis",
    tabBarIcon: ({ color }) => <TabBarIcon name="bar-chart" color={color} />,
  }}
/>
```

#### Step 6: Create Analysis Screen

**File:** `app/(tabs)/analysis.tsx`

```typescript
import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { PoseAnalyzer } from "@/components/PoseAnalyzer";
import type { PoseLandmarkerResult } from "react-native-mediapipe";

export default function AnalysisScreen() {
  const [results, setResults] = useState<PoseLandmarkerResult[] | null>(null);

  const handleAnalysisComplete = (analysisResults: PoseLandmarkerResult[]) => {
    setResults(analysisResults);
    // TODO: Calculate gait metrics from results
    // TODO: Display results to user
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gait Analysis</Text>
      {/* TODO: Add video picker/selector */}
      <PoseAnalyzer
        videoUri="" // Pass selected video URI
        onAnalysisComplete={handleAnalysisComplete}
      />
      {results && (
        <Text>Analysis complete: {results.length} frames processed</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
});
```

---

## Phase 2.4: Video Frame Extraction

### Challenge

MediaPipe processes **images**, but we have **videos**. We need to extract frames.

### Options

#### Option A: Use `expo-video` (Current Dependency ✅)

```typescript
import { useVideoPlayer, VideoView } from "expo-video";

// Seek to specific timestamp and capture frame
async function extractFrame(
  videoUri: string,
  timestamp: number
): Promise<string> {
  // TODO: Implement frame extraction
  // May require expo-image-manipulator or expo-file-system
}
```

#### Option B: Use `expo-av` (Current Dependency ✅)

```typescript
import { Video } from "expo-av";

// Capture screenshots at intervals
```

#### Option C: Server-Side Processing (Future Enhancement)

- Upload video to backend
- Extract frames with FFmpeg
- Process with MediaPipe
- Return results

**Recommendation:** Start with Option A/B (on-device processing for privacy).

---

## Phase 2.5: Build & Test

### Rebuild Development Build

```bash
# MediaPipe is a NATIVE module - requires new dev build!
eas build --profile development --platform android
```

### Install New Build

```bash
# Download and install new .apk from EAS
# Or use: adb install path/to/new-build.apk
```

### Test Workflow

1. Open app on emulator/device
2. Navigate to "Record" tab
3. Upload test walking video
4. Navigate to "Analysis" tab
5. Select uploaded video
6. Click "Analyze Gait"
7. Verify pose landmarks detected
8. Check gait metrics calculated

---

## Phase 2.6: Next Steps (Post-Integration)

### Gait Algorithm Implementation

- [ ] Implement heel strike detection
- [ ] Calculate step length from landmarks
- [ ] Calculate stride length
- [ ] Calculate cadence
- [ ] Calculate walking speed
- [ ] Validate against reference implementations:
  - `janstenum/GaitAnalysis-PoseEstimation` (Python)
  - `batking24/OpenPose-for-2D-Gait-Analysis` (MATLAB)

### Clinical UI Development

- [ ] Two-tier results display:
  - **Public View:** Simplified metrics (speed, cadence)
  - **Clinical View:** Detailed biomechanics
- [ ] Historical tracking (store results in AsyncStorage/SQLite)
- [ ] Export to PDF (share with healthcare providers)
- [ ] Visual charts (react-native-chart-kit or Victory Native)

### Performance Optimization

- [ ] Profile frame processing speed
- [ ] Consider switching models (Lite vs Full vs Heavy)
- [ ] Implement frame sampling (e.g., analyze every 3rd frame)
- [ ] Add progress indicators for long videos

### Error Handling

- [ ] Handle no person detected
- [ ] Handle multiple people in frame
- [ ] Handle poor lighting conditions
- [ ] Add user guidance (camera angle, distance, lighting)

---

## Success Criteria

✅ **Phase 2 Complete When:**

1. MediaPipe successfully detects poses in uploaded videos
2. 33 landmarks extracted from walking videos
3. Skeleton overlay visualized on video
4. Basic gait metrics calculated (speed, cadence, step length)
5. Results displayed to user
6. All changes committed to `feat/mediapipe-integration` branch
7. New development build created with MediaPipe included
8. Team documentation updated with new features

---

## References

### Documentation

- MediaPipe Pose Landmarker: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
- react-native-mediapipe: https://github.com/cdiddy77/react-native-mediapipe
- Vision Camera: https://react-native-vision-camera.com/

### Research Implementations

- janstenum/GaitAnalysis-PoseEstimation: https://github.com/janstenum/GaitAnalysis-PoseEstimation
- batking24/OpenPose-for-2D-Gait-Analysis: https://github.com/batking24/OpenPose-for-2D-Gait-Analysis

### Thesis Context

- GaitAware Project: https://github.com/zalzon/activities/issues/1
- Development Roadmap: https://github.com/zalzon/activities/issues/2

---

## Timeline Estimate

| Task                       | Duration      | Status         |
| -------------------------- | ------------- | -------------- |
| Install dependencies       | 1 hour        | 🔲 Not Started |
| Download models            | 30 min        | 🔲 Not Started |
| Setup asset bundling       | 1 hour        | 🔲 Not Started |
| Create utility modules     | 2 hours       | 🔲 Not Started |
| Create components          | 3 hours       | 🔲 Not Started |
| Implement frame extraction | 4 hours       | 🔲 Not Started |
| Build & test               | 2 hours       | 🔲 Not Started |
| **Total**                  | **~14 hours** |                |

---

## Next Immediate Action

**Start with Step 1: Install Dependencies**

```bash
# 1. Install MediaPipe
npx expo install react-native-mediapipe

# 2. Install Vision Camera
npx expo install react-native-vision-camera

# 3. Install Skia
npx expo install @shopify/react-native-skia

# 4. Verify installations
npm ls react-native-mediapipe react-native-vision-camera @shopify/react-native-skia
```

After successful installation, proceed to download models and configure asset bundling.

---

**End of MediaPipe Integration Plan**

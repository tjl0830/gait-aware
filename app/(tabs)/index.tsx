/**
 * Gait Analysis - Main Screen
 * Using MediaPipe JS via WebView for reliable offline pose detection
 * Upload Video → Extract Pose (MediaPipe) → Analyze Gait (BiLSTM) → View Results
 */

import * as FileSystem from "expo-file-system/legacy";
import { useVideoPlayer } from "expo-video";
import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { VideoPicker } from "../../components/VideoPicker";
import { VideoPreview } from "../../components/VideoPreview";
import { useVideoPickerLogic } from "../../components/hooks/useVideoPickerLogic";
import { analyzeGait, GaitAnalysisResult } from "../../utils/gaitAnalysis";
import { validatePoseDataQuality } from "../../utils/landmarkExtractor";
import { extractPoseFromVideo } from "../../utils/mediapipePoseExtractor";
import {
  getVideoRequirements,
  validateVideo,
} from "../../utils/videoValidation";
import {
  MediaPipePoseDetector,
  type PoseDetectorRef,
} from "../../components/MediaPipePoseDetector";

export default function GaitAnalysisScreen() {
  const { videoUri, fileName, pickVideo } = useVideoPickerLogic();
  const poseDetectorRef = useRef<PoseDetectorRef>(null);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{
    stage: string;
    frameIndex?: number;
    percent?: number;
  }>({ stage: "idle" });
  const [result, setResult] = useState<GaitAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Video player
  const player = useVideoPlayer(videoUri, (player) => {
    if (player) {
      player.loop = true;
      player.audioTrack = null;
      player.play();
    }
  });

  // Main analysis function
  const handleAnalyzeGait = async () => {
    if (!videoUri || !fileName) {
      setError("Please select a video first");
      return;
    }

    if (!poseDetectorRef.current) {
      setError("MediaPipe detector not initialized");
      return;
    }

    // Reset state
    setResult(null);
    setError(null);
    setAnalyzing(true);
    setProgress({ stage: "preparing" });

    try {
      // Validate video
      const videoValidation = await validateVideo(videoUri, fileName);
      if (!videoValidation.valid) {
        throw new Error(videoValidation.error);
      }

      if (videoValidation.warnings && videoValidation.warnings.length > 0) {
        Alert.alert("Note", videoValidation.warnings.join("\n"));
      }

      console.log("Starting pose extraction with MediaPipe JS...");
      setProgress({ stage: "extracting", percent: 0 });

      // Extract pose using MediaPipe WebView
      const poseData = await extractPoseFromVideo(
        videoUri,
        poseDetectorRef.current,
        (frameIndex: number, totalFrames: number) => {
          const percent = Math.round((frameIndex / totalFrames) * 100);
          setProgress({ stage: "extracting", frameIndex, percent });
          console.log(
            `Processing frame ${frameIndex}/${totalFrames} (${percent}%)`
          );
        }
      );

      console.log(`Extracted ${poseData.frames.length} frames with pose data`);

      // Save pose data
      const baseName = fileName?.split(".")[0] || "video";
      const posesDir = `${FileSystem.documentDirectory}poses`;
      const outputFile = `${posesDir}/${baseName}_pose.json`;

      await FileSystem.makeDirectoryAsync(posesDir, { intermediates: true });
      await FileSystem.writeAsStringAsync(
        outputFile,
        JSON.stringify(poseData, null, 2),
        { encoding: "utf8" }
      );

      // Validate pose data quality
      setProgress({ stage: "validating" });
      const poseValidation = validatePoseDataQuality(poseData);

      if (!poseValidation.valid) {
        throw new Error(
          poseValidation.message ||
            `Insufficient valid frames: ${poseValidation.validFrameCount}/60 required`
        );
      }

      // Run gait analysis with BiLSTM
      console.log("Running BiLSTM gait analysis...");
      setProgress({ stage: "analyzing" });
      const gaitResult = await analyzeGait(poseData);

      console.log("Gait analysis complete:", gaitResult);
      setResult(gaitResult);
      setError(null);
      setAnalyzing(false);
      setProgress({ stage: "complete" });
    } catch (err: any) {
      console.error("Analysis error:", err);
      const errorMsg = err?.message || err?.toString() || "Analysis failed";
      setError(errorMsg);
      setAnalyzing(false);
      setProgress({ stage: "idle" });
    }
  };

  // Render progress message
  const getProgressMessage = () => {
    switch (progress.stage) {
      case "preparing":
        return "Preparing video...";
      case "extracting":
        const frame = progress.frameIndex || 0;
        const percent = progress.percent ? Math.round(progress.percent) : 0;
        return `Extracting keypoints: frame ${frame} (${percent}%)`;
      case "validating":
        return "Validating pose data...";
      case "analyzing":
        return "Analyzing gait pattern with BiLSTM...";
      case "complete":
        return "Analysis complete!";
      default:
        return "Processing...";
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Hidden MediaPipe detector */}
      <MediaPipePoseDetector
        ref={poseDetectorRef}
        onError={(err) => console.error("[MediaPipe] Error:", err)}
      />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Gait Analysis</Text>
          <Text style={styles.subtitle}>
            Upload a video and analyze walking pattern
          </Text>
        </View>

        {/* Step 1: Upload Video */}
        <View style={styles.card}>
          <Text style={styles.stepTitle}>Step 1: Upload Video</Text>
          <VideoPicker onPress={pickVideo} />
          <VideoPreview uri={videoUri} fileName={fileName} player={player} />

          {videoUri && (
            <View style={styles.requirements}>
              <Text style={styles.requirementsTitle}>Video Requirements:</Text>
              <Text style={styles.requirementsText}>
                {getVideoRequirements()}
              </Text>
            </View>
          )}
        </View>

        {/* Step 2: Analyze Gait */}
        <View style={styles.card}>
          <Text style={styles.stepTitle}>Step 2: Analyze Gait</Text>

          <Button
            title="Analyze Gait Pattern"
            onPress={handleAnalyzeGait}
            disabled={!videoUri || analyzing}
          />

          {analyzing && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.progressText}>{getProgressMessage()}</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>⚠️ Analysis Failed</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>

        {/* Step 3: Results */}
        {result && (
          <View style={styles.card}>
            <Text style={styles.stepTitle}>Results</Text>

            <View
              style={[
                styles.resultCard,
                result.isAbnormal ? styles.abnormalCard : styles.normalCard,
              ]}
            >
              <Text
                style={[
                  styles.resultTitle,
                  result.isAbnormal ? styles.abnormalTitle : styles.normalTitle,
                ]}
              >
                {result.isAbnormal
                  ? "⚠️ Abnormal Gait Detected"
                  : "✓ Normal Gait Pattern"}
              </Text>

              <View style={styles.resultDetails}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Classification:</Text>
                  <Text style={styles.resultValue}>
                    {result.classification}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Confidence:</Text>
                  <Text style={styles.resultValue}>
                    {(result.confidence * 100).toFixed(1)}%
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Mean MSE:</Text>
                  <Text style={styles.resultValue}>
                    {result.abnormalityScore.toFixed(6)}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Threshold:</Text>
                  <Text style={styles.resultValue}>0.174969</Text>
                </View>
              </View>

              <View style={styles.featuresDivider} />

              <Text style={styles.featuresTitle}>Analysis Details:</Text>
              <View style={styles.featuresList}>
                <Text style={styles.featureItem}>
                  • Windows Analyzed: {result.details.numWindows}
                </Text>
                <Text style={styles.featureItem}>
                  • Normal Windows: {result.details.normalWindowCount}
                </Text>
                <Text style={styles.featureItem}>
                  • Abnormal Windows: {result.details.abnormalWindowCount} (
                  {result.details.abnormalPercentage.toFixed(1)}%)
                </Text>
                <Text style={styles.featureItem}>
                  • MSE Range: {result.details.minError.toFixed(6)} -{" "}
                  {result.details.maxError.toFixed(6)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    color: "#000",
  },
  requirements: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f0f8ff",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#007AFF",
  },
  requirementsText: {
    fontSize: 12,
    color: "#333",
    lineHeight: 18,
  },
  progressContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  progressText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  errorContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#ffebee",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#f44336",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#c62828",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#c62828",
    lineHeight: 20,
  },
  resultCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
  },
  normalCard: {
    backgroundColor: "#e8f5e9",
    borderColor: "#4caf50",
  },
  abnormalCard: {
    backgroundColor: "#fff3e0",
    borderColor: "#ff9800",
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  normalTitle: {
    color: "#2e7d32",
  },
  abnormalTitle: {
    color: "#e65100",
  },
  resultDetails: {
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 15,
    color: "#555",
    fontWeight: "500",
  },
  resultValue: {
    fontSize: 15,
    color: "#000",
    fontWeight: "600",
  },
  featuresDivider: {
    height: 1,
    backgroundColor: "#ddd",
    marginVertical: 16,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  featuresList: {
    paddingLeft: 8,
  },
  featureItem: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    lineHeight: 20,
  },
});

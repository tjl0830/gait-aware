/**
 * PoseAnalyzer Component
 * Processes uploaded video to detect poses and calculate gait metrics
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { PoseLandmarkerResult } from "react-native-mediapipe";
import type { GaitMetrics } from "../utils/gaitCalculations";
import { detectPoseInImage } from "../utils/poseDetection";

interface PoseAnalyzerProps {
  videoUri: string | null;
  onAnalysisComplete?: (results: AnalysisResults) => void;
}

export interface AnalysisResults {
  poses: PoseLandmarkerResult[];
  gaitMetrics: GaitMetrics;
  processingTime: number; // milliseconds
}

export function PoseAnalyzer({
  videoUri,
  onAnalysisComplete,
}: PoseAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] =
    useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!videoUri) {
      setError("No video selected");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    const startTime = Date.now();

    try {
      // Phase 1: Single frame analysis
      // TODO: Extract multiple frames from video for full gait cycle analysis
      const poseResult = await detectPoseInImage(videoUri);

      if (
        !poseResult ||
        !poseResult.landmarks ||
        poseResult.landmarks.length === 0
      ) {
        throw new Error("No pose detected in video");
      }

      // TODO: Calculate gait metrics from pose landmarks
      // For now, create placeholder metrics
      const gaitMetrics: GaitMetrics = {
        walkingSpeed: null,
        cadence: null,
        stepLength: null,
        strideLength: null,
      };

      const processingTime = Date.now() - startTime;

      const results: AnalysisResults = {
        poses: [poseResult],
        gaitMetrics,
        processingTime,
      };

      setAnalysisResults(results);
      onAnalysisComplete?.(results);
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!videoUri) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>Upload a video to begin analysis</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Step 3: Analyze Gait</Text>

      <TouchableOpacity
        style={[styles.analyzeButton, isAnalyzing && styles.buttonDisabled]}
        onPress={handleAnalyze}
        disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.buttonText}> Analyzing...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>Analyze Gait</Text>
        )}
      </TouchableOpacity>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {analysisResults && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>✓ Analysis Complete</Text>
          <Text style={styles.resultDetail}>
            Poses detected: {analysisResults.poses.length}
          </Text>
          <Text style={styles.resultDetail}>
            Processing time: {analysisResults.processingTime}ms
          </Text>
          <Text style={styles.resultDetail}>
            Landmarks found: {analysisResults.poses[0]?.landmarks?.length || 0}{" "}
            points per pose
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    marginTop: 24,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  analyzeButton: {
    backgroundColor: "#34C759",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 200,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#A0A0A0",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  hint: {
    color: "#999",
    fontSize: 14,
    fontStyle: "italic",
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#FFE5E5",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 14,
  },
  resultsContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    width: "100%",
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2E7D32",
    marginBottom: 12,
  },
  resultDetail: {
    fontSize: 14,
    color: "#1B5E20",
    marginBottom: 6,
  },
});

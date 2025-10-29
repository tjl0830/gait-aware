import { useVideoPlayer } from "expo-video";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GaitMetricsDisplay } from "../../components/GaitMetricsDisplay";
import { useVideoPickerLogic } from "../../components/hooks/useVideoPickerLogic";
import {
  PoseAnalyzer,
  type AnalysisResults,
} from "../../components/PoseAnalyzer";
import { VideoPicker } from "../../components/VideoPicker";
import { VideoPreview } from "../../components/VideoPreview";
import UserInfo from "../user_info";

export default function Tab() {
  const { videoUri, fileName, pickVideo } = useVideoPickerLogic();
  const [analysisResults, setAnalysisResults] =
    useState<AnalysisResults | null>(null);

  const player = useVideoPlayer(videoUri, (player) => {
    if (player) {
      player.loop = true;
      player.audioTrack = null;
      player.play();
    }
  });

  const handleAnalysisComplete = (results: AnalysisResults) => {
    setAnalysisResults(results);
  };

  return (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.container}>
        {/* Step 1: Upload Video */}
        <View style={styles.videoContainer}>
          <Text style={styles.stepTitle}>Step 1: Upload Video</Text>
          <VideoPicker onPress={pickVideo} />
          <VideoPreview uri={videoUri} fileName={fileName} player={player} />
        </View>

        {/* Step 2: User Information */}
        <UserInfo />

        {/* Step 3: Analyze Gait */}
        <PoseAnalyzer
          videoUri={videoUri}
          onAnalysisComplete={handleAnalysisComplete}
        />

        {/* Step 4: View Results */}
        {analysisResults && (
          <GaitMetricsDisplay metrics={analysisResults.gaitMetrics} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    padding: 32,
    alignItems: "center",
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  videoContainer: {
    width: "100%",
    alignSelf: "center",
    alignItems: "center", // Add this to center children horizontally
    marginTop: 20,
    maxWidth: 600,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 8,
  },
});

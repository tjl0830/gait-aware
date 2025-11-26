import type { VideoPlayer } from "expo-video";
import { VideoView } from "expo-video";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type VideoPreviewProps = {
  uri: string | null;
  fileName: string;
  player: VideoPlayer | null;
  onChangeVideo?: () => void;
};

export function VideoPreview({
  uri,
  fileName,
  player,
  onChangeVideo,
}: VideoPreviewProps) {
  if (!uri) {
    return null;
  }

  return (
    <View style={styles.previewContainer}>
      <VideoView style={styles.video} player={player} allowsPictureInPicture />
      {onChangeVideo && (
        <TouchableOpacity style={styles.changeButton} onPress={onChangeVideo}>
          <Text style={styles.changeButtonText}>Change Video</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  previewContainer: {
    marginTop: 16,
    marginBottom: 16,
    alignItems: "center",
    width: "100%",
  },
  video: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    borderRadius: 12,
  },
  changeButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  changeButtonText: {
    color: "#007AFF",
    fontSize: 15,
    fontWeight: "600",
  },
  fileLabel: {
    marginTop: 8,
    color: "#333",
  },
  hint: {
    marginTop: 12,
    color: "#666",
  },
});

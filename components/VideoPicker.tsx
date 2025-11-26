import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type VideoPickerProps = {
  onPress: () => void;
  isCompressing?: boolean;
};

export function VideoPicker({ onPress, isCompressing }: VideoPickerProps) {
  return (
    <TouchableOpacity
      style={[styles.uploadArea, isCompressing && styles.uploadAreaDisabled]}
      onPress={onPress}
      disabled={isCompressing}
      activeOpacity={0.7}
    >
      <View style={styles.uploadContent}>
        {isCompressing ? (
          <View style={styles.compressingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.compressingText}>Compressing video...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.uploadTitle}>Select Video</Text>
            <Text style={styles.uploadHint}>
              Tap to choose from your device
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  uploadArea: {
    width: "100%",
    backgroundColor: "#f8f9fa",
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadAreaDisabled: {
    opacity: 0.6,
  },
  uploadContent: {
    alignItems: "center",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconText: {
    fontSize: 40,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  uploadHint: {
    fontSize: 14,
    color: "#999",
  },
  compressingContainer: {
    alignItems: "center",
    gap: 12,
  },
  compressingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  compressingHint: {
    fontSize: 14,
    color: "#999",
  },
  uploadButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: "#A0A0A0",
    opacity: 0.6,
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

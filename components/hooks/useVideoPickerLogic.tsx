import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert } from "react-native";

export function useVideoPickerLogic() {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  async function pickVideo() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission required",
          "Permission to access media library is required to pick a video."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
      });

      const cancelled = (result as any).cancelled ?? (result as any).canceled;
      if (cancelled) return;

      const assets = (result as any).assets ?? [];
      const asset = assets[0];

      if (asset.duration > 15000) {
        Alert.alert(
          "Video too long",
          "Please select a video that is less than 15 seconds in length."
        );
        return;
      }

      const uri = asset.uri;
      if (uri) {
        // Check file extension for basic validation
        const fileExtension = uri.toLowerCase().split(".").pop();
        if (fileExtension && !["mp4", "mov", "avi"].includes(fileExtension)) {
          Alert.alert(
            "Unsupported Format",
            `File type .${fileExtension} may not be supported. Please use MP4 format for best compatibility.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Try Anyway",
                onPress: () => {
                  setVideoUri(uri);
                  const name = uri.split("/").pop() || "Untitled video";
                  setFileName(name);
                },
              },
            ]
          );
          return;
        }

        setVideoUri(uri);
        const name = uri.split("/").pop() || "Untitled video";
        setFileName(name);
      }
    } catch (e) {
      console.error("Video pick error", e);
      Alert.alert(
        "Video Error",
        "Could not load this video. Please try:\n\n" +
          "• A different video file\n" +
          "• MP4 format with H.264 codec\n" +
          "• A shorter video (under 10 seconds)\n\n" +
          "Note: Emulators may not support all video formats. Try on a real device for best results.",
        [{ text: "OK" }]
      );
    }
  }

  return { videoUri, fileName, pickVideo };
}

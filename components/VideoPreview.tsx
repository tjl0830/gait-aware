import type { VideoPlayer } from 'expo-video';
import { VideoView } from 'expo-video';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type VideoPreviewProps = {
  uri: string | null;
  fileName: string;
  player: VideoPlayer | null;
};

export function VideoPreview({ uri, fileName, player }: VideoPreviewProps) {
  if (!uri) {
    return <Text style={styles.hint}>No video selected</Text>;
  }

  return (
    <View style={styles.previewContainer}>
      <VideoView 
        style={styles.video} 
        player={player}
        allowsPictureInPicture 
      />
      <Text style={styles.fileLabel}>{fileName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  previewContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  video: {
    width: 320,
    height: 200,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  fileLabel: {
    marginTop: 8,
    color: '#333',
  },
  hint: {
    marginTop: 12,
    color: '#666',
  },
});
import { useVideoPlayer } from 'expo-video';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VideoPicker } from '../../components/VideoPicker';
import { VideoPreview } from '../../components/VideoPreview';
import { useVideoPickerLogic } from '../../components/hooks/useVideoPickerLogic';

export default function Tab() {
  const { videoUri, fileName, pickVideo } = useVideoPickerLogic();
  
  const player = useVideoPlayer(videoUri, player => {
    if (player) {
      player.loop = true;
      player.audioTrack = null;
      player.play();
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Step 1: Upload Video</Text>
      <VideoPicker onPress={pickVideo} />
      <VideoPreview uri={videoUri} fileName={fileName} player={player} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});

import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert } from 'react-native';

export function useVideoPickerLogic() {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  async function pickVideo() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Permission to access media library is required to pick a video.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
      });

      const cancelled = (result as any).cancelled ?? (result as any).canceled;
      if (cancelled) return;

      const assets = (result as any).assets ?? [];
      const asset = assets[0];

      if (asset.duration > 15000) {
        Alert.alert(
          'Video too long',
          'Please select a video that is less than 15 seconds in length.'
        );
        return;
      }

      const uri = asset.uri;
      if (uri) {
        setVideoUri(uri);
        const name = uri.split('/').pop() || 'Untitled video';
        setFileName(name);
      }
    } catch (e) {
      console.error('Video pick error', e);
      Alert.alert('Error', 'Could not pick a video.');
    }
  }

  return { videoUri, fileName, pickVideo };
}
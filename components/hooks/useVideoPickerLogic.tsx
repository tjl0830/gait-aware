import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Video } from 'react-native-compressor';

export function useVideoPickerLogic() {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

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

      // Check duration limit (11 seconds)
      if (asset.duration > 10999) {
        Alert.alert(
          'Video too long', 
          'Please select a video that is 10 seconds or less.'
        );
        return;
      }

      // Check file size and warn user
      const fileSize = asset.fileSize || 0;
      const fileSizeMB = fileSize / (1024 * 1024);
      
      console.log(`[Video Picker] Selected video: ${fileSizeMB.toFixed(2)} MB, ${asset.duration}ms`);

      // CRITICAL: File size validation to prevent OutOfMemoryError
      // Device limit: 256 MB total memory, safe to process videos up to ~10MB after compression
      const MAX_SIZE_MB = 100; // Maximum original size we'll accept (we'll compress it)
      
      if (fileSizeMB > MAX_SIZE_MB) {
        Alert.alert(
          'Video too large',
          `This video is ${fileSizeMB.toFixed(1)} MB. Please select a video smaller than ${MAX_SIZE_MB} MB.`
        );
        return;
      }

      const uri = asset.uri;
      if (uri) {
        // Only compress if video is larger than 10MB
        if (fileSizeMB < 10) {
          // No compression needed
          console.log(`[Video Picker] Video is ${fileSizeMB.toFixed(2)} MB - no compression needed`);
          setVideoUri(uri);
          const name = uri.split('/').pop() || 'Untitled video';
          setFileName(name);
        } else {
          // Compress to target ~10MB
          await compressAndSetVideo(uri, fileSizeMB);
        }
      }
    } catch (e) {
      console.error('Video pick error', e);
      Alert.alert('Error', 'Could not pick a video.');
      setIsCompressing(false);
    }
  }

  async function compressAndSetVideo(uri: string, originalSizeMB: number) {
    try {
      setIsCompressing(true);
      
      // Determine compression settings based on original size
      // Goal: Compress to ~5MB or less for safe processing (256MB limit)
      let compressionConfig: any = {
        compressionMethod: 'manual',
        maxSize: 1280,  // 640p resolution
        bitrate: 8000000, // 800 Kbps
      };

      // if (originalSizeMB > 200) {
      //   // Large file: aggressive compression
      //   compressionConfig = {
      //     compressionMethod: 'manual',
      //     maxSize: 1280,  // 480p resolution
      //     bitrate: 10000000, // 600 Kbps
      //   };
      // } else if (originalSizeMB > 10) {
      //   // Medium file: moderate compression
      //   compressionConfig = {
      //     compressionMethod: 'manual',
      //     maxSize: 1280,  // 640p resolution
      //     bitrate: 10000000, // 800 Kbps
      //   };
      // } else {
      //   // Small file: light compression
      //   compressionConfig = {
      //     compressionMethod: 'manual',
      //     maxSize: 720,  // 720p resolution
      //     bitrate: 1000000, // 1 Mbps
      //   };
      // }

      console.log(`[Video Picker] Compressing video (${originalSizeMB.toFixed(2)} MB)...`);
      console.log('[Video Picker] Compression config:', compressionConfig);

      const compressedUri = await Video.compress(
        uri,
        compressionConfig,
        (progress) => {
          console.log(`[Video Picker] Compression progress: ${(progress * 100).toFixed(0)}%`);
        }
      );

      console.log(`[Video Picker] Compression complete: ${compressedUri}`);
      
      // Check compressed file size
      try {
        const compressedFileInfo = await FileSystem.getInfoAsync(compressedUri);
        if (compressedFileInfo.exists && 'size' in compressedFileInfo) {
          const compressedSizeMB = compressedFileInfo.size / (1024 * 1024);
          console.log(`[Video Picker] Compressed file size: ${compressedSizeMB.toFixed(2)} MB (${originalSizeMB.toFixed(2)} MB → ${compressedSizeMB.toFixed(2)} MB)`);
        }
      } catch (sizeCheckError) {
        console.warn('[Video Picker] Could not check compressed file size:', sizeCheckError);
      }
      
      setVideoUri(compressedUri);
      const name = uri.split('/').pop() || 'Untitled video';
      setFileName(name);
      
      Alert.alert(
        'Video ready',
        `Original: ${originalSizeMB.toFixed(1)} MB\nCompressed and ready for processing.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('[Video Picker] Compression error:', error);
      Alert.alert(
        'Compression failed',
        'Could not compress the video. Please try a different video or a shorter clip.'
      );
    } finally {
      setIsCompressing(false);
    }
  }

  return { videoUri, fileName, pickVideo, isCompressing };
}
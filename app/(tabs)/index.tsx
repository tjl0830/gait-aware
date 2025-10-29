import { useVideoPlayer } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
// Use legacy API to avoid deprecation error in SDK 54
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { VideoPicker } from '../../components/VideoPicker';
import { VideoPreview } from '../../components/VideoPreview';
import { useVideoPickerLogic } from '../../components/hooks/useVideoPickerLogic';
import UserInfo from '../user_info';

type PoseResult = {
  success: boolean;
  outputFile: string;
  frameCount: number;
  width: number;
  height: number;
  fps: number;
};

export default function Tab() {
  const { videoUri, fileName, pickVideo } = useVideoPickerLogic();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ frameIndex: number; percent?: number } | null>(null);
  const [result, setResult] = useState<PoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const webViewRef = useRef<WebView>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [showPreview, setShowPreview] = useState(true); // Temporarily show WebView for debugging
  const { width } = useWindowDimensions();
  
  const player = useVideoPlayer(videoUri, player => {
    if (player) {
      player.loop = true;
      player.audioTrack = null;
      player.play();
    }
  });

  // Load MediaPipe HTML on mount (read bundled asset as string to avoid file:// issues)
  useEffect(() => {
    async function loadHTML() {
      try {
        const moduleId = require('../web/mediapipe_pose.html');
        const asset = Asset.fromModule(moduleId);
        // Ensure the asset is available locally; on native this resolves a file:// URI
        await asset.downloadAsync();
        if (!asset.localUri) throw new Error('HTML asset localUri not available');
        // Read the HTML file contents and feed it directly to WebView
        const content = await FileSystem.readAsStringAsync(asset.localUri);
        setHtmlContent(content);
      } catch (err: any) {
        console.error('Failed to load MediaPipe assets:', err);
      }
    }
    loadHTML();
  }, []);

  // Handle messages from WebView
  const onMessage = async (event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'status':
          console.log('MediaPipe status:', message.message);
          if (String(message.message).toLowerCase().includes('initialized')) {
            setWebViewReady(true);
          }
          break;
        
        case 'progress':
          setProgress({
            frameIndex: message.frameIndex,
            percent: message.percent
          });
          break;
        
        case 'complete':
          try {
            // Get base path for file storage (app's documents directory)
            const baseName = fileName?.split('.')[0] || 'video';
            const posesDir = `${FileSystem.documentDirectory}poses`;
            const outputFile = `${posesDir}/${baseName}_pose.json`;

            // Create directory structure
            await FileSystem.makeDirectoryAsync(
              posesDir,
              { intermediates: true }
            );
            
            await FileSystem.writeAsStringAsync(
              outputFile,
              JSON.stringify(message.results, null, 2),
              { encoding: 'utf8' }
            );
            
            setResult({
              success: true,
              outputFile,
              frameCount: message.results.metadata.frame_count,
              width: message.results.metadata.width,
              height: message.results.metadata.height,
              fps: message.results.metadata.fps
            });
            
            console.log('Results saved to:', outputFile);
          } catch (err: any) {
            throw new Error('Failed to save results: ' + err.message);
          } finally {
            setRunning(false);
          }
          break;
        
        case 'error':
          throw new Error(message.message);
      }
    } catch (err: any) {
      setError(err.message);
      setRunning(false);
    }
  };

  // Extract keypoints from video
  async function onExtractKeypoints() {
    setError(null);
    if (!videoUri) {
      setError('No video selected');
      return;
    }
    if (!webViewReady) {
      setError('Pose engine is still initializing. Please wait a moment and try again.');
      return;
    }

    try {
      setRunning(true);
      setResult(null);
      setProgress(null);

      // Read video file as base64
      const base64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: 'base64'
      });

      // Send to WebView for processing
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'process_video',
        video: `data:video/mp4;base64,${base64}`,
        options: {
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
          fps: 15
        }
      }));
    } catch (err: any) {
      setError(err.message);
      setRunning(false);
    }
  }

  // Export JSON to a user-selected folder (e.g., Downloads on Android) using SAF
  const onExportJson = async () => {
    try {
      if (!result?.outputFile) {
        Alert.alert('No file', 'Run analysis first to generate a JSON file.');
        return;
      }
      const baseName = fileName?.split('.')[0] || 'video';

      if (Platform.OS === 'android') {
        const SAF = (FileSystem as any).StorageAccessFramework;
        if (!SAF?.requestDirectoryPermissionsAsync) {
          Alert.alert('Not supported', 'Storage Access Framework is not available.');
          return;
        }

        // Ask user to pick a folder (recommend choosing Downloads)
        const perms = await SAF.requestDirectoryPermissionsAsync();
        if (!perms.granted) {
          Alert.alert('Permission denied', 'Export cancelled.');
          return;
        }

        const filename = `${baseName}_pose.json`;
        const destUri = await SAF.createFileAsync(perms.directoryUri, filename, 'application/json');

        // Read local file and write to the SAF content URI
        const content = await FileSystem.readAsStringAsync(result.outputFile, { encoding: 'utf8' });
        await FileSystem.writeAsStringAsync(destUri, content, { encoding: 'utf8' });

        Alert.alert('Exported', 'JSON saved to the selected folder.');
      } else {
        // iOS or web: fall back to showing the path or future share integration
        Alert.alert('Saved', `App file path:\n${result.outputFile}`);
      }
    } catch (e: any) {
      console.error('Export failed:', e);
      Alert.alert('Export failed', e?.message || String(e));
    }
  };

  return (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.videoContainer}>
          <Text style={styles.stepTitle}>Step 1: Upload Video</Text>
          <VideoPicker onPress={pickVideo} />
          <VideoPreview uri={videoUri} fileName={fileName} player={player} />
        </View>

        <UserInfo />

        {/* WebView preview (debug) */}
        {htmlContent ? (
          <View style={{ width: '100%', maxWidth: 600, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '600' }}>Pose preview (debug)</Text>
              <Button
                title={showPreview ? 'Hide' : 'Show'}
                onPress={() => setShowPreview(v => !v)}
              />
            </View>
            <WebView
              ref={webViewRef}
              source={{ html: htmlContent }}
              style={{ 
                width: showPreview ? Math.min(width - 64, 600) : 0, 
                height: showPreview ? 320 : 0, 
                opacity: 1,
                marginTop: 8,
                borderColor: '#ddd',
                borderWidth: showPreview ? 1 : 0,
                borderRadius: 8,
                overflow: 'hidden'
              }}
              onMessage={onMessage}
              javaScriptEnabled={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              originWhitelist={['*']}
              // Android: allow file access just in case the internal page tries to reference local files
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
            />
          </View>
        ) : null}

        {/* Step 2: Extract Keypoints */}
        <View style={styles.extractionContainer}>
          <Text style={styles.stepTitle}>Step 2: Extract Keypoints</Text>
          <Button 
            title="Analyze Video" 
            onPress={onExtractKeypoints} 
            disabled={!videoUri || running || !webViewReady} 
          />
          {!webViewReady && (
            <Text style={{ marginTop: 8, color: '#666' }}>Initializing pose engine…</Text>
          )}

          {running && (
            <View style={styles.progress}>
              <ActivityIndicator size="large" />
              <Text style={styles.progressText}>
                Processing... {progress ? `${progress.frameIndex} frames` : ''} 
                {progress?.percent ? ` (${Math.round(progress.percent)}%)` : ''}
              </Text>
            </View>
          )}

          {result && (
            <View style={styles.result}>
              <Text style={styles.resultText}>✓ Analysis Complete!</Text>
              <Text>Frames processed: {result.frameCount}</Text>
              <Text>Video size: {result.width}x{result.height}</Text>
              <Text style={styles.outputPath}>Output: {result.outputFile}</Text>
              <View style={{ marginTop: 12 }}>
                <Button title="Export JSON to Downloads" onPress={onExportJson} />
              </View>
            </View>
          )}

          {error && (
            <View style={styles.error}>
              <Text style={styles.errorText}>Error: {error}</Text>
            </View>
          )}
        </View>
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
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  videoContainer: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: 20,
    maxWidth: 600,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
  },
  extractionContainer: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  progress: {
    marginTop: 16,
    alignItems: 'center',
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  result: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    width: '100%',
  },
  resultText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  outputPath: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  error: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    width: '100%',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
});

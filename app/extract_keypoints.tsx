import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { VideoPicker } from '../components/VideoPicker';
import { useVideoPickerLogic } from '../components/hooks/useVideoPickerLogic';

type PoseResult = {
  success: boolean;
  outputFile: string;
  frameCount: number;
  width: number;
  height: number;
  fps: number;
};

export default function ExtractKeypointsScreen() {
  const { videoUri, fileName, pickVideo } = useVideoPickerLogic();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ frameIndex: number; percent?: number } | null>(null);
  const [result, setResult] = useState<PoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const webViewRef = useRef<WebView>(null);
  const { width } = useWindowDimensions();

  // Load HTML content on mount
  useEffect(() => {
    async function loadHTML() {
      try {
        const htmlAsset = require('./web/mediapipe_pose.html');
        const content = await FileSystem.readAsStringAsync(htmlAsset);
        setHtmlContent(content);
      } catch (err: any) {
        setError('Failed to load MediaPipe web assets: ' + err.message);
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
          break;
        
        case 'progress':
          setProgress({
            frameIndex: message.frameIndex,
            percent: message.percent
          });
          break;
        
        case 'complete':
          try {
            // Get base path for file storage
            const baseName = fileName?.split('.')[0] || 'video';
            const dir = (await FileSystem.getInfoAsync('.')).uri;
            const outputFile = `${dir}/poses/${baseName}_pose.json`;
            
            // Create directory structure
            await FileSystem.makeDirectoryAsync(
              `${dir}/poses`, 
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

  async function onRun() {
    setError(null);
    if (!videoUri) {
      setError('No video selected');
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Extract Keypoints</Text>

      <VideoPicker onPress={pickVideo} />
      <Text>Selected: {fileName ?? 'None'}</Text>

      {htmlContent ? (
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={{ width, height: 300, opacity: 0.99 }}
          onMessage={onMessage}
          javaScriptEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={['*']}
        />
      ) : null}

      <View style={styles.actions}>
        <Button title="Run Extraction" onPress={onRun} disabled={!videoUri || running} />
      </View>

      {running && (
        <View style={styles.progress}>
          <ActivityIndicator />
          <Text>Processing... {progress ? `${progress.frameIndex} frames` : ''} {progress?.percent ? `(${Math.round(progress.percent)}%)` : ''}</Text>
        </View>
      )}

      {result && (
        <View style={styles.result}>
          <Text>Done — frames: {result.frameCount}</Text>
          <Text>Saved to: {result.outputFile}</Text>
        </View>
      )}

      {error && (
        <View style={styles.error}>
          <Text style={{ color: 'red' }}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16 
  },
  title: { 
    fontSize: 20, 
    fontWeight: '600', 
    marginBottom: 12 
  },
  actions: { 
    marginVertical: 12 
  },
  progress: { 
    marginTop: 12 
  },
  result: { 
    marginTop: 12 
  },
  error: { 
    marginTop: 12 
  },
});
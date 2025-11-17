import { useVideoPlayer } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
// Use legacy API to avoid deprecation error in SDK 54
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { VideoPicker } from '../../components/VideoPicker';
import { VideoPreview } from '../../components/VideoPreview';
import { useVideoPickerLogic } from '../../components/hooks/useVideoPickerLogic';
import { classifySEI, initializeCNNModel } from '../pipeline/cnnPipeline';
import { exportJson, exportSei } from '../pipeline/exportPipeline';
import { generateSei } from '../pipeline/seiPipeline';
import { extractKeypoints, handleWebViewMessage } from '../pipeline/videoPipeline';
import UserInfo from '../user_info';

import { PoseResult } from '../pipeline/pipelineTypes';

export default function Tab() {
  const { videoUri, fileName, pickVideo, isCompressing } = useVideoPickerLogic();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ frameIndex: number; percent?: number } | null>(null);
  const [result, setResult] = useState<PoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seiPng, setSeiPng] = useState<string | null>(null);
  const [seiSavedPath, setSeiSavedPath] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [cnnResult, setCnnResult] = useState<{
    predictedClass: string;
    confidence: number;
    allScores: { label: string; score: number }[];
  } | null>(null);
  const [cnnLoading, setCnnLoading] = useState(false);
  const [cnnModelReady, setCnnModelReady] = useState(false);
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

  // Initialize CNN model on mount
  useEffect(() => {
    async function initCNN() {
      try {
        console.log('[App] Initializing CNN model...');
        await initializeCNNModel();
        setCnnModelReady(true);
        console.log('[App] CNN model ready!');
      } catch (err: any) {
        console.error('[App] Failed to initialize CNN:', err);
        setError(`Failed to load CNN model: ${err.message}`);
      }
    }
    initCNN();
  }, []);

  // Handle messages from WebView
  const onMessage = async (event: any) => {
    handleWebViewMessage(event, fileName, setResult, setProgress, setError, setRunning);
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'status' && String(message.message).toLowerCase().includes('initialized')) {
        setWebViewReady(true);
      }
      if (message.type === 'complete' && message.results) {
        const baseName = fileName?.split('.')[0] || 'video';
        const posesDir = `${FileSystem.documentDirectory}poses`;
        const outputFile = `${posesDir}/${baseName}_pose.json`;
        await FileSystem.makeDirectoryAsync(posesDir, { intermediates: true });
        await FileSystem.writeAsStringAsync(outputFile, JSON.stringify(message.results, null, 2), { encoding: 'utf8' });
        setResult({
          success: true,
          outputFile,
          frameCount: message.results.metadata.frame_count,
          width: message.results.metadata.width,
          height: message.results.metadata.height,
          fps: message.results.metadata.fps
        });
      }
    } catch (err) {}
  };

  // Pipeline function wrappers
  const onExtractKeypoints = () => {
    if (!videoUri) return;
    extractKeypoints(
      String(videoUri),
      webViewReady,
      webViewRef,
      setRunning,
      setResult,
      setProgress,
      setError,
      fileName || ''
    );
  };

  const onGenerateSei = () => generateSei(
    result,
    fileName,
    setSeiPng,
    setSeiSavedPath,
    setGenerating,
    setError
  );
  
  const onRunCNN = async () => {
    if (!seiSavedPath) {
      setError('No SEI image available');
      return;
    }
    
    try {
      setCnnLoading(true);
      setError(null);
      console.log('[App] Running CNN classification...');
      
      const classificationResult = await classifySEI(seiSavedPath);
      setCnnResult(classificationResult);
      
      console.log('[App] Classification complete:', classificationResult.predictedClass);
    } catch (err: any) {
      console.error('[App] CNN classification failed:', err);
      setError(`CNN classification failed: ${err.message}`);
    } finally {
      setCnnLoading(false);
    }
  };
  
  const onExportSei = () => exportSei(seiSavedPath, fileName);

  const onExportJson = () => exportJson(result, fileName);

  return (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.videoContainer}>
          <Text style={styles.stepTitle}>Step 1: Upload Video</Text>
          <VideoPicker onPress={pickVideo} isCompressing={isCompressing} />
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

          {(() => {
            if (!running) return null;
            let progressText = 'Processing...';
            if (progress && typeof progress.frameIndex === 'number') {
              progressText = progressText + ' ' + progress.frameIndex + ' frames';
            }
            if (progress && typeof progress.percent === 'number') {
              progressText = progressText + ' (' + Math.round(progress.percent) + '%)';
            }
            return (
              <View style={styles.progress}>
                <ActivityIndicator size="large" />
                <Text style={styles.progressText}>{progressText}</Text>
              </View>
            );
          })()}

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

          {/* Step 3: Generate SEI */}
          <View style={styles.extractionContainer}>
            <Text style={styles.stepTitle}>Step 3: Generate SEI</Text>
            <Button title="Generate SEI" onPress={onGenerateSei} disabled={!result || generating} />

            {generating && (
              <View style={styles.progress}>
                <ActivityIndicator size="large" />
                <Text style={styles.progressText}>Generating SEI…</Text>
              </View>
            )}

            {seiPng ? (
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ fontWeight: '600' }}>SEI Preview</Text>
                <Image
                  source={{ uri: 'data:image/png;base64,' + seiPng }}
                  style={{ width: 224, height: 224, marginTop: 8, borderWidth: 1, borderColor: '#ddd' }}
                />
              </View>
            ) : null}

            {seiSavedPath && (
              <Text style={{ marginTop: 8 }}>Saved: {seiSavedPath}</Text>
            )}

            <View style={{ marginTop: 12 }}>
              <Button title="Export SEI to Downloads" onPress={onExportSei} disabled={!seiSavedPath} />
            </View>
          </View>

          {/* Step 4: CNN Classification */}
          <View style={styles.extractionContainer}>
            <Text style={styles.stepTitle}>Step 4: Gait Classification</Text>
            <Text style={{ marginBottom: 12, color: '#666', textAlign: 'center' }}>
              {cnnModelReady ? '✓ CNN model loaded' : 'Loading CNN model...'}
            </Text>
            
            <Button 
              title="Classify Gait" 
              onPress={onRunCNN} 
              disabled={!seiSavedPath || cnnLoading || !cnnModelReady} 
            />

            {cnnLoading && (
              <View style={styles.progress}>
                <ActivityIndicator size="large" />
                <Text style={styles.progressText}>Classifying gait pattern...</Text>
              </View>
            )}

            {cnnResult && (
              <View style={styles.result}>
                <Text style={styles.resultText}>
                  🎯 Predicted: {cnnResult.predictedClass}
                </Text>
                <Text style={{ fontSize: 18, marginTop: 8 }}>
                  Confidence: {(cnnResult.confidence * 100).toFixed(2)}%
                </Text>
                
                <Text style={{ fontWeight: '600', marginTop: 16, marginBottom: 8 }}>
                  All Predictions:
                </Text>
                {cnnResult.allScores.map((item, index) => (
                  <View key={index} style={{ marginVertical: 4 }}>
                    <Text style={{ fontSize: 14 }}>
                      {item.label}: {(item.score * 100).toFixed(2)}%
                    </Text>
                    <View style={{ 
                      height: 4, 
                      backgroundColor: '#e0e0e0', 
                      borderRadius: 2, 
                      marginTop: 2,
                      overflow: 'hidden'
                    }}>
                      <View style={{ 
                        height: '100%', 
                        width: `${item.score * 100}%`, 
                        backgroundColor: index === 0 ? '#4caf50' : '#9e9e9e',
                        borderRadius: 2
                      }} />
                    </View>
                  </View>
                ))}
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

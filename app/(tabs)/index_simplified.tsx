/**
 * Simplified Gait Analysis - Main Screen
 * Clean, focused UI: Upload Video → Analyze Gait → View Results
 */

import { useVideoPlayer } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { VideoPicker } from '../../components/VideoPicker';
import { VideoPreview } from '../../components/VideoPreview';
import { useVideoPickerLogic } from '../../components/hooks/useVideoPickerLogic';
import { GaitAnalysisResult } from '../../utils/gaitAnalysis';
import { validateVideo, getVideoRequirements } from '../../utils/videoValidation';
import { PoseJsonData, validatePoseDataQuality } from '../../utils/landmarkExtractor';
import { analyzeGait } from '../../utils/gaitAnalysis';

export default function GaitAnalysisScreen() {
  const { videoUri, fileName, pickVideo } = useVideoPickerLogic();
  
  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; frameIndex?: number; percent?: number }>({ stage: 'idle' });
  const [result, setResult] = useState<GaitAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // WebView for MediaPipe
  const [htmlContent, setHtmlContent] = useState<string>('');
  const webViewRef = useRef<WebView>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  
  // Video player
  const player = useVideoPlayer(videoUri, player => {
    if (player) {
      player.loop = true;
      player.audioTrack = null;
      player.play();
    }
  });

  // Load MediaPipe HTML on mount
  useEffect(() => {
    async function loadHTML() {
      try {
        const moduleId = require('../web/mediapipe_pose.html');
        const asset = Asset.fromModule(moduleId);
        await asset.downloadAsync();
        if (!asset.localUri) throw new Error('HTML asset not available');
        const content = await FileSystem.readAsStringAsync(asset.localUri);
        setHtmlContent(content);
      } catch (err: any) {
        console.error('Failed to load MediaPipe:', err);
        setError('Failed to initialize pose detection engine');
      }
    }
    loadHTML();
  }, []);

  // Handle messages from WebView
  const onWebViewMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'status':
          if (String(message.message).toLowerCase().includes('initialized')) {
            setWebViewReady(true);
          }
          break;
          
        case 'progress':
          setProgress({
            stage: 'extracting',
            frameIndex: message.frameIndex,
            percent: message.percent,
          });
          break;
          
        case 'complete':
          await handlePoseExtractionComplete(message.results);
          break;
          
        case 'error':
          setError(message.message || 'Pose detection failed');
          setAnalyzing(false);
          break;
      }
    } catch (err: any) {
      console.error('WebView message error:', err);
    }
  };

  // Handle pose extraction completion
  const handlePoseExtractionComplete = async (results: any) => {
    try {
      if (!results) {
        throw new Error('No pose data returned');
      }

      setProgress({ stage: 'validating' });

      // Save pose data to file
      const baseName = fileName?.split('.')[0] || 'video';
      const posesDir = `${FileSystem.documentDirectory}poses`;
      const outputFile = `${posesDir}/${baseName}_pose.json`;
      
      await FileSystem.makeDirectoryAsync(posesDir, { intermediates: true });
      await FileSystem.writeAsStringAsync(
        outputFile,
        JSON.stringify(results, null, 2),
        { encoding: 'utf8' }
      );

      // Parse and validate pose data
      const poseData: PoseJsonData = results;
      const validation = validatePoseDataQuality(poseData);

      if (!validation.valid) {
        throw new Error(
          validation.message || 
          `Insufficient valid frames: ${validation.validFrameCount}/60 required`
        );
      }

      // Run gait analysis
      setProgress({ stage: 'analyzing' });
      const gaitResult = await analyzeGait(poseData);
      
      setResult(gaitResult);
      setError(null);
      setAnalyzing(false);
      setProgress({ stage: 'complete' });
      
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
      setAnalyzing(false);
      setProgress({ stage: 'idle' });
    }
  };

  // Main analysis function
  const handleAnalyzeGait = async () => {
    if (!videoUri || !fileName) {
      setError('Please select a video first');
      return;
    }

    if (!webViewReady) {
      setError('Pose detection engine is still initializing. Please wait...');
      return;
    }

    // Reset state
    setResult(null);
    setError(null);
    setAnalyzing(true);
    setProgress({ stage: 'preparing' });

    try {
      // Validate video
      const validation = await validateVideo(videoUri, fileName);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      if (validation.warnings && validation.warnings.length > 0) {
        Alert.alert('Note', validation.warnings.join('\n'));
      }

      // Read video as base64 and send to WebView
      setProgress({ stage: 'loading' });
      const base64 = await FileSystem.readAsStringAsync(videoUri, { encoding: 'base64' });
      
      setProgress({ stage: 'extracting' });
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'process_video',
        video: `data:video/mp4;base64,${base64}`,
        options: {
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.4,
          fps: 30,
        },
      }));
      
    } catch (err: any) {
      setError(err.message || 'Failed to process video');
      setAnalyzing(false);
      setProgress({ stage: 'idle' });
    }
  };

  // Render progress message
  const getProgressMessage = () => {
    switch (progress.stage) {
      case 'preparing':
        return 'Preparing video...';
      case 'loading':
        return 'Loading video...';
      case 'extracting':
        const frame = progress.frameIndex || 0;
        const percent = progress.percent ? Math.round(progress.percent) : 0;
        return `Extracting keypoints: frame ${frame} (${percent}%)`;
      case 'validating':
        return 'Validating pose data...';
      case 'analyzing':
        return 'Analyzing gait pattern...';
      case 'complete':
        return 'Analysis complete!';
      default:
        return 'Processing...';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Gait Analysis</Text>
          <Text style={styles.subtitle}>Upload a video and analyze walking pattern</Text>
        </View>

        {/* Step 1: Upload Video */}
        <View style={styles.card}>
          <Text style={styles.stepTitle}>Step 1: Upload Video</Text>
          <VideoPicker onPress={pickVideo} />
          <VideoPreview uri={videoUri} fileName={fileName} player={player} />
          
          {videoUri && (
            <View style={styles.requirements}>
              <Text style={styles.requirementsTitle}>Video Requirements:</Text>
              <Text style={styles.requirementsText}>{getVideoRequirements()}</Text>
            </View>
          )}
        </View>

        {/* Step 2: Analyze Gait */}
        <View style={styles.card}>
          <Text style={styles.stepTitle}>Step 2: Analyze Gait</Text>
          
          <Button
            title="Analyze Gait Pattern"
            onPress={handleAnalyzeGait}
            disabled={!videoUri || analyzing || !webViewReady}
          />

          {!webViewReady && htmlContent && (
            <Text style={styles.initMessage}>
              Initializing pose detection engine...
            </Text>
          )}

          {analyzing && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.progressText}>{getProgressMessage()}</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>⚠️ Analysis Failed</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>

        {/* Step 3: Results */}
        {result && (
          <View style={styles.card}>
            <Text style={styles.stepTitle}>Results</Text>
            
            <View style={[
              styles.resultCard,
              result.isAbnormal ? styles.abnormalCard : styles.normalCard
            ]}>
              <Text style={[
                styles.resultTitle,
                result.isAbnormal ? styles.abnormalTitle : styles.normalTitle
              ]}>
                {result.isAbnormal ? '⚠️ Abnormal Gait Detected' : '✓ Normal Gait Pattern'}
              </Text>
              
              <View style={styles.resultDetails}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Classification:</Text>
                  <Text style={styles.resultValue}>{result.classification}</Text>
                </View>
                
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Confidence:</Text>
                  <Text style={styles.resultValue}>
                    {(result.confidence * 100).toFixed(1)}%
                  </Text>
                </View>
                
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Abnormality Score:</Text>
                  <Text style={styles.resultValue}>
                    {result.abnormalityScore.toFixed(4)}
                  </Text>
                </View>
              </View>

              <View style={styles.featuresDivider} />
              
              <Text style={styles.featuresTitle}>Detailed Metrics:</Text>
              <View style={styles.featuresList}>
                <Text style={styles.featureItem}>
                  • Stride Variability: {result.features.strideVariability.toFixed(3)}
                </Text>
                <Text style={styles.featureItem}>
                  • Left-Right Asymmetry: {result.features.leftRightAsymmetry.toFixed(3)}
                </Text>
                <Text style={styles.featureItem}>
                  • Vertical Movement: {result.features.verticalMovement.toFixed(3)}
                </Text>
                <Text style={styles.featureItem}>
                  • Velocity Consistency: {result.features.velocityConsistency.toFixed(3)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Hidden WebView for MediaPipe */}
        {htmlContent && (
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={{ width: 0, height: 0, opacity: 0 }}
            onMessage={onWebViewMessage}
            javaScriptEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={['*']}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000',
  },
  requirements: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#007AFF',
  },
  requirementsText: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  initMessage: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  progressContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  progressText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c62828',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    lineHeight: 20,
  },
  resultCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
  },
  normalCard: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  abnormalCard: {
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  normalTitle: {
    color: '#2e7d32',
  },
  abnormalTitle: {
    color: '#e65100',
  },
  resultDetails: {
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 15,
    color: '#000',
    fontWeight: '600',
  },
  featuresDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 16,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  featuresList: {
    paddingLeft: 8,
  },
  featureItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});

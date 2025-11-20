import { useVideoPlayer } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
// Use legacy API to avoid deprecation error in SDK 54
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { PipelineLoadingScreen } from '../../components/PipelineLoadingScreen';
import { PipelineResultsScreen } from '../../components/PipelineResultsScreen';
import { VideoPicker } from '../../components/VideoPicker';
import { VideoPreview } from '../../components/VideoPreview';
import { useVideoPickerLogic } from '../../components/hooks/useVideoPickerLogic';
import { classifySEI, initializeCNNModel } from '../pipeline/cnnPipeline';
import { exportAllResults, exportJson, exportSei } from '../pipeline/exportPipeline';
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
  
  // Pipeline state
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const logsRef = useRef<string[]>([]);
  
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

  // Helper function to add logs
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    logsRef.current = [...logsRef.current, logMessage];
    setPipelineLogs([...logsRef.current]);
  };

  // Ref to track pipeline completion callbacks
  const pipelineCallbacksRef = useRef<{
    onProgress?: (data: any) => void;
    onComplete?: (result: PoseResult) => void;
    onError?: (error: string) => void;
  }>({});

  // Handle messages from WebView
  const onMessage = async (event: any) => {
    handleWebViewMessage(event, fileName, setResult, setProgress, setError, setRunning);
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      // Forward console logs from WebView
      if (message.type === 'console') {
        const prefix = message.level === 'error' ? '❌' : message.level === 'warn' ? '⚠️' : '📝';
        console.log(`[WebView] ${prefix} ${message.message}`);
        return;
      }
      
      if (message.type === 'status' && String(message.message).toLowerCase().includes('initialized')) {
        setWebViewReady(true);
      }
      if (message.type === 'progress' && pipelineCallbacksRef.current.onProgress) {
        pipelineCallbacksRef.current.onProgress(message);
      }
      if (message.type === 'complete' && message.results) {
        const baseName = fileName?.split('.')[0] || 'video';
        const posesDir = `${FileSystem.documentDirectory}poses`;
        const outputFile = `${posesDir}/${baseName}_pose.json`;
        await FileSystem.makeDirectoryAsync(posesDir, { intermediates: true });
        await FileSystem.writeAsStringAsync(outputFile, JSON.stringify(message.results, null, 2), { encoding: 'utf8' });
        const result = {
          success: true,
          outputFile,
          frameCount: message.results.metadata.frame_count,
          width: message.results.metadata.width,
          height: message.results.metadata.height,
          fps: message.results.metadata.fps
        };
        setResult(result);
        
        // Notify pipeline callback
        if (pipelineCallbacksRef.current.onComplete) {
          pipelineCallbacksRef.current.onComplete(result);
        }
      }
      if (message.type === 'error' && pipelineCallbacksRef.current.onError) {
        pipelineCallbacksRef.current.onError(message.message);
      }
    } catch (err) {}
  };

  // Main pipeline runner
  const runCompletePipeline = async () => {
    if (!videoUri || !webViewReady || !cnnModelReady) {
      alert('Please ensure video is selected and models are ready');
      return;
    }

    setIsPipelineRunning(true);
    logsRef.current = [];
    setPipelineLogs([]);
    setError(null);

    try {
      // Step 1: Extract Keypoints
      addLog('Step 1: Starting keypoint extraction...');
      
      let keypointResult: PoseResult | null = null;
      await new Promise<void>((resolve, reject) => {
        // Set up callbacks
        pipelineCallbacksRef.current = {
          onProgress: (data: any) => {
            if (data?.frameIndex) {
              addLog(`  Processing frame ${data.frameIndex}...`);
            }
          },
          onComplete: (result: PoseResult) => {
            keypointResult = result;
            pipelineCallbacksRef.current = {}; // Clear callbacks
            resolve();
          },
          onError: (error: string) => {
            pipelineCallbacksRef.current = {}; // Clear callbacks
            reject(new Error(error));
          }
        };
        
        // Start extraction
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
      });
      
      addLog('  ✓ Keypoint extraction complete');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Generate SEI
      addLog('Step 2: Generating SEI image...');
      
      let seiPath: string | null = null;
      await new Promise<void>((resolve, reject) => {
        let isComplete = false;
        
        const tempSetGenerating = (isGen: boolean) => {
          if (!isGen && !isComplete) {
            isComplete = true;
            resolve();
          }
        };
        
        const tempError = (err: string | null) => {
          if (err && !isComplete) {
            isComplete = true;
            reject(new Error(err));
          }
        };
        
        const tempSetSeiPath = (path: string | null) => {
          if (path) {
            seiPath = path;
            setSeiSavedPath(path);
          }
        };
        
        generateSei(
          keypointResult,
          fileName,
          setSeiPng,
          tempSetSeiPath,
          tempSetGenerating,
          tempError
        );
      });
      
      addLog('  ✓ SEI image generated');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: CNN Classification
      addLog('Step 3: Running CNN classification...');
      
      if (!seiPath) {
        throw new Error('SEI path not available');
      }
      
      const classificationResult = await classifySEI(seiPath);
      setCnnResult(classificationResult);
      
      addLog(`  ✓ Classification complete!`);
      addLog(`  Predicted: ${classificationResult.predictedClass}`);
      addLog(`  Confidence: ${(classificationResult.confidence * 100).toFixed(2)}%`);
      addLog('');
      addLog('🎉 Pipeline completed successfully!');
      
      // Wait a moment before showing results
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsPipelineRunning(false);
      setShowResults(true);

    } catch (err: any) {
      addLog('');
      addLog(`❌ Error: ${err.message}`);
      setError(err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
      setIsPipelineRunning(false);
      setShowResults(false);
    }
  };

  // Reset and start new analysis
  const startNewAnalysis = () => {
    setShowResults(false);
    setResult(null);
    setSeiPng(null);
    setSeiSavedPath(null);
    setCnnResult(null);
    setError(null);
    logsRef.current = [];
    setPipelineLogs([]);
  };

  // Pipeline function wrappers (kept for backward compatibility)
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
    <>
      {isPipelineRunning ? (
        <PipelineLoadingScreen 
          logs={pipelineLogs} 
          webViewRef={webViewRef}
          htmlContent={htmlContent}
          onWebViewMessage={onMessage}
        />
      ) : showResults ? (
        <PipelineResultsScreen
          cnnResult={cnnResult}
          seiPng={seiPng}
          videoFileName={fileName || undefined}
          onExportResults={() => exportAllResults(seiSavedPath, result, fileName)}
          onStartNew={startNewAnalysis}
        />
      ) : (
        <ScrollView style={styles.scrollContainer}>
          <View style={styles.container}>
            <View style={styles.videoContainer}>
              <Text style={styles.stepTitle}>Step 1: Upload Video</Text>
              <VideoPicker onPress={pickVideo} isCompressing={isCompressing} />
              <VideoPreview uri={videoUri} fileName={fileName} player={player} />
            </View>

            <UserInfo />

            {/* Next Button */}
            <View style={styles.nextButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  (!videoUri || !webViewReady || !cnnModelReady) && styles.nextButtonDisabled
                ]}
                onPress={runCompletePipeline}
                disabled={!videoUri || !webViewReady || !cnnModelReady}
              >
                <Text style={styles.nextButtonText}>
                  {!webViewReady || !cnnModelReady ? 'Loading models...' : 'Next - Start Analysis'}
                </Text>
              </TouchableOpacity>
              {(!webViewReady || !cnnModelReady) && (
                <Text style={styles.loadingText}>
                  {!webViewReady && 'Initializing pose engine...'} 
                  {!cnnModelReady && !webViewReady && ' & '}
                  {!cnnModelReady && 'Loading CNN model...'}
                </Text>
              )}
            </View>

            {/* Hidden WebView for processing */}
            {htmlContent ? (
              <WebView
                ref={webViewRef}
                source={{ html: htmlContent }}
                style={{ width: 0, height: 0, opacity: 0 }}
                onMessage={onMessage}
                javaScriptEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                originWhitelist={['*']}
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
              />
            ) : null}

            {/* Results shown after pipeline completes */}
            {(result || seiPng || cnnResult) && (
              <View style={styles.resultsSection}>
                <Text style={styles.resultsTitle}>Analysis Results</Text>
                
                {/* Result cards will be shown here */}
              </View>
            )}

            {/* Debug: Step-by-step controls (hidden by default) */}
            {false && (
              <>
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
                Processing...
                {/* @ts-expect-error - progress is checked before use */}
                {progress && typeof progress.frameIndex === 'number' ? ` ${progress.frameIndex} frames` : ''}
                {/* @ts-expect-error - progress is checked before use */}
                {progress && typeof progress.percent === 'number' ? ` (${Math.round(progress.percent)}%)` : ''}
              </Text>
            </View>
          )}

          {result && (
            <View style={styles.result}>
              <Text style={styles.resultText}>✓ Analysis Complete!</Text>
              <Text>Frames processed: {result?.frameCount}</Text>
              <Text>Video size: {result?.width}x{result?.height}</Text>
              <Text style={styles.outputPath}>Output: {result?.outputFile}</Text>
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
                  🎯 Predicted: {cnnResult?.predictedClass}
                </Text>
                <Text style={{ fontSize: 18, marginTop: 8 }}>
                  Confidence: {((cnnResult?.confidence ?? 0) * 100).toFixed(2)}%
                </Text>
                
                <Text style={{ fontWeight: '600', marginTop: 16, marginBottom: 8 }}>
                  All Predictions:
                </Text>
                {cnnResult?.allScores.map((item, index) => (
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
              </>
            )}
          </View>
        </ScrollView>
      )}
    </>
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
  nextButtonContainer: {
    width: '100%',
    maxWidth: 600,
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
  },
  nextButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  resultsSection: {
    width: '100%',
    maxWidth: 600,
    marginTop: 32,
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
});

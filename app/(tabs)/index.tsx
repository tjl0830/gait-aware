import { Video } from "expo-av";
import { useRouter } from "expo-router";
import { useVideoPlayer } from "expo-video";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { WebView } from "react-native-webview";
// Use legacy API to avoid deprecation error in SDK 54
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { PipelineLoadingScreen } from "../../components/PipelineLoadingScreen";
import { PipelineResultsScreen } from "../../components/PipelineResultsScreen";
import { VideoPicker } from "../../components/VideoPicker";
import { VideoPreview } from "../../components/VideoPreview";
import { useVideoPickerLogic } from "../../components/hooks/useVideoPickerLogic";
import {
  detectGaitAnomaly,
  initializeBiLSTMModel,
} from "../../src/pipeline/bilstmPipeline";
import {
  classifySEI,
  initializeCNNModel,
} from "../../src/pipeline/cnnPipeline";
import { exportJson, exportSei } from "../../src/pipeline/exportPipeline";
import { generateSei } from "../../src/pipeline/seiPipeline";
import {
  extractKeypoints,
  handleWebViewMessage,
} from "../../src/pipeline/videoPipeline";
import UserInfo from "../user_info";

import { PoseResult } from "../../src/pipeline/pipelineTypes";

export default function Tab() {
  // language toggle: 'en' = English, 'tl' = Tagalog
  const [lang, setLang] = useState<'en' | 'tl'>('en');
  const T = {
    en: {
      quickTitle: 'Recording Tips',
      item1: 'Place device on a stable surface or have someone hold it steady at waist height.',
      item2: 'Turn the device sideways (landscape).',
      item3: 'Stand to the side so the whole body (head to feet) is visible.',
      item4: 'Walk straight from left → right across the frame.',
      item5: 'Record at least 3 full steps but do not exceed 10 seconds.',
      tip: 'Tip: Watch the sample video for an example.',
      sampleLink: 'See sample video',
      langToggle: 'TL',
    },
    tl: {
      quickTitle: 'Tips sa Pagre-record',
      item1: 'Ilagay ang device sa matibay na patungan o hayaan may humawak nito sa taas ng balakang.',
      item2: 'I-turn ang device nang pahalang (landscape).',
      item3: 'Tumayo sa gilid para makita ang buong katawan (ulo hanggang paa).',
      item4: 'Maglakad nang diretso mula kaliwa → kanan sa frame.',
      item5: 'Mag-record ng hindi bababa sa 3 buong hakbang ngunit huwag lalampas sa 10 segundo.',
      tip: 'Tip: Panoorin ang sample video para halimbawa.',
      sampleLink: 'Tingnan ang sample video',
      langToggle: 'EN',
    },
  };

  const [sampleVisible, setSampleVisible] = useState(false);
  const [sampleVideoUri, setSampleVideoUri] = useState<string | null>(null);

  // load bundled sample video and expose a file:// URI usable by <Video />
  useEffect(() => {
    (async () => {
      try {
        const moduleId = require("../../assets/test_videos/Rebb_normal.mp4");
        const asset = Asset.fromModule(moduleId);
        await asset.downloadAsync();
        setSampleVideoUri(asset.localUri ?? asset.uri);
      } catch (e) {
        console.warn("Failed to load sample video asset:", e);
        setSampleVideoUri(null);
      }
    })();
  }, []);

  const router = useRouter();
  const { videoUri, fileName, pickVideo, isCompressing, resetVideo } =
    useVideoPickerLogic();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{
    frameIndex: number;
    percent?: number;
  } | null>(null);
  const [result, setResult] = useState<PoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seiPng, setSeiPng] = useState<string | null>(null);
  const [seiSavedPath, setSeiSavedPath] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [cnnResult, setCnnResult] = useState<{
    predictedClass: string;
    confidence: number;
    allScores: { label: string; score: number }[];
  } | null>(null);
  const [cnnLoading, setCnnLoading] = useState(false);
  const [cnnModelReady, setCnnModelReady] = useState(false);
  const [bilstmModelReady, setBilstmModelReady] = useState(false);
  const [bilstmResult, setBilstmResult] = useState<{
    isAbnormal: boolean;
    meanError: number;
    maxError: number;
    numWindows: number;
    globalThreshold: number;
    confidence: number;
    jointErrors: Array<{
      joint: string;
      error: number;
      isAbnormal: boolean;
      threshold: number;
      xError: number;
      yError: number;
    }>;
    worstJoint: string;
    worstJointError: number;
    abnormalJointCount: number;
  } | null>(null);
  const webViewRef = useRef<WebView>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [showPreview, setShowPreview] = useState(true); // Temporarily show WebView for debugging
  const { width } = useWindowDimensions();

  // Pipeline state
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showUserInfoForm, setShowUserInfoForm] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const logsRef = useRef<string[]>([]);

  // User info state
  const [userInfo, setUserInfo] = useState<{
    name: string;
    gender: string;
    age: string;
    notes: string;
  }>({ name: "", gender: "", age: "", notes: "" });

  // Download progress state
  const [downloadStatus, setDownloadStatus] = useState<{
    fileName: string;
    status: "started" | "downloading" | "complete";
    percent?: number;
    loaded: number;
    total: number;
    receivedBytes?: number;
    totalBytes?: number;
  } | null>(null);

  const player = useVideoPlayer(videoUri, (player) => {
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
        const moduleId = require("../web/mediapipe_pose.html");
        const asset = Asset.fromModule(moduleId);
        // Ensure the asset is available locally; on native this resolves a file:// URI
        await asset.downloadAsync();
        if (!asset.localUri)
          throw new Error("HTML asset localUri not available");
        // Read the HTML file contents and feed it directly to WebView
        const content = await FileSystem.readAsStringAsync(asset.localUri);
        setHtmlContent(content);
      } catch (err: any) {
        console.error("Failed to load MediaPipe assets:", err);
      }
    }
    loadHTML();
  }, []);

  // Initialize CNN model on mount
  useEffect(() => {
    async function initCNN() {
      try {
        console.log("[App] Initializing CNN model...");
        await initializeCNNModel();
        setCnnModelReady(true);
        console.log("[App] CNN model ready!");
      } catch (err: any) {
        console.error("[App] Failed to initialize CNN:", err);
        setError(`Failed to load CNN model: ${err.message}`);
      }
    }
    initCNN();
  }, []);

  // Initialize BiLSTM model on mount
  useEffect(() => {
    async function initBiLSTM() {
      try {
        console.log("[App] Initializing BiLSTM model...");
        await initializeBiLSTMModel();
        setBilstmModelReady(true);
        console.log("[App] BiLSTM model ready!");
      } catch (err: any) {
        console.error("[App] Failed to initialize BiLSTM:", err);
        setError(`Failed to load BiLSTM model: ${err.message}`);
      }
    }
    initBiLSTM();
  }, []);

  // Helper function to add logs
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;

    // Store in array for step detection in UI
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
    handleWebViewMessage(
      event,
      fileName,
      setResult,
      setProgress,
      setError,
      setRunning
    );
    try {
      const message = JSON.parse(event.nativeEvent.data);

      // Forward console logs from WebView
      if (message.type === "console") {
        const prefix =
          message.level === "error"
            ? "❌"
            : message.level === "warn"
            ? "⚠️"
            : "📝";
        return;
      }

      // Handle download progress
      if (message.type === "download_progress") {
        setDownloadStatus({
          fileName: message.fileName,
          status: message.status,
          percent: message.percent,
          loaded: message.loaded,
          total: message.total,
          receivedBytes: message.receivedBytes,
          totalBytes: message.totalBytes,
        });

        // Clear download status after last file
        if (message.status === "complete" && message.loaded === message.total) {
          setTimeout(() => setDownloadStatus(null), 2000);
        }
        return;
      }

      if (
        message.type === "status" &&
        String(message.message).toLowerCase().includes("initialized")
      ) {
        setWebViewReady(true);
      }
      if (
        message.type === "progress" &&
        pipelineCallbacksRef.current.onProgress
      ) {
        pipelineCallbacksRef.current.onProgress(message);
      }
      if (message.type === "complete" && message.results) {
        const baseName = fileName?.split(".")[0] || "video";
        const posesDir = `${FileSystem.documentDirectory}poses`;
        const outputFile = `${posesDir}/${baseName}_pose.json`;
        await FileSystem.makeDirectoryAsync(posesDir, { intermediates: true });
        await FileSystem.writeAsStringAsync(
          outputFile,
          JSON.stringify(message.results, null, 2),
          { encoding: "utf8" }
        );
        const result = {
          success: true,
          outputFile,
          frameCount: message.results.metadata.frame_count,
          width: message.results.metadata.width,
          height: message.results.metadata.height,
          fps: message.results.metadata.fps,
        };
        setResult(result);

        // Notify pipeline callback
        if (pipelineCallbacksRef.current.onComplete) {
          pipelineCallbacksRef.current.onComplete(result);
        }
      }
      if (message.type === "error" && pipelineCallbacksRef.current.onError) {
        pipelineCallbacksRef.current.onError(message.message);
      }
    } catch (err) {}
  };

  // Main pipeline runner
  const runCompletePipeline = async () => {
    if (!videoUri || !webViewReady || !cnnModelReady || !bilstmModelReady) {
      alert("Please ensure video is selected and models are ready");
      return;
    }

    setIsPipelineRunning(true);
    logsRef.current = [];
    setPipelineLogs([]);
    setError(null);

    try {
      // Step 1: Extract Keypoints
      addLog("Step 1: Starting keypoint extraction...");

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
          },
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
          fileName || ""
        );
      });

      addLog("  ✓ Keypoint extraction complete");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 2: BiLSTM Anomaly Detection
      addLog("Step 2: Running BiLSTM anomaly detection...");

      if (!keypointResult) {
        throw new Error("Keypoint extraction failed - no result");
      }

      // Type assertion to help TypeScript understand keypointResult is not null
      const validKeypointResult = keypointResult as PoseResult;
      const anomalyResult = await detectGaitAnomaly(
        validKeypointResult.outputFile
      );
      setBilstmResult(anomalyResult);

      addLog(`  ✓ BiLSTM detection complete!`);
      addLog(`  Result: ${anomalyResult.isAbnormal ? "ABNORMAL" : "NORMAL"}`);
      addLog(`  Confidence: ${anomalyResult.confidence.toFixed(2)}%`);
      addLog(`  Max Error: ${anomalyResult.maxError.toFixed(6)}`);
      
      // Log worst joint if any are abnormal
      const abnormalJoints = anomalyResult.jointErrors.filter(j => j.isAbnormal);
      if (abnormalJoints.length > 0) {
        addLog(`  ⚠️ ${abnormalJoints.length} joint(s) showing irregular patterns`);
        addLog(`  Worst Joint: ${anomalyResult.worstJoint} (${anomalyResult.worstJointError.toFixed(6)})`);
      }
      
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 3: Generate SEI
      addLog("Step 3: Generating SEI image...");

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

      addLog("  ✓ SEI image generated");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 4: CNN Classification
      addLog("Step 4: Running CNN classification...");

      if (!seiPath) {
        throw new Error("SEI path not available");
      }

      const classificationResult = await classifySEI(seiPath);
      setCnnResult(classificationResult);

      addLog(`  ✓ Classification complete!`);
      addLog(`  Predicted: ${classificationResult.predictedClass}`);
      addLog(
        `  Confidence: ${(classificationResult.confidence * 100).toFixed(2)}%`
      );
      addLog("");
      addLog("🎉 Pipeline completed successfully!");

      // Wait a moment before showing results
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setIsPipelineRunning(false);
      setShowResults(true);
    } catch (err: any) {
      addLog("");
      addLog(`❌ Error: ${err.message}`);
      setError(err.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      setIsPipelineRunning(false);
      setShowResults(false);
    }
  };

  // Reset and start new analysis
  const startNewAnalysis = () => {
    setShowResults(false);
    setShowUserInfoForm(false);
    setResult(null);
    setSeiPng(null);
    setSeiSavedPath(null);
    setCnnResult(null);
    setError(null);
    logsRef.current = [];
    setPipelineLogs([]);
    setUserInfo({
      name: "",
      gender: "",
      age: "",
      notes: "",
    });
    resetVideo();
  };

  // Show user info form to save report
  const handleSaveReport = () => {
    setShowResults(false);
    setShowUserInfoForm(true);
  };

  // Cancel user info form and go back to results
  const handleCancelUserInfo = () => {
    setShowUserInfoForm(false);
    setShowResults(true);
  };

  // Save to history
  const handleSaveToHistory = async () => {
    try {
      // Import AsyncStorage dynamically
      const AsyncStorage = await import(
        "@react-native-async-storage/async-storage"
      ).then((mod) => mod.default);

      // Save SEI image to file system first to get a URI
      let imageUris: string[] | undefined = undefined;
      if (seiPng && seiSavedPath) {
        imageUris = [seiSavedPath];
      }

      // Create history item with complete analysis data
      const historyItem = {
        id: Date.now(),
        name: userInfo.name.trim() || "Unknown",
        gaitType: cnnResult
          ? `${cnnResult.predictedClass} (${(
              cnnResult.confidence * 100
            ).toFixed(0)}%)`
          : "Unspecified",
        jointDeviations: undefined, // Will be implemented later
        gender: userInfo.gender.trim() || undefined,
        age: userInfo.age.trim() || undefined,
        notes: userInfo.notes.trim() || undefined,
        images: imageUris,
        createdAt: new Date().toISOString(),
        // Add BiLSTM pattern analysis data
        patternAnalysis: bilstmResult
          ? {
              isAbnormal: bilstmResult.isAbnormal,
              confidence: bilstmResult.confidence,
              meanError: bilstmResult.meanError,
              maxError: bilstmResult.maxError,
              globalThreshold: bilstmResult.globalThreshold,
              abnormalJointCount: bilstmResult.abnormalJointCount,
              worstJoint: bilstmResult.worstJoint,
              jointErrors: bilstmResult.jointErrors,
            }
          : undefined,
        // Add SEI base64 for PDF embedding
        seiImageBase64: seiPng || undefined,
        // Add CNN confidence separately for clarity
        cnnConfidence: cnnResult?.confidence,
      };

      // Load existing history
      const STORAGE_KEY = "gaitaware:history";
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      const history = existingData ? JSON.parse(existingData) : [];

      // Add new item at beginning
      const updatedHistory = [historyItem, ...history];

      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));

      alert("Report saved to history successfully!");

      // Reset and go back to home
      startNewAnalysis();
    } catch (err: any) {
      console.error("Failed to save to history:", err);
      alert("Failed to save report. Please try again.");
    }
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
      fileName || ""
    );
  };

  const onGenerateSei = () =>
    generateSei(
      result,
      fileName,
      setSeiPng,
      setSeiSavedPath,
      setGenerating,
      setError
    );

  const onRunCNN = async () => {
    if (!seiSavedPath) {
      setError("No SEI image available");
      return;
    }

    try {
      setCnnLoading(true);
      setError(null);

      const classificationResult = await classifySEI(seiSavedPath);
      setCnnResult(classificationResult);
    } catch (err: any) {
      console.error("[App] CNN classification failed:", err);
      setError(`CNN classification failed: ${err.message}`);
    } finally {
      setCnnLoading(false);
    }
  };

  const onExportSei = () => exportSei(seiSavedPath, fileName);

  const onExportJson = () => exportJson(result, fileName);

  return (
    <>
      {/* Hidden WebView - Always mounted to maintain state */}
      {htmlContent ? (
        <View style={{ width: 0, height: 0, overflow: "hidden" }}>
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={{ width: 1, height: 1, opacity: 0.01 }}
            onMessage={onMessage}
            javaScriptEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={["*"]}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            cacheEnabled={false}
            incognito={true}
            sharedCookiesEnabled={false}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error("[WebView] Error:", nativeEvent);
              setError(
                `WebView error: ${nativeEvent.description || "Unknown error"}`
              );
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error(
                "[WebView] HTTP Error:",
                nativeEvent.statusCode,
                nativeEvent.url
              );
              setError(
                `Failed to load resource: ${nativeEvent.url} (${nativeEvent.statusCode})`
              );
            }}
          />
        </View>
      ) : null}

      {isPipelineRunning ? (
        <PipelineLoadingScreen
          logs={pipelineLogs}
          downloadStatus={downloadStatus}
        />
      ) : showResults ? (
        <PipelineResultsScreen
          cnnResult={cnnResult}
          bilstmResult={bilstmResult}
          seiPng={seiPng}
          videoFileName={fileName || undefined}
          onLearnMore={() => {
            const gaitType =
              cnnResult?.predictedClass.toLowerCase() || "normal";
            router.push(`/glossary?gait=${gaitType}`);
          }}
          onStartNew={startNewAnalysis}
          onSaveReport={handleSaveReport}
        />
      ) : showUserInfoForm ? (
        <ScrollView style={styles.scrollContainer}>
          <View style={styles.container}>
            <View style={styles.userInfoFormContainer}>
              <Text style={styles.formTitle}>Save to History</Text>
              <Text style={styles.formSubtitle}>
                Add optional details to help you remember this analysis later
              </Text>

              <UserInfo initialData={userInfo} onChange={setUserInfo} />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveToHistory}
              >
                <Text style={styles.saveButtonText}>Save to History</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelLink}
                onPress={handleCancelUserInfo}
              >
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : !webViewReady || !cnnModelReady || !bilstmModelReady ? (
        // Initial Loading Screen
        <View style={styles.initialLoadingContainer}>
          <Text style={styles.appTitle}>Gait Analysis</Text>
          <ActivityIndicator
            size="large"
            color="#007AFF"
            style={styles.loadingSpinner}
          />
          <Text style={styles.initialLoadingTitle}>
            Preparing Analysis Tools...
          </Text>
          <Text style={styles.loadingSubtext}>
            This will only take a moment
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollContainer}>
          <View style={styles.container}>
            <Text style={styles.sectionTitle}>Gait Analysis</Text>
            <Text style={styles.sectionSubtitle}>
              {videoUri
                ? "Video ready for analysis"
                : "Select a video to begin"}
            </Text>

            {!videoUri || isCompressing ? (
              <View style={styles.videoContainer}>
                <VideoPicker
                  onPress={pickVideo}
                  isCompressing={isCompressing}
                />
              </View>
            ) : (
              <VideoPreview
                uri={videoUri}
                fileName={fileName}
                player={player}
                onChangeVideo={pickVideo}
              />
            )}

            {/* Start Analysis (placed directly below the select video section) */}
            {/* Group wrapper to align Start button and instructions to the same width */}
            <View style={{ width: "100%", maxWidth: 680, alignItems: "center", marginTop: 12 }}>
              <View style={styles.nextButtonContainer}>
                <TouchableOpacity
                  style={[
                    styles.nextButton,
                    (!videoUri || !webViewReady || !cnnModelReady || !bilstmModelReady) &&
                      styles.nextButtonDisabled,
                  ]}
                  onPress={runCompletePipeline}
                  disabled={!videoUri || !webViewReady || !cnnModelReady || !bilstmModelReady}
                >
                  <Text style={styles.nextButtonText}>
                    {!webViewReady || !cnnModelReady || !bilstmModelReady ? "Loading models..." : "Start Analysis"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Clear, easy-to-read recording instructions shown AFTER the Start Analysis button.
                  The instructions container now fills the same width as the button above. */}
              <View style={[styles.instructionsContainer, { width: "100%", marginTop: 12 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.instructionsTitle}>{T[lang].quickTitle}</Text>
                  <TouchableOpacity onPress={() => setLang(l => (l === "en" ? "tl" : "en"))} style={styles.langToggleSubtle}>
                    <Text style={styles.langToggleSubtleText}>{T[lang].langToggle}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.instructionItem}>• {T[lang].item1}</Text>
                <Text style={styles.instructionItem}>• {T[lang].item2}</Text>
                <Text style={styles.instructionItem}>• {T[lang].item3}</Text>
                <Text style={styles.instructionItem}>• {T[lang].item4}</Text>
                <Text style={styles.instructionItem}>• {T[lang].item5}</Text>
                <Text style={styles.instructionTip}>
                  <Text onPress={() => setSampleVisible(true)} style={styles.sampleLinkInline} accessibilityRole="link">
                    Click here to see sample video.
                  </Text>
                </Text>
              </View>
            </View>

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
                  <Text style={styles.stepTitle}>
                    Step 2: Extract Keypoints
                  </Text>
                  <Button
                    title="Analyze Video"
                    onPress={onExtractKeypoints}
                    disabled={!videoUri || running || !webViewReady}
                  />
                  {!webViewReady && (
                    <Text style={{ marginTop: 8, color: "#666" }}>
                      Initializing pose engine…
                    </Text>
                  )}

                  {running && (
                    <View style={styles.progress}>
                      <ActivityIndicator size="large" />
                      <Text style={styles.progressText}>
                        Processing...
                        {progress?.frameIndex
                          ? ` ${progress!.frameIndex} frames`
                          : ""}
                        {typeof progress?.percent === "number"
                          ? ` (${Math.round(progress!.percent!)}%)`
                          : ""}
                      </Text>
                    </View>
                  )}

                  {result && (
                    <View style={styles.result}>
                      <Text style={styles.resultText}>
                        ✓ Analysis Complete!
                      </Text>
                      <Text>Frames processed: {result?.frameCount}</Text>
                      <Text>
                        Video size: {result?.width}x{result?.height}
                      </Text>
                      <Text style={styles.outputPath}>
                        Output: {result?.outputFile}
                      </Text>
                      <View style={{ marginTop: 12 }}>
                        <Button
                          title="Export JSON to Downloads"
                          onPress={onExportJson}
                        />
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
                  <Button
                    title="Generate SEI"
                    onPress={onGenerateSei}
                    disabled={!result || generating}
                  />

                  {generating && (
                    <View style={styles.progress}>
                      <ActivityIndicator size="large" />
                      <Text style={styles.progressText}>Generating SEI…</Text>
                    </View>
                  )}

                  {seiPng ? (
                    <View style={{ marginTop: 12, alignItems: "center" }}>
                      <Text style={{ fontWeight: "600" }}>SEI Preview</Text>
                      <Image
                        source={{ uri: "data:image/png;base64," + seiPng }}
                        style={{
                          width: 224,
                          height: 224,
                          marginTop: 8,
                          borderWidth: 1,
                          borderColor: "#ddd",
                        }}
                      />
                    </View>
                  ) : null}

                  {seiSavedPath && (
                    <Text style={{ marginTop: 8 }}>Saved: {seiSavedPath}</Text>
                  )}

                  <View style={{ marginTop: 12 }}>
                    <Button
                      title="Export SEI to Downloads"
                      onPress={onExportSei}
                      disabled={!seiSavedPath}
                    />
                  </View>
                </View>

                {/* Step 4: CNN Classification */}
                <View style={styles.extractionContainer}>
                  <Text style={styles.stepTitle}>
                    Step 4: Gait Classification
                  </Text>
                  <Text
                    style={{
                      marginBottom: 12,
                      color: "#666",
                      textAlign: "center",
                    }}
                  >
                    {cnnModelReady
                      ? "✓ CNN model loaded"
                      : "Loading CNN model..."}
                  </Text>

                  <Button
                    title="Classify Gait"
                    onPress={onRunCNN}
                    disabled={!seiSavedPath || cnnLoading || !cnnModelReady}
                  />

                  {cnnLoading && (
                    <View style={styles.progress}>
                      <ActivityIndicator size="large" />
                      <Text style={styles.progressText}>
                        Classifying gait pattern...
                      </Text>
                    </View>
                  )}

                  {cnnResult && (
                    <View style={styles.result}>
                      <Text style={styles.resultText}>
                        🎯 Predicted: {cnnResult?.predictedClass}
                      </Text>
                      <Text style={{ fontSize: 18, marginTop: 8 }}>
                        Confidence:{" "}
                        {((cnnResult?.confidence ?? 0) * 100).toFixed(2)}%
                      </Text>

                      <Text
                        style={{
                          fontWeight: "600",
                          marginTop: 16,
                          marginBottom: 8,
                        }}
                      >
                        All Predictions:
                      </Text>
                      {cnnResult?.allScores.map((item, index) => (
                        <View key={index} style={{ marginVertical: 4 }}>
                          <Text style={{ fontSize: 14 }}>
                            {item.label}: {(item.score * 100).toFixed(2)}%
                          </Text>
                          <View
                            style={{
                              height: 4,
                              backgroundColor: "#e0e0e0",
                              borderRadius: 2,
                              marginTop: 2,
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                height: "100%",
                                width: `${item.score * 100}%`,
                                backgroundColor:
                                  index === 0 ? "#4caf50" : "#9e9e9e",
                                borderRadius: 2,
                              }}
                            />
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

      {/* Sample Video Modal (plays bundled assets/test_videos/Rebb_normal.mp4) */}
      <Modal visible={sampleVisible} animationType="slide" onRequestClose={() => setSampleVisible(false)}>
        <View style={styles.sampleModalContent}>
          {sampleVideoUri ? (
            <Video
              source={{ uri: sampleVideoUri }}
              useNativeControls
              resizeMode="contain"
              style={{ width: "100%", height: 360, backgroundColor: "#000" }}
            />
          ) : (
            <Text style={{ color: "#fff" }}>Sample video not available</Text>
          )}
          <TouchableOpacity onPress={() => setSampleVisible(false)} style={{ marginTop: 12 }}>
            <Text style={styles.sampleCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    padding: 32,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  sectionSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  videoContainer: {
    width: "100%",
    alignSelf: "center",
    alignItems: "center",
    marginTop: 20,
    maxWidth: 600,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 8,
  },
  sampleLinkWrap: { width: "100%", maxWidth: 600, alignItems: "flex-start", marginTop: 12 },
  sampleLink: { color: "#0b62d6", fontWeight: "600" },
  sampleModalContent: { flex: 1, backgroundColor: "#000", padding: 16, justifyContent: "center", alignItems: "center" },
  sampleCloseText: { color: "#fff", fontSize: 16, fontWeight: "600", marginTop: 8 },
  extractionContainer: {
    width: "100%",
    maxWidth: 600,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
  },
  progress: {
    marginTop: 16,
    alignItems: "center",
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
  },
  result: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    width: "100%",
  },
  resultText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 8,
  },
  outputPath: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  error: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#ffebee",
    borderRadius: 8,
    width: "100%",
  },
  errorText: {
    color: "#c62828",
    fontSize: 14,
  },
  nextButtonContainer: {
    width: "100%",
    maxWidth: 600,
    marginTop: 24,
    marginBottom: 32,
    alignItems: "center",
  },
  nextButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  nextButtonDisabled: {
    backgroundColor: "#ccc",
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  resultsSection: {
    width: "100%",
    maxWidth: 600,
    marginTop: 32,
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  userInfoFormContainer: {
    width: "100%",
    maxWidth: 600,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  formSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
    textAlign: "center",
  },
  formHint: {
    fontSize: 14,
    color: "#999",
    marginBottom: 24,
    textAlign: "center",
    fontStyle: "italic",
  },
  saveButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 28,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  cancelLink: {
    marginTop: 20,
    paddingVertical: 8,
    alignItems: "center",
  },
  cancelLinkText: {
    color: "#007AFF",
    fontSize: 15,
  },
  initialLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 40,
  },
  loadingSpinner: {
    marginBottom: 20,
  },
  initialLoadingTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 30,
  },
  loadingDetailsContainer: {
    width: "80%",
    maxWidth: 300,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingItem: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  loadingItemText: {
    fontSize: 16,
    color: "#666",
  },
  loadingSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 10,
  },
  instructionsContainer: {
    marginTop: 12,
    marginHorizontal: 12,
    padding: 14,
    backgroundColor: "#fff9f0",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f1d8b0",
    maxWidth: 680,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },
  instructionItem: {
    fontSize: 18,
    lineHeight: 26,
    color: "#111",
    marginBottom: 8,
  },
  instructionTip: {
    marginTop: 8,
    fontSize: 17,
    color: "#0b62d6",
    fontWeight: "700",
  },
  /* smaller language toggle */
  langToggleSubtle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#0b62d6',
    borderRadius: 12,
    // reduced shadow for subtle prominence
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 0,
  },
  langToggleSubtleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sampleLinkInline: { color: "#0b62d6", fontWeight: "800", textDecorationLine: "underline", fontSize: 17 },
  largeTouchable: { minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "center" },
});

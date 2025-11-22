import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface PipelineLoadingScreenProps {
  logs: string[];
  downloadStatus?: {
    fileName: string;
    status: "started" | "downloading" | "complete";
    percent?: number;
    loaded: number;
    total: number;
    receivedBytes?: number;
    totalBytes?: number;
  } | null;
}

export function PipelineLoadingScreen({
  logs,
  downloadStatus,
}: PipelineLoadingScreenProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logs.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [logs]);

  // Determine current step based on logs
  const getCurrentStep = () => {
    const lastLog = logs[logs.length - 1] || "";
    if (lastLog.includes("Step 4") || lastLog.includes("Classification"))
      return 4;
    if (lastLog.includes("Step 3") || lastLog.includes("SEI")) return 3;
    if (
      lastLog.includes("Step 2") ||
      lastLog.includes("BiLSTM") ||
      lastLog.includes("Anomaly")
    )
      return 2;
    if (
      lastLog.includes("Step 1") ||
      lastLog.includes("keypoint") ||
      lastLog.includes("Processing frame")
    )
      return 1;
    if (lastLog.includes("completed successfully")) return 5;
    return 0;
  };

  const currentStep = getCurrentStep();
  const steps = [
    { id: 1, label: "Analyzing motion" },
    { id: 2, label: "Detecting patterns" },
    { id: 3, label: "Generating visualization" },
    { id: 4, label: "Classifying gait" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Loading Spinner */}
        <ActivityIndicator
          size="large"
          color="#007AFF"
          style={styles.spinner}
        />

        {/* Title */}
        <Text style={styles.title}>Analyzing Gait</Text>
        <Text style={styles.subtitle}>This may take a few moments...</Text>

        {/* Progress Steps */}
        <View style={styles.stepsContainer}>
          {steps.map((step) => (
            <View key={step.id} style={styles.stepItem}>
              <View
                style={[
                  styles.stepIndicator,
                  currentStep > step.id && styles.stepIndicatorComplete,
                  currentStep === step.id && styles.stepIndicatorActive,
                ]}
              >
                {currentStep > step.id ? (
                  <Text style={styles.stepCheckmark}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      currentStep === step.id && styles.stepNumberActive,
                    ]}
                  >
                    {step.id}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  currentStep >= step.id && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    width: "100%",
    maxWidth: 600,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  spinner: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
    textAlign: "center",
  },
  stepsContainer: {
    width: "100%",
    gap: 16,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
    borderWidth: 2,
    borderColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndicatorActive: {
    backgroundColor: "#e3f2fd",
    borderColor: "#007AFF",
  },
  stepIndicatorComplete: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
  },
  stepNumberActive: {
    color: "#007AFF",
  },
  stepCheckmark: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "bold",
  },
  stepLabel: {
    fontSize: 16,
    color: "#999",
    flex: 1,
  },
  stepLabelActive: {
    color: "#333",
    fontWeight: "500",
  },
});

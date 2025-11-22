import React from "react";
import {
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface PipelineResultsScreenProps {
  cnnResult: {
    predictedClass: string;
    confidence: number;
    allScores: { label: string; score: number }[];
  } | null;
  bilstmResult: {
    isAbnormal: boolean;
    meanError: number;
    maxError: number;
    numWindows: number;
    threshold: number;
    confidence: number;
  } | null;
  seiPng: string | null;
  videoFileName?: string;
  onExportResults?: () => void;
  onStartNew?: () => void;
  onSaveReport?: () => void;
}

export function PipelineResultsScreen({
  cnnResult,
  bilstmResult,
  seiPng,
  videoFileName,
  onExportResults,
  onStartNew,
  onSaveReport,
}: PipelineResultsScreenProps) {
  return (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.container}>
        {/* Success Header */}
        <View style={styles.header}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.title}>Analysis Complete</Text>
          <Text style={styles.subtitle}>
            Your gait has been analyzed successfully
          </Text>
        </View>

        {/* Main Results Card */}
        {cnnResult && bilstmResult && (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>Results</Text>

            {/* Pattern Analysis - Most Important First */}
            <View
              style={[
                styles.resultBox,
                {
                  backgroundColor: bilstmResult.isAbnormal
                    ? "#fff3e0"
                    : "#e8f5e9",
                },
              ]}
            >
              <Text style={styles.resultLabel}>Pattern Analysis</Text>
              <Text
                style={[
                  styles.resultValue,
                  { color: bilstmResult.isAbnormal ? "#ef6c00" : "#2e7d32" },
                ]}
              >
                {bilstmResult.isAbnormal
                  ? "Irregular pattern detected"
                  : "Normal pattern"}
              </Text>
            </View>

            {/* Gait Type - Secondary Detail */}
            <View
              style={[
                styles.resultBox,
                {
                  backgroundColor: bilstmResult.isAbnormal
                    ? "#fff3e0"
                    : "#e8f5e9",
                },
              ]}
            >
              <Text style={styles.resultLabel}>Gait Type</Text>
              <Text
                style={[
                  styles.resultValue,
                  { color: bilstmResult.isAbnormal ? "#ef6c00" : "#2e7d32" },
                ]}
              >
                {cnnResult.predictedClass}
              </Text>
              <Text
                style={[
                  styles.resultConfidence,
                  { color: bilstmResult.isAbnormal ? "#ef6c00" : "#2e7d32" },
                ]}
              >
                {(cnnResult.confidence * 100).toFixed(0)}% confidence
              </Text>
            </View>
          </View>
        )}

        {/* SEI Image Preview */}
        {seiPng && (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>Gait Pattern</Text>
            <View style={styles.seiContainer}>
              <Image
                source={{ uri: "data:image/jpeg;base64," + seiPng }}
                style={styles.seiImage}
                resizeMode="contain"
              />
              <Text style={styles.seiDescription}>
                Visual representation of your walking pattern
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {onSaveReport && (
            <View style={styles.buttonWrapper}>
              <Button
                title="Save Report"
                onPress={onSaveReport}
                color="#FF9500"
              />
            </View>
          )}
          {onExportResults && (
            <View style={styles.buttonWrapper}>
              <Button
                title="Export Details"
                onPress={onExportResults}
                color="#007AFF"
              />
            </View>
          )}
          {onStartNew && (
            <View style={styles.buttonWrapper}>
              <Button
                title="Analyze New Video"
                onPress={onStartNew}
                color="#34C759"
              />
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
    backgroundColor: "#f5f5f5",
  },
  container: {
    padding: 20,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    paddingVertical: 20,
  },
  successIcon: {
    fontSize: 64,
    color: "#4caf50",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  resultCard: {
    width: "100%",
    maxWidth: 600,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  resultBox: {
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  resultLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  resultConfidence: {
    fontSize: 16,
    fontWeight: "500",
  },

  seiContainer: {
    alignItems: "center",
  },
  seiImage: {
    width: 224,
    height: 224,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 12,
  },
  seiDescription: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },
  actionsContainer: {
    width: "100%",
    maxWidth: 600,
    marginTop: 8,
  },
  buttonWrapper: {
    marginVertical: 8,
  },
});

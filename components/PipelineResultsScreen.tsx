import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Glossary data matching the glossary.tsx structure
const GAIT_GLOSSARY: Record<
  string,
  {
    title: string;
    description: string;
    conditions: string[];
  }
> = {
  normal: {
    title: "Normal gait",
    description:
      "A steady, balanced way of walking where both legs move smoothly in rhythm. There is even weight on both sides, proper foot lift, and coordinated arm swing.",
    conditions: ["None; this is the standard walking pattern"],
  },
  shuffling: {
    title: "Shuffling gait",
    description:
      "Short, dragging steps with little foot lift, often with a stooped posture and reduced arm swing.",
    conditions: [
      "Parkinson's disease",
      "Normal pressure hydrocephalus",
      "Drug-induced parkinsonism",
    ],
  },
  diplegic: {
    title: "Diplegic gait",
    description:
      "The legs cross or hit each other while walking, making the steps look like scissor blades.",
    conditions: ["Cerebral palsy", "Spastic paraplegia", "Bilateral stroke"],
  },
  hemiplegic: {
    title: "Hemiplegic gait",
    description:
      "The affected leg is stiff and swings in a half-circle (circumduction) while the arm on the same side may stay flexed.",
    conditions: [
      "Stroke",
      "Multiple sclerosis",
      "Cerebral palsy",
      "Spinal cord injury",
    ],
  },
  neuropathic: {
    title: "Neuropathic gait",
    description:
      "The person lifts the foot higher than normal to avoid tripping because the toes do not lift properly.",
    conditions: [
      "Peroneal nerve injury",
      "Diabetic neuropathy",
      "Multiple sclerosis",
      "Charcot–Marie–Tooth disease",
    ],
  },
};

// Map CNN model output to glossary IDs
const mapGaitTypeToGlossaryId = (gaitType: string): string => {
  const normalized = gaitType.toLowerCase();
  if (normalized === "parkinson") return "shuffling";
  return normalized;
};

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
  } | null;
  seiPng: string | null;
  videoFileName?: string;
  onLearnMore?: () => void;
  onStartNew?: () => void;
  onSaveReport?: () => void;
}

export function PipelineResultsScreen({
  cnnResult,
  bilstmResult,
  seiPng,
  videoFileName,
  onLearnMore,
  onStartNew,
  onSaveReport,
}: PipelineResultsScreenProps) {
  // State for expandable sections
  const [showJointDetails, setShowJointDetails] = useState(false);

  return (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.container}>
        {/* Success Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analysis Complete</Text>
          <Text style={styles.subtitle}>
            Your gait has been analyzed successfully
          </Text>
        </View>

        {/* Summary Card - Simple overview for everyone */}
        {cnnResult && bilstmResult && (
          <View
            style={[
              styles.summaryCard,
              {
                borderLeftColor: bilstmResult.isAbnormal
                  ? "#ef6c00"
                  : "#4caf50",
              },
            ]}
          >
            <Text style={styles.summaryTitle}>
              {bilstmResult.isAbnormal
                ? "We Found Some Differences"
                : "Everything Looks Good"}
            </Text>
            <Text style={styles.summaryDescription}>
              {bilstmResult.isAbnormal
                ? "Your walking shows some differences from typical patterns. Please review the details below and consider talking to a healthcare professional."
                : "Your walking shows steady, balanced movements. All major joints are moving well."}
            </Text>
          </View>
        )}

        {/* Main Results Card */}
        {cnnResult && bilstmResult && (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>What We Found</Text>

            {/* Gait Type - First */}
            <View
              style={[
                styles.resultBox,
                {
                  backgroundColor:
                    cnnResult.predictedClass.toLowerCase() === "normal"
                      ? "#e8f5e9"
                      : "#fff3e0",
                },
              ]}
            >
              <Text style={styles.resultLabel}>Walking Type</Text>
              <Text
                style={[
                  styles.resultValue,
                  {
                    color:
                      cnnResult.predictedClass.toLowerCase() === "normal"
                        ? "#2e7d32"
                        : "#ef6c00",
                  },
                ]}
              >
                {cnnResult.predictedClass}
              </Text>
            </View>

            {/* Glossary Information for Detected Gait Type */}
            {(() => {
              const glossaryId = mapGaitTypeToGlossaryId(
                cnnResult.predictedClass
              );
              const glossaryEntry = GAIT_GLOSSARY[glossaryId];

              if (glossaryEntry) {
                return (
                  <>
                    <Text style={styles.subsectionLabel}>What this means:</Text>
                    <Text style={styles.subsectionDescription}>
                      {glossaryEntry.description}
                    </Text>
                    {onLearnMore && (
                      <TouchableOpacity
                        onPress={onLearnMore}
                        activeOpacity={0.7}
                        style={styles.expandButton}
                      >
                        <Text style={styles.expandButtonText}>Learn More</Text>
                      </TouchableOpacity>
                    )}
                  </>
                );
              }
              return null;
            })()}

            {/* Pattern Analysis - Second */}
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
              <Text style={styles.resultLabel}>Movement Pattern</Text>
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

            {/* Joint Analysis - Third - Show all joints except hips */}
            {bilstmResult.jointErrors &&
              bilstmResult.jointErrors.length > 0 &&
              (() => {
                // Filter out left and right hip joints
                const filteredJoints = bilstmResult.jointErrors.filter(
                  (joint) =>
                    joint.joint !== "LEFT_HIP" && joint.joint !== "RIGHT_HIP"
                );
                const filteredAbnormalCount = filteredJoints.filter(
                  (j) => j.isAbnormal
                ).length;

                return (
                  filteredJoints.length > 0 && (
                    <>
                      <Text style={styles.subsectionLabel}>Joint Movement</Text>
                      <Text style={styles.subsectionDescription}>
                        {filteredAbnormalCount > 0
                          ? "Some joints need attention - view details below"
                          : "All joints moving normally"}
                      </Text>

                      {/* Expandable Joint Details */}
                      <TouchableOpacity
                        onPress={() => setShowJointDetails(!showJointDetails)}
                        activeOpacity={0.7}
                        style={styles.expandButton}
                      >
                        <Text style={styles.expandButtonText}>
                          {showJointDetails ? "Hide details" : "View Joints"}
                        </Text>
                      </TouchableOpacity>

                      {showJointDetails && (
                        <>
                          <Text style={styles.jointExplanation}>
                            Lower percentages are better. Values at 100%
                            indicate irregular movement.
                          </Text>
                          {filteredJoints.map((joint, index) => {
                            // Calculate percentage properly (0-100%)
                            const percentage = Math.min(
                              100,
                              (joint.error / joint.threshold) * 100
                            );

                            return (
                              <View key={index} style={styles.jointRow}>
                                <View style={styles.jointHeader}>
                                  <Text style={styles.jointName}>
                                    {joint.joint.replace(/_/g, " ")}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.jointPercentage,
                                      {
                                        color: joint.isAbnormal
                                          ? "#ef6c00"
                                          : "#4caf50",
                                      },
                                    ]}
                                  >
                                    {percentage.toFixed(0)}%
                                  </Text>
                                </View>
                                <View style={styles.jointErrorBar}>
                                  <View
                                    style={[
                                      styles.jointErrorFill,
                                      {
                                        width: `${percentage}%`,
                                        backgroundColor: joint.isAbnormal
                                          ? "#ef6c00"
                                          : "#4caf50",
                                      },
                                    ]}
                                  />
                                </View>
                              </View>
                            );
                          })}
                        </>
                      )}
                    </>
                  )
                );
              })()}
          </View>
        )}

        {/* SEI Image Preview */}
        {seiPng && (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>Walking Pattern Image</Text>
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
            <TouchableOpacity
              style={styles.actionButtonOutline}
              onPress={onSaveReport}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButtonOutlineText}>
                Save to History
              </Text>
            </TouchableOpacity>
          )}
          {onStartNew && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onStartNew}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButtonText}>Start New Analysis</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionButtonOutline: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 8,
  },
  actionButtonOutlineText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
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
    lineHeight: 24,
  },
  summaryCard: {
    width: "100%",
    maxWidth: 600,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
  },
  summaryIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  summaryDescription: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    lineHeight: 24,
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
    textAlign: "center",
  },
  resultBox: {
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  resultLabel: {
    fontSize: 15,
    color: "#666",
    marginBottom: 12,
    fontWeight: "600",
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
    lineHeight: 24,
    textAlign: "center",
  },
  resultExplanation: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 24,
  },
  subsectionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  subsectionDescription: {
    fontSize: 16,
    color: "#555",
    lineHeight: 24,
    marginBottom: 12,
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
    fontSize: 15,
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
  actionButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  jointAnalysisContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  expandButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f0f8ff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#007AFF",
    marginTop: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  expandButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#007AFF",
  },
  jointDescription: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
    lineHeight: 24,
  },
  jointExplanation: {
    fontSize: 15,
    color: "#666",
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    lineHeight: 22,
    textAlign: "center",
  },
  jointRow: {
    marginBottom: 12,
  },
  jointHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  jointName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  jointPercentage: {
    fontSize: 15,
    fontWeight: "600",
  },
  jointErrorBar: {
    width: "100%",
    height: 20,
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  jointErrorFill: {
    height: "100%",
    borderRadius: 10,
  },
  glossaryContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  glossaryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  glossaryDescription: {
    fontSize: 16,
    color: "#555",
    lineHeight: 24,
    marginBottom: 12,
  },
  glossarySubheading: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 8,
    color: "#666",
  },
  glossaryCondition: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginLeft: 12,
    marginBottom: 4,
  },
  glossaryHintButton: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f0f8ff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#007AFF",
    alignItems: "center",
  },
  glossaryHint: {
    fontSize: 15,
    color: "#007AFF",
    fontWeight: "600",
    textAlign: "center",
  },
  technicalHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#f0f8ff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#007AFF",
    marginBottom: 12,
    alignItems: "center",
  },
  technicalHeaderText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#007AFF",
    textAlign: "center",
  },
  technicalContent: {
    paddingVertical: 12,
  },
  technicalLabel: {
    fontSize: 15,
    color: "#666",
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "600",
  },
  technicalValue: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
  },
  technicalNote: {
    fontSize: 15,
    color: "#666",
    marginTop: 16,
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    fontStyle: "italic",
    lineHeight: 22,
  },
});

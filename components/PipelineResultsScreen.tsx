import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

// Glossary data matching the glossary.tsx structure
const GAIT_GLOSSARY: Record<string, {
  title: string;
  description: string;
  conditions: string[];
}> = {
  normal: {
    title: "Normal gait",
    description: "A steady, balanced way of walking where both legs move smoothly in rhythm. There is even weight on both sides, proper foot lift, and coordinated arm swing.",
    conditions: ["None; this is the standard walking pattern"],
  },
  shuffling: {
    title: "Shuffling gait",
    description: "Short, dragging steps with little foot lift, often with a stooped posture and reduced arm swing.",
    conditions: [
      "Parkinson's disease",
      "Normal pressure hydrocephalus",
      "Drug-induced parkinsonism",
    ],
  },
  diplegic: {
    title: "Diplegic gait",
    description: "The legs cross or hit each other while walking, making the steps look like scissor blades.",
    conditions: ["Cerebral palsy", "Spastic paraplegia", "Bilateral stroke"],
  },
  hemiplegic: {
    title: "Hemiplegic gait",
    description: "The affected leg is stiff and swings in a half-circle (circumduction) while the arm on the same side may stay flexed.",
    conditions: [
      "Stroke",
      "Multiple sclerosis",
      "Cerebral palsy",
      "Spinal cord injury",
    ],
  },
  neuropathic: {
    title: "Neuropathic gait",
    description: "The person lifts the foot higher than normal to avoid tripping because the toes do not lift properly.",
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

            {/* Gait Type - First */}
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

            {/* Glossary Information for Detected Gait Type */}
            {(() => {
              const glossaryId = mapGaitTypeToGlossaryId(cnnResult.predictedClass);
              const glossaryEntry = GAIT_GLOSSARY[glossaryId];
              
              if (glossaryEntry) {
                return (
                  <View style={styles.glossaryContainer}>
                    <Text style={styles.glossaryTitle}>{glossaryEntry.title}</Text>
                    <Text style={styles.glossaryDescription}>{glossaryEntry.description}</Text>
                    <Text style={styles.glossarySubheading}>Common underlying conditions:</Text>
                    {glossaryEntry.conditions.map((condition, index) => (
                      <Text key={index} style={styles.glossaryCondition}>
                        • {condition}
                      </Text>
                    ))}
                  </View>
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
              <Text style={styles.resultExplanation}>
                {bilstmResult.isAbnormal
                  ? "Your walking pattern shows some variations. Consider consulting a healthcare professional for evaluation."
                  : "Your walking pattern appears healthy and balanced."}
              </Text>
            </View>

            {/* Joint Analysis - Third - Show all joints except hips */}
            {bilstmResult.jointErrors && bilstmResult.jointErrors.length > 0 && (() => {
              // Filter out left and right hip joints
              const filteredJoints = bilstmResult.jointErrors.filter(
                joint => joint.joint !== 'LEFT_HIP' && joint.joint !== 'RIGHT_HIP'
              );
              const filteredAbnormalCount = filteredJoints.filter(j => j.isAbnormal).length;
              
              return filteredJoints.length > 0 && (
                <View style={styles.jointAnalysisContainer}>
                  <Text style={styles.resultLabel}>Joint Analysis</Text>
                  <Text style={styles.jointDescription}>
                    {filteredAbnormalCount > 0 
                      ? `${filteredAbnormalCount} joint(s) showing irregular patterns:`
                      : 'All joints showing normal patterns:'}
                  </Text>
                  {filteredJoints.map((joint, index) => (
                    <View key={index} style={styles.jointRow}>
                      <Text style={styles.jointName}>{joint.joint.replace(/_/g, ' ')}</Text>
                      <View style={styles.jointErrorBar}>
                        <View 
                          style={[
                            styles.jointErrorFill,
                            { 
                              width: `${Math.min(100, (joint.error / joint.threshold) * 50)}%`,
                              backgroundColor: joint.isAbnormal ? '#ef6c00' : '#4caf50'
                            }
                          ]} 
                        />
                      </View>
                      <Text style={[styles.jointErrorValue, { color: joint.isAbnormal ? '#ef6c00' : '#4caf50' }]}>
                        {joint.error.toFixed(4)}{'\n'}
                        <Text style={styles.thresholdText}>({((joint.error / joint.threshold) * 100).toFixed(0)}%)</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}
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
            <TouchableOpacity
              style={styles.actionButtonOutline}
              onPress={onSaveReport}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButtonOutlineText}>Save to History</Text>
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
      backgroundColor: '#fff',
      borderWidth: 2,
      borderColor: '#007AFF',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      marginVertical: 8,
    },
    actionButtonOutlineText: {
      color: '#007AFF',
      fontSize: 16,
      fontWeight: '600',
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
  resultExplanation: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
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
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  jointAnalysisContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  jointDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  jointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  jointName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    width: 120,
  },
  jointErrorBar: {
    flex: 1,
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  jointErrorFill: {
    height: '100%',
    borderRadius: 10,
  },
  jointErrorValue: {
    fontSize: 12,
    color: '#666',
    width: 70,
    textAlign: 'right',
  },
  thresholdText: {
    fontSize: 10,
    color: '#999',
  },
  glossaryContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  glossaryTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  glossaryDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  glossarySubheading: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
    color: '#666',
  },
  glossaryCondition: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginLeft: 12,
    marginBottom: 4,
  },
});

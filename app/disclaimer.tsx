import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const DISCLAIMER_KEY = "gaitaware:disclaimer_accepted";

export default function DisclaimerScreen() {
  const router = useRouter();
  const [hasAccepted, setHasAccepted] = useState(false);

  const handleAccept = async () => {
    try {
      // Store acceptance in AsyncStorage
      await AsyncStorage.setItem(DISCLAIMER_KEY, "true");

      // Navigate to main app
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Failed to save disclaimer acceptance:", error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to GaitAware</Text>
        </View>

        {/* Main Content */}
        <Text style={styles.sectionTitle}>Important Notice</Text>

        <Text style={styles.paragraph}>
          GaitAware helps you understand your walking patterns through video
          analysis. This is an educational tool designed to raise awareness
          about walking health.
        </Text>

        <Text style={styles.warningTitle}>
          This is NOT a Medical Diagnosis Tool
        </Text>
        <Text style={styles.paragraph}>
          This app cannot diagnose medical conditions or replace professional
          medical advice, diagnosis, or treatment.
        </Text>

        <Text style={styles.sectionTitle}>Please Remember:</Text>

        <Text style={styles.bulletItem}>
          • Analysis results are for informational purposes only
        </Text>
        <Text style={styles.bulletItem}>
          • Use this as a tool to learn about your walking patterns
        </Text>
        <Text style={styles.bulletItem}>
          • Always consult a qualified healthcare professional for any health
          concerns
        </Text>
        <Text style={styles.bulletItem}>
          • This tool does not replace medical checkups or professional
          assessment
        </Text>

        <Text style={styles.paragraph}>
          By using this app, you acknowledge that the analysis provided is for
          educational purposes and should not be used as a substitute for
          professional medical care.
        </Text>

        {/* Checkbox */}
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setHasAccepted(!hasAccepted)}
          activeOpacity={0.7}
        >
          <View
            style={[styles.checkbox, hasAccepted && styles.checkboxChecked]}
          >
            {hasAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I understand and agree to continue
          </Text>
        </TouchableOpacity>

        {/* Accept Button */}
        <TouchableOpacity
          style={[
            styles.acceptButton,
            !hasAccepted && styles.acceptButtonDisabled,
          ]}
          onPress={handleAccept}
          disabled={!hasAccepted}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.acceptButtonText,
              !hasAccepted && styles.acceptButtonTextDisabled,
            ]}
          >
            Continue
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            GaitAware • Walking Pattern Analysis
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 32,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
    paddingTop: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 26,
    color: "#333",
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    marginTop: 16,
  },
  bulletItem: {
    fontSize: 16,
    lineHeight: 28,
    color: "#333",
    marginBottom: 12,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 0,
    marginBottom: 24,
    marginTop: 8,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: "#999",
    borderRadius: 6,
    marginRight: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  checkmark: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  acceptButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  acceptButtonDisabled: {
    backgroundColor: "#ccc",
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  acceptButtonTextDisabled: {
    color: "#999",
  },
  footer: {
    alignItems: "center",
    paddingTop: 12,
  },
  footerText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
});

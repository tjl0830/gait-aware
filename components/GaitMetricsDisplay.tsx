/**
 * GaitMetricsDisplay Component
 * Displays calculated gait parameters in a user-friendly format
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { GaitMetrics } from "../utils/gaitCalculations";

interface GaitMetricsDisplayProps {
  metrics: GaitMetrics;
  showPhase2Metrics?: boolean;
}

export function GaitMetricsDisplay({
  metrics,
  showPhase2Metrics = false,
}: GaitMetricsDisplayProps) {
  const formatMetric = (
    value: number | null | undefined,
    unit: string,
    decimals: number = 2
  ): string => {
    if (value === null || value === undefined) {
      return "—";
    }
    return `${value.toFixed(decimals)} ${unit}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gait Parameters</Text>

      {/* Phase 1 Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Metrics</Text>

        <MetricRow
          label="Walking Speed"
          value={formatMetric(metrics.walkingSpeed, "m/s")}
          icon="🚶"
        />

        <MetricRow
          label="Cadence"
          value={formatMetric(metrics.cadence, "steps/min", 0)}
          icon="👣"
        />

        <MetricRow
          label="Step Length"
          value={formatMetric(metrics.stepLength, "m")}
          icon="📏"
        />

        <MetricRow
          label="Stride Length"
          value={formatMetric(metrics.strideLength, "m")}
          icon="📐"
        />
      </View>

      {/* Phase 2 Metrics (Future) */}
      {showPhase2Metrics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Metrics</Text>

          <MetricRow
            label="Step Width"
            value={formatMetric(metrics.stepWidth, "m")}
            icon="↔️"
          />

          <MetricRow
            label="Symmetry"
            value={formatMetric(
              metrics.symmetry ? metrics.symmetry * 100 : null,
              "%",
              0
            )}
            icon="⚖️"
          />

          <MetricRow
            label="Knee Flexion Angle"
            value={formatMetric(metrics.kneeFlexionAngle, "°", 1)}
            icon="🦵"
          />

          <MetricRow
            label="Hip Flexion Angle"
            value={formatMetric(metrics.hipFlexionAngle, "°", 1)}
            icon="🦴"
          />
        </View>
      )}

      {/* Clinical Reference Ranges */}
      <View style={styles.referenceSection}>
        <Text style={styles.referenceTitle}>📋 Normal Reference Ranges</Text>
        <Text style={styles.referenceText}>
          • Walking Speed: 1.2-1.4 m/s (adults)
        </Text>
        <Text style={styles.referenceText}>• Cadence: 100-120 steps/min</Text>
        <Text style={styles.referenceText}>• Step Length: 0.6-0.8 m</Text>
        <Text style={styles.referenceText}>• Stride Length: 1.2-1.6 m</Text>
      </View>
    </View>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  icon: string;
}

function MetricRow({ label, value, icon }: MetricRowProps) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricLabel}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#555",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#E0E0E0",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  metricLabel: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
  },
  labelText: {
    fontSize: 16,
    color: "#444",
    fontWeight: "500",
  },
  metricValue: {
    fontSize: 18,
    color: "#007AFF",
    fontWeight: "600",
    minWidth: 80,
    textAlign: "right",
  },
  referenceSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  referenceTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  referenceText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
    lineHeight: 20,
  },
});

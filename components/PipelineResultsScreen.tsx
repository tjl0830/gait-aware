import React from 'react';
import { Button, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

interface PipelineResultsScreenProps {
  cnnResult: {
    predictedClass: string;
    confidence: number;
    allScores: { label: string; score: number }[];
  } | null;
  seiPng: string | null;
  videoFileName?: string;
  onExportResults?: () => void;
  onStartNew?: () => void;
}

export function PipelineResultsScreen({ 
  cnnResult, 
  seiPng, 
  videoFileName,
  onExportResults,
  onStartNew 
}: PipelineResultsScreenProps) {
  return (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.container}>
        {/* Success Header */}
        <View style={styles.header}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.title}>Analysis Complete!</Text>
          <Text style={styles.subtitle}>
            {videoFileName ? `Results for: ${videoFileName}` : 'Gait analysis completed successfully'}
          </Text>
        </View>

        {/* CNN Classification Results */}
        {cnnResult && (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>Gait Classification</Text>
            
            {/* Predicted Class */}
            <View style={styles.predictionBox}>
              <Text style={styles.predictionLabel}>Predicted Diagnosis:</Text>
              <Text style={styles.predictionClass}>{cnnResult.predictedClass}</Text>
              <Text style={styles.confidenceText}>
                Confidence: {(cnnResult.confidence * 100).toFixed(2)}%
              </Text>
            </View>

            {/* All Predictions with Bars */}
            <View style={styles.scoresContainer}>
              <Text style={styles.scoresTitle}>Detailed Scores:</Text>
              {cnnResult.allScores.map((item, index) => (
                <View key={index} style={styles.scoreRow}>
                  <View style={styles.scoreHeader}>
                    <Text style={styles.scoreLabel}>{item.label}</Text>
                    <Text style={styles.scoreValue}>
                      {(item.score * 100).toFixed(2)}%
                    </Text>
                  </View>
                  <View style={styles.scoreBarBackground}>
                    <View 
                      style={[
                        styles.scoreBarFill, 
                        { 
                          width: `${item.score * 100}%`,
                          backgroundColor: index === 0 ? '#4caf50' : '#9e9e9e'
                        }
                      ]} 
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* SEI Image Preview */}
        {seiPng && (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>Spatial Encoded Image (SEI)</Text>
            <View style={styles.seiContainer}>
              <Image
                source={{ uri: 'data:image/jpeg;base64,' + seiPng }}
                style={styles.seiImage}
                resizeMode="contain"
              />
              <Text style={styles.seiDescription}>
                This image represents the spatial patterns of your gait across all frames
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {onExportResults && (
            <View style={styles.buttonWrapper}>
              <Button 
                title="Export Results" 
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
    backgroundColor: '#f5f5f5',
  },
  container: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
  },
  successIcon: {
    fontSize: 64,
    color: '#4caf50',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  resultCard: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
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
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  predictionBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  predictionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  predictionClass: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  confidenceText: {
    fontSize: 18,
    color: '#2e7d32',
  },
  scoresContainer: {
    marginTop: 8,
  },
  scoresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  scoreRow: {
    marginBottom: 16,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  scoreBarBackground: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  seiContainer: {
    alignItems: 'center',
  },
  seiImage: {
    width: 224,
    height: 224,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
  },
  seiDescription: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionsContainer: {
    width: '100%',
    maxWidth: 600,
    marginTop: 8,
  },
  buttonWrapper: {
    marginVertical: 8,
  },
});

import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface PipelineLoadingScreenProps {
  logs: string[];
  webViewRef?: React.RefObject<WebView | null>;
  htmlContent?: string;
  onWebViewMessage?: (event: any) => void;
  downloadStatus?: {
    fileName: string;
    status: 'started' | 'downloading' | 'complete';
    percent?: number;
    loaded: number;
    total: number;
    receivedBytes?: number;
    totalBytes?: number;
  } | null;
}

export function PipelineLoadingScreen({ logs, webViewRef, htmlContent, onWebViewMessage, downloadStatus }: PipelineLoadingScreenProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logs.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [logs]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Loading Spinner */}
        <ActivityIndicator size="large" color="#007AFF" style={styles.spinner} />
        
        {/* Title */}
        <Text style={styles.title}>Processing Video</Text>
        <Text style={styles.subtitle}>Please wait while we analyze your video...</Text>
        
        {/* Download Progress Indicator */}
        {downloadStatus && downloadStatus.status !== 'complete' && (
          <View style={styles.downloadContainer}>
            <Text style={styles.downloadTitle}>Loading MediaPipe Models</Text>
            <Text style={styles.downloadFileName}>
              {downloadStatus.fileName}
            </Text>
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${downloadStatus.percent || 0}%` }
                ]} 
              />
            </View>
            <View style={styles.downloadStats}>
              <Text style={styles.downloadStatsText}>
                {downloadStatus.percent ? `${downloadStatus.percent.toFixed(1)}%` : 'Starting...'}
              </Text>
              <Text style={styles.downloadStatsText}>
                File {downloadStatus.loaded + 1} of {downloadStatus.total}
              </Text>
            </View>
            {downloadStatus.receivedBytes && downloadStatus.totalBytes && (
              <Text style={styles.downloadBytes}>
                {(downloadStatus.receivedBytes / 1024 / 1024).toFixed(2)} MB / {(downloadStatus.totalBytes / 1024 / 1024).toFixed(2)} MB
              </Text>
            )}
          </View>
        )}
        
        {/* Hidden WebView for processing */}
        {htmlContent && webViewRef && (
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
        
        {/* Logs Container */}
        <View style={styles.logsContainer}>
          <ScrollView 
            ref={scrollViewRef}
            style={styles.logsScrollView}
            contentContainerStyle={styles.logsContent}
            showsVerticalScrollIndicator={true}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {logs.length === 0 ? (
              <Text style={styles.logText}>Initializing...</Text>
            ) : (
              logs.map((log, index) => (
                <Text key={index} style={styles.logText}>
                  {log}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
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
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  logsContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  logsScrollView: {
    flex: 1,
  },
  logsContent: {
    padding: 16,
  },
  logText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  downloadContainer: {
    width: '100%',
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  downloadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  downloadFileName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  downloadStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  downloadStatsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  downloadBytes: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});

import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface PipelineLoadingScreenProps {
  logs: string[];
  webViewRef?: React.RefObject<WebView | null>;
  htmlContent?: string;
  onWebViewMessage?: (event: any) => void;
}

export function PipelineLoadingScreen({ logs, webViewRef, htmlContent, onWebViewMessage }: PipelineLoadingScreenProps) {
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
        
        {/* WebView Preview (Debug) */}
        {htmlContent && webViewRef && (
          <View style={styles.webViewContainer}>
            <Text style={styles.webViewLabel}>Pose Detection Preview:</Text>
            <WebView
              ref={webViewRef}
              source={{ html: htmlContent }}
              style={styles.webView}
              onMessage={onWebViewMessage}
              javaScriptEnabled={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              originWhitelist={['*']}
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
            />
          </View>
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
  webViewContainer: {
    width: '100%',
    marginBottom: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  webViewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  webView: {
    width: '100%',
    height: 300,
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
});

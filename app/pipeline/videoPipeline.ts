import * as FileSystem from 'expo-file-system/legacy';
import { WebViewMessageEvent } from 'react-native-webview';

export async function extractKeypoints(videoUri: string, webViewReady: boolean, webViewRef: any, setRunning: (v: boolean) => void, setResult: any, setProgress: any, setError: any, fileName: string) {
  console.log('[Pipeline] Step: Extract Keypoints - started');
  setError(null);
  if (!videoUri) {
    setError('No video selected');
    console.log('[Pipeline] Step: Extract Keypoints - no video selected');
    return;
  }
  if (!webViewReady) {
    setError('Pose engine is still initializing. Please wait a moment and try again.');
    console.log('[Pipeline] Step: Extract Keypoints - pose engine not ready');
    return;
  }
  try {
    setRunning(true);
    setResult(null);
    setProgress(null);
    console.log('[Pipeline] Step: Extract Keypoints - reading video as base64');
    const base64 = await FileSystem.readAsStringAsync(videoUri, { encoding: 'base64' });
    console.log('[Pipeline] Step: Extract Keypoints - sending to WebView');
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'process_video',
      video: `data:video/mp4;base64,${base64}`,
      options: {
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.4,
        fps: 30
      }
    }));
    console.log('[Pipeline] Step: Extract Keypoints - sent to WebView');
  } catch (err: any) {
    setError(err.message);
    setRunning(false);
    console.log('[Pipeline] Step: Extract Keypoints - error:', err.message);
  }
}

export function handleWebViewMessage(event: WebViewMessageEvent, fileName: string, setResult: any, setProgress: any, setError: any, setRunning: any) {
  try {
    const message = JSON.parse(event.nativeEvent.data);
    switch (message.type) {
      case 'status':
        if (String(message.message).toLowerCase().includes('initialized')) {
          // handled in index.tsx
        }
        break;
      case 'progress':
        setProgress({ frameIndex: message.frameIndex, percent: message.percent });
        break;
      case 'complete':
        // handled in index.tsx
        break;
      case 'error':
        throw new Error(message.message);
    }
  } catch (err: any) {
    setError(err.message);
    setRunning(false);
  }
}

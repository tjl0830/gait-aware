/**
 * MediaPipe Configuration
 * 
 * Toggle between online (CDN) and offline (downloaded assets) modes
 */

export type MediaPipeMode = 'online' | 'offline';

export const MEDIAPIPE_CONFIG = {
  // Set to 'offline' to use downloaded assets (no internet required after first launch)
  // Set to 'online' to use CDN (requires internet)
  mode: 'offline' as MediaPipeMode,
  
  // HTML file (we'll inject the base path at runtime)
  htmlFile: require('./mediapipe_pose.html'),
};

/**
 * Get the MediaPipe HTML module
 */
export function getMediaPipeHtml(): number {
  return MEDIAPIPE_CONFIG.htmlFile;
}

/**
 * Check if offline mode is enabled
 */
export function isOfflineMode(): boolean {
  return MEDIAPIPE_CONFIG.mode === 'offline';
}

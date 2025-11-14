/**
 * Video Validation Utilities
 * Validates video files before processing for gait analysis
 */

export interface VideoValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Supported video formats
 */
const SUPPORTED_FORMATS = ['mp4', 'mov', 'avi'];

/**
 * Video constraints for gait analysis
 */
const VIDEO_CONSTRAINTS = {
  MIN_DURATION: 2, // seconds
  MAX_DURATION: 15, // seconds
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  RECOMMENDED_MIN_DURATION: 3, // seconds
  RECOMMENDED_MAX_DURATION: 10, // seconds
};

/**
 * Validate video file before processing
 * Checks format, size, and provides recommendations
 */
export async function validateVideo(
  uri: string,
  fileName: string
): Promise<VideoValidationResult> {
  const warnings: string[] = [];

  // Check file extension
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension || !SUPPORTED_FORMATS.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported video format. Please use: ${SUPPORTED_FORMATS.join(', ').toUpperCase()}`,
    };
  }

  // Note: We can't reliably check duration or file size from URI in React Native
  // without additional libraries. These checks would need to be done after loading.
  // For now, we provide format validation and will validate duration after loading.

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate video duration after it's loaded
 */
export function validateVideoDuration(
  durationSeconds: number
): VideoValidationResult {
  if (durationSeconds < VIDEO_CONSTRAINTS.MIN_DURATION) {
    return {
      valid: false,
      error: `Video too short. Minimum ${VIDEO_CONSTRAINTS.MIN_DURATION} seconds required for accurate gait analysis.`,
    };
  }

  if (durationSeconds > VIDEO_CONSTRAINTS.MAX_DURATION) {
    return {
      valid: false,
      error: `Video too long. Maximum ${VIDEO_CONSTRAINTS.MAX_DURATION} seconds. Please trim your video.`,
    };
  }

  const warnings: string[] = [];

  if (durationSeconds < VIDEO_CONSTRAINTS.RECOMMENDED_MIN_DURATION) {
    warnings.push(
      `Video is shorter than recommended ${VIDEO_CONSTRAINTS.RECOMMENDED_MIN_DURATION} seconds. Results may be less accurate.`
    );
  }

  if (durationSeconds > VIDEO_CONSTRAINTS.RECOMMENDED_MAX_DURATION) {
    warnings.push(
      `Video is longer than recommended ${VIDEO_CONSTRAINTS.RECOMMENDED_MAX_DURATION} seconds. Consider using a shorter clip.`
    );
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Get video requirements as user-friendly text
 */
export function getVideoRequirements(): string {
  return `
Video Requirements:
• Format: ${SUPPORTED_FORMATS.map(f => f.toUpperCase()).join(', ')}
• Duration: ${VIDEO_CONSTRAINTS.MIN_DURATION}-${VIDEO_CONSTRAINTS.MAX_DURATION} seconds
• Recommended: ${VIDEO_CONSTRAINTS.RECOMMENDED_MIN_DURATION}-${VIDEO_CONSTRAINTS.RECOMMENDED_MAX_DURATION} seconds
• Content: Person walking naturally in view
• Camera: Stable, side or front view
  `.trim();
}

/**
 * Common video error messages
 */
export const VIDEO_ERRORS = {
  NO_PERSON: 'No person detected in video. Please ensure the person is clearly visible.',
  POOR_QUALITY: 'Video quality too low. Please use a clearer video.',
  NOT_WALKING: 'Unable to detect walking motion. Please ensure the person is walking naturally.',
  INSUFFICIENT_FRAMES: 'Not enough valid frames for analysis. Video may be too short or person not visible throughout.',
  MULTIPLE_PEOPLE: 'Multiple people detected. Please use a video with one person only.',
  OBSTRUCTED_VIEW: 'Person is partially obstructed. Please ensure full body is visible.',
};

# React Native MediaPipe Integration - Progress Report

## ✅ What We've Accomplished

### 1. Installed Dependencies
```bash
npm install react-native-mediapipe react-native-vision-camera react-native-worklets-core @shopify/react-native-skia
```

**Packages Added:**
- `react-native-mediapipe` - MediaPipe pose detection for React Native
- `react-native-vision-camera` - Camera access (required by mediapipe)
- `react-native-worklets-core` - JS worklets for frame processing
- `@shopify/react-native-skia` - Canvas rendering for visualizations

### 2. Ran Expo Prebuild
```bash
npx expo prebuild --clean
```

**Result:** Created native `android/` and `ios/` folders
- This was necessary because react-native-mediapipe requires native modules
- We're now using **Expo bare workflow** (not managed workflow)

### 3. Updated Code Structure

**Created Files:**
- `utils/mediapipePoseExtractor.ts` - Wrapper for MediaPipe pose detection
  - Currently has placeholder implementation
  - Documented TODO steps for real MediaPipe integration
  - Returns mock 33-landmark data for testing pipeline

- `react-native.config.js` - React Native configuration
  - Bundles MediaPipe model files from `assets/mediapipe_models/`

**Updated Files:**
- `app/(tabs)/index.tsx` - Complete rewrite
  - Removed all WebView code
  - Now uses `extractPoseFromVideo()` from MediaPipe extractor
  - Clean flow: Upload → Extract Pose → Validate → Analyze → Results
  - Progress tracking with frame count and percentage

### 4. Created Asset Directory
- `assets/mediapipe_models/` - Ready for MediaPipe pose model file

## 📋 Next Steps (TODO)

### Step 1: Download MediaPipe Pose Model
**Model Required:** `pose_landmarker.task` or `pose_landmarker_heavy.task`

**Download from:**
```
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
```

**Action:**
```bash
# Download model (choose one)
curl -o assets/mediapipe_models/pose_landmarker.task https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
```

**Place in:** `assets/mediapipe_models/pose_landmarker.task`

### Step 2: Implement Real MediaPipe Integration

**File to update:** `utils/mediapipePoseExtractor.ts`

**Current Status:** Placeholder with mock data

**Implementation needed:**
```typescript
import { PoseDetection, RunningMode, Delegate } from 'react-native-mediapipe';

// 1. Create detector
const detector = await PoseDetection.createDetector(
  1, // numPoses
  0.5, // minPoseDetectionConfidence  
  0.5, // minPosePresenceConfidence
  0.5, // minTrackingConfidence
  false, // shouldOutputSegmentationMasks
  'pose_landmarker.task', // model file
  Delegate.GPU,
  RunningMode.VIDEO
);

// 2. Process video frames
// The library handles frame extraction internally
const results = await detector.detectOnVideo(videoUri);

// 3. Extract landmarks
const frames = results.map((result, index) => ({
  frame_index: index,
  landmarks: result.landmarks[0] // 33 landmarks per frame
}));
```

**Reference:** See `react-native-mediapipe` examples in node_modules

### Step 3: Build & Test

**Build for Android:**
```bash
npx expo run:android
```

**Build for iOS:**
```bash
npx expo run:ios
```

**Or create development build with EAS:**
```bash
eas build --profile development --platform android
```

### Step 4: Verify Full Pipeline

**Test Flow:**
1. Upload a gait video (10-30 seconds)
2. Watch progress: "Extracting keypoints: frame X (Y%)"
3. Validate: Should extract 33 landmarks per frame
4. Analyze: BiLSTM processes 16 features (8 landmarks × 2 coords)
5. Results: MSE-based classification with 0.174969 threshold

**Expected Console Logs:**
```
[MediaPipe] Starting pose extraction from: file:///.../video.mp4
[MediaPipe] Video file size: 4.25 MB
Processing frame 30/90 (33%)
Processing frame 60/90 (67%)
Processing frame 90/90 (100%)
[MediaPipe] Extraction complete: 90 frames processed
Extracted 90 frames with pose data
Running BiLSTM gait analysis...
Gait analysis complete: { isAbnormal: false, confidence: 0.92, ... }
```

## 🔍 Current Architecture

```
User uploads video
      ↓
extractPoseFromVideo() [mediapipePoseExtractor.ts]
      ↓
react-native-mediapipe (Native Module)
      ↓
Extract 33 landmarks per frame
      ↓
Save as PoseJsonData
      ↓
validatePoseDataQuality() [landmarkExtractor.ts]
      ↓
analyzeGait() [gaitAnalysis.ts]
      ↓
- extract16Features (8 landmarks × 2 coords)
- normalizeWithStats (per-video normalization)
- createSlidingWindows (60 frames, 50% overlap)
- loadModel (BiLSTM TFLite)
- runInference (get MSE per window)
- classifyFromErrors (compare to 0.174969 threshold)
      ↓
Display Results (Normal/Abnormal + confidence + details)
```

## 📦 Dependencies Status

**Installed:**
✅ react-native-mediapipe (native pose detection)
✅ react-native-vision-camera (camera access)
✅ react-native-worklets-core (frame processing)
✅ @shopify/react-native-skia (canvas rendering)
✅ @tensorflow/tfjs (BiLSTM inference)
✅ @tensorflow/tfjs-core (TensorFlow core)
✅ expo-image-picker (video selection)
✅ expo-file-system (file operations)

**Required Native Setup:**
✅ Android/iOS folders created (expo prebuild)
⏳ MediaPipe model file (needs download)
⏳ Real MediaPipe integration (needs implementation)

## ⚠️ Important Notes

### 1. This is No Longer Expo Managed Workflow
After running `expo prebuild`, we're in **bare workflow**. This means:
- Cannot use `expo start` for development
- Must build native app with `npx expo run:android` or `npx expo run:ios`
- Or use EAS Build: `eas build --profile development`
- Native modules work (react-native-mediapipe ✅)

### 2. MediaPipe Model Size
- **Lite:** ~3 MB (faster, less accurate)
- **Full:** ~6 MB (balanced)
- **Heavy:** ~12 MB (slower, more accurate)

**Recommendation:** Start with **Full** model for balance

### 3. Offline Capability
✅ react-native-mediapipe works **completely offline**
- Model bundled in app
- No CDN dependencies
- No internet required after installation

### 4. Performance Expectations
- **Frame extraction:** ~1-2 seconds per second of video
- **BiLSTM inference:** <1 second (after extraction)
- **Total:** A 10-second video should process in ~10-12 seconds

## 🐛 Troubleshooting

### If build fails:
```bash
# Android
cd android
./gradlew clean
cd ..
npx expo run:android

# iOS
cd ios
pod install
cd ..
npx expo run:ios
```

### If MediaPipe not found:
- Check model file exists: `assets/mediapipe_models/pose_landmarker.task`
- Check react-native.config.js bundles assets
- Rebuild app after adding model file

### If pose detection fails:
- Check console logs for [MediaPipe] messages
- Verify video file is accessible (file URI valid)
- Try with shorter video first (10 seconds)
- Check device has sufficient memory

## 📱 Testing Strategy

1. **Test placeholder first** (current state)
   - Upload video
   - See mock extraction progress
   - Verify BiLSTM analysis runs with mock data
   - Confirms UI and pipeline work

2. **Add MediaPipe model**
   - Download and place model file
   - Rebuild app
   - Verify model loads

3. **Implement real extraction**
   - Update mediapipePoseExtractor.ts
   - Test with simple video
   - Verify 33 landmarks extracted

4. **End-to-end testing**
   - Test with normal gait videos
   - Test with abnormal gait videos
   - Verify MSE values reasonable
   - Verify classification accuracy

## 🎉 Success Criteria

When everything works, you should see:
1. ✅ Video uploads successfully
2. ✅ Progress updates smoothly (frame-by-frame)
3. ✅ 33 landmarks extracted per frame
4. ✅ BiLSTM analyzes 16 features
5. ✅ MSE calculated and compared to threshold (0.174969)
6. ✅ Results display: Normal/Abnormal + confidence + details
7. ✅ **All works completely offline!**

---

**Next Action:** Download MediaPipe model file and place in assets/mediapipe_models/

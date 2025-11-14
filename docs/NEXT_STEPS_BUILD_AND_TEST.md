# Next Steps: Build and Test

## ✅ What We've Accomplished

### MediaPipe Integration Complete
- ✅ Installed `react-native-mediapipe` v3.0.0 and dependencies
- ✅ Downloaded MediaPipe model (`pose_landmarker.task`, 9.4 MB)
- ✅ Installed `expo-video-thumbnails` v4.0.3 for frame extraction
- ✅ Ran `npx expo prebuild --clean` (moved to bare workflow)
- ✅ Implemented real pose extraction in `mediapipePoseExtractor.ts`
- ✅ Committed and pushed all changes to `feat/bilstm-integration`

### Implementation Details

**File: `utils/mediapipePoseExtractor.ts`**
```typescript
// Strategy: Extract frames → Run MediaPipe on each → Collect landmarks
1. VideoThumbnails.getThumbnailAsync() at 10 FPS (100ms intervals)
2. PoseDetection.detectOnImage() on each frame
3. Extract 33 landmarks from result.results[0].landmarks[0]
4. Handle: no pose detected, end of video
5. Progress tracking with callbacks
6. Automatic thumbnail cleanup
7. Fallback to mock data if native module unavailable
```

**Key Features:**
- ✅ Extracts at 10 FPS for efficiency (adjustable)
- ✅ Returns 33 MediaPipe landmarks per frame
- ✅ Error handling and graceful degradation
- ✅ Progress callbacks for UI updates
- ✅ Max 30 seconds / 300 frames limit

---

## 🔨 Next Step: Build the App

You now need to build the app with native modules. Choose one option:

### Option 1: Local Build (Faster for Testing)

**Android:**
```bash
npx expo run:android
```

**iOS (Mac required):**
```bash
npx expo run:ios
```

**Requirements:**
- Android: Android Studio with SDK 33+
- iOS: Xcode 14+, Mac computer

### Option 2: EAS Build (Cloud Build)

**Development Build (Recommended for Testing):**
```bash
# First time: Configure EAS
npx eas build:configure

# Build development version
npx eas build --profile development --platform android
```

**After build completes:**
1. Download and install APK on device
2. Run: `npx expo start --dev-client`
3. Scan QR code with app

---

## 🧪 Testing Plan

### 1. **Verify MediaPipe Extraction**

**Test Video:** Use a 10-15 second video showing someone walking

**Expected Console Logs:**
```
[MediaPipe] Starting pose extraction from: file:///...
[MediaPipe] Video file size: X.XX MB
[MediaPipe] Extracting and processing frames...
[MediaPipe] Frame 0: 33 landmarks detected
[MediaPipe] Frame 10: 33 landmarks detected
...
[MediaPipe] Extraction complete: 100 frames with pose data
```

**Red Flags:**
- ❌ "Native module not available" → Check build completed
- ❌ "No frames could be extracted" → Check video format (use MP4)
- ❌ "No pose detected" repeatedly → Check video shows full body

### 2. **Verify BiLSTM Analysis**

**Expected Flow:**
```
✅ Extract pose data (90-300 frames)
✅ Validate: 33 landmarks per frame
✅ Extract 16 features from 8 landmarks
✅ Normalize features per-video
✅ Create 60-frame windows
✅ Run BiLSTM inference
✅ Calculate MSE
✅ Classify: Normal (MSE < 0.174969) or Abnormal
```

**Expected Results:**
- MSE value: reasonable number (0.1 - 0.5 range typical)
- Classification: "Normal" or "Abnormal"
- Confidence: percentage based on distance from threshold

### 3. **Test Cases**

| Test | Video Type | Expected Result |
|------|-----------|-----------------|
| 1 | Normal gait (10s) | MSE < 0.175, "Normal" |
| 2 | Abnormal gait (10s) | MSE > 0.175, "Abnormal" |
| 3 | Short video (5s) | Warning: need 60 frames |
| 4 | Long video (30s+) | Truncated to 300 frames |
| 5 | No person visible | "No pose detected" errors |

---

## 🐛 Troubleshooting

### Issue: Native Module Not Found

**Symptoms:**
```
[MediaPipe] Native module not available - using mock data
```

**Solutions:**
1. Verify prebuild created `android/` and `ios/` folders ✅
2. Rebuild app: `npx expo run:android` (not `expo start`)
3. Check `react-native.config.js` exists
4. Clean build: `cd android && ./gradlew clean && cd ..`

### Issue: Model File Not Found

**Symptoms:**
```
Error: pose_landmarker.task not found
```

**Solutions:**
1. Verify file exists: `ls assets/mediapipe_models/pose_landmarker.task`
2. Check file size: Should be 9,398,198 bytes (9.4 MB)
3. Rebuild app (model must be bundled during build)

### Issue: Frame Extraction Fails

**Symptoms:**
```
Error: Failed to extract any frames from video
```

**Solutions:**
1. Use MP4 format (H.264 codec)
2. Try shorter video first (10 seconds)
3. Check video file isn't corrupted
4. Test with different video

### Issue: GPU Delegate Fails

**Symptoms:**
```
Error: GPU delegate initialization failed
```

**Solutions:**
1. Update `mediapipePoseExtractor.ts`:
```typescript
// Change from DELEGATE_GPU to DELEGATE_CPU
const result = await poseModule.detectOnImage(
  thumbnailUri,
  1,
  0.5, 0.5, 0.5,
  false,
  MODEL_FILE,
  DELEGATE_CPU  // Changed from DELEGATE_GPU
);
```

---

## 📊 Expected Performance

**Frame Extraction:**
- 10 FPS = 10 frames per second of video
- 10 second video = ~100 frames
- Processing time: ~20-30 seconds on device

**BiLSTM Inference:**
- Each 60-frame window: ~100ms
- Multiple windows: ~1-2 seconds total

**Total Time:**
- Upload video: instant
- Extract poses: 20-30 seconds
- Analyze gait: 1-2 seconds
- **Total: ~30 seconds for 10s video**

---

## 🎯 Success Criteria

Before deploying, verify:
- ✅ App builds successfully without errors
- ✅ MediaPipe extracts 33 landmarks per frame
- ✅ Console shows landmark detection messages
- ✅ BiLSTM analysis completes without errors
- ✅ Results display MSE and classification
- ✅ Normal gait videos → "Normal" result
- ✅ Abnormal gait videos → "Abnormal" result
- ✅ No internet required (fully offline)

---

## 📁 Project Status

**Branch:** `feat/bilstm-integration`  
**Commits:**
1. `cb18a32` - BiLSTM model integration
2. `8fbfba6` - react-native-mediapipe setup
3. `144da14` - Real MediaPipe extraction implementation

**Files Modified:**
- `utils/mediapipePoseExtractor.ts` - Real extraction ✅
- `app/(tabs)/index.tsx` - Clean UI flow ✅
- `utils/gaitAnalysis.ts` - BiLSTM pipeline ✅
- `utils/normalization.ts` - Feature normalization ✅
- `utils/modelInference.ts` - TFLite inference ✅

**Dependencies Added:**
- `react-native-mediapipe` v3.0.0
- `react-native-vision-camera` v4.9.2
- `react-native-worklets-core` v2.1.0
- `@shopify/react-native-skia` v1.8.2
- `expo-video-thumbnails` v4.0.3

**Native Setup:**
- ✅ `android/` and `ios/` folders created
- ✅ MediaPipe model downloaded (9.4 MB)
- ✅ `react-native.config.js` for bundling

---

## 🚀 Deployment Checklist

Once testing is successful:

1. **Merge to Main:**
```bash
git checkout main
git merge feat/bilstm-integration
git push
```

2. **Production Build:**
```bash
npx eas build --profile production --platform android
```

3. **Update Version:**
- Update `app.json` version numbers
- Update `package.json` version

4. **Create Release:**
- Tag release in GitHub
- Upload APK to releases
- Document changes in release notes

---

## 🆘 Need Help?

**Common Issues:**
- Build fails → Check Android Studio / Xcode setup
- Native module errors → Rebuild app from scratch
- Model not found → Verify bundling in build
- Poor accuracy → Check video quality and lighting

**Resources:**
- [react-native-mediapipe docs](https://github.com/cdiddy77/react-native-mediapipe)
- [Expo bare workflow docs](https://docs.expo.dev/bare/overview/)
- [MediaPipe Pose](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker)

---

**Status:** ✅ Implementation Complete - Ready to Build and Test!

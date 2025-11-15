# Landmark Extraction Strategy: 33 vs 16 Features

## ❓ Your Question

Should we extract all 33 MediaPipe landmarks or just the 16 features we need?

## ✅ Answer: Extract 33, Use 16 (Current Implementation is Optimal)

---

## 🎯 Current Implementation Flow

```
Video Upload
    ↓
MediaPipe Extraction (mediapipePoseExtractor.ts)
    ↓ Extracts ALL 33 landmarks per frame
    ↓ Why? MediaPipe returns all 33 at once - no performance gain from filtering
    ↓
Save Complete Pose Data
    ↓
Gait Analysis (gaitAnalysis.ts)
    ↓ extract16Features() selects 8 landmarks:
    ↓   • Left/Right Hip (indices 23, 24)
    ↓   • Left/Right Knee (indices 25, 26)
    ↓   • Left/Right Ankle (indices 27, 28)
    ↓   • Left/Right Foot Index (indices 31, 32)
    ↓
16 Features (8 landmarks × 2 coords)
    ↓
Normalize → Window → BiLSTM → MSE → Result
```

---

## 📊 Performance Analysis

### **What DOESN'T Affect Performance:**

- ❌ Extracting 33 vs 16 landmarks (MediaPipe returns all 33 at once)
- ❌ Storing 33 vs 16 landmarks (minimal memory difference)
- ❌ Saving to disk (negligible difference: ~2KB vs ~1KB per frame)

### **What DOES Affect Performance:**

- ✅ **Frame extraction rate** (10 FPS = 100ms intervals)
- ✅ **Number of frames** (300 max = 30 seconds)
- ✅ **Thumbnail quality** (0.8 = balance speed/accuracy)
- ✅ **GPU vs CPU delegate** (GPU is faster)

---

## 🔍 Why Keep All 33 Landmarks?

### 1. **No Performance Cost**

MediaPipe's pose detection model outputs all 33 landmarks in a single inference. Trying to "skip" some landmarks won't make it faster.

### 2. **Better Debugging**

```javascript
// Can visualize full skeleton to verify pose quality
console.log("Nose detected:", landmarks[0]);
console.log("Shoulders detected:", landmarks[11], landmarks[12]);
console.log("Hips detected:", landmarks[23], landmarks[24]); // ← Used in BiLSTM
```

### 3. **Future Flexibility**

What if you later want to:

- Add arm swing features (shoulders, elbows, wrists: indices 11-16)
- Include torso stability (shoulders, hips: indices 11, 12, 23, 24)
- Track head movement (nose, eyes, ears: indices 0-8)

With all 33 stored, you can experiment without re-processing videos.

### 4. **Validation & Quality Checks**

```javascript
// Check if person facing camera (visibility of face landmarks)
const faceVisible = landmarks[0].visibility > 0.5; // Nose

// Check if full body visible
const feetVisible =
  landmarks[31].visibility > 0.5 && landmarks[32].visibility > 0.5;

if (!feetVisible) {
  alert("Please capture full body including feet");
}
```

---

## 💾 Storage Impact

**33 Landmarks vs 16 Features:**

```
Per Frame:
- 33 landmarks × 4 values (x,y,z,visibility) × 4 bytes = 528 bytes
- 16 features × 4 bytes = 64 bytes
- Difference: 464 bytes per frame

For 100 frames (10 second video):
- 33 landmarks: 52.8 KB
- 16 features: 6.4 KB
- Difference: 46.4 KB (negligible on modern devices)
```

**Conclusion:** Storage difference is insignificant (~50KB per video).

---

## 🎯 Recommendation

### **Keep Current Implementation: Extract 33 → Use 16**

**Code in `utils/gaitAnalysis.ts` is already perfect:**

```typescript
function extract16Features(poseData: PoseJsonData): number[][] {
  // Takes full pose data with 33 landmarks
  // Extracts only the 8 landmarks we need
  // Returns 16 features (8 × 2 coords)

  const LEFT_HIP = 23; // ← From 33 landmarks
  const RIGHT_HIP = 24;
  const LEFT_KNEE = 25;
  const RIGHT_KNEE = 26;
  const LEFT_ANKLE = 27;
  const RIGHT_ANKLE = 28;
  const LEFT_FOOT_INDEX = 31;
  const RIGHT_FOOT_INDEX = 32;

  // ... extracts just these 8 landmarks
}
```

---

## ⚡ If You Want to Optimize Performance

Instead of changing landmark extraction, optimize these:

### 1. **Reduce Frame Rate** (if processing too slow)

```typescript
// In mediapipePoseExtractor.ts
const TARGET_FPS = 5; // Changed from 10 (extract every 200ms)
```

### 2. **Reduce Max Frames** (if videos are long)

```typescript
const MAX_FRAMES = 150; // Changed from 300 (max 30s → 15s)
```

### 3. **Lower Thumbnail Quality** (if device is slow)

```typescript
const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
  time: timeMs,
  quality: 0.5, // Changed from 0.8 (faster extraction)
});
```

### 4. **Use CPU Delegate** (if GPU has issues)

```typescript
const result = await poseModule.detectOnImage(
  thumbnailUri,
  1,
  0.5,
  0.5,
  0.5,
  false,
  MODEL_FILE,
  DELEGATE_CPU // Changed from DELEGATE_GPU (more compatible)
);
```

---

## 📋 Summary

| Aspect              | Extract 33          | Extract 16 Only    |
| ------------------- | ------------------- | ------------------ |
| **Performance**     | Same                | Same               |
| **Accuracy**        | Same                | Same               |
| **Storage**         | +50KB per video     | Baseline           |
| **Flexibility**     | ✅ Can add features | ❌ Need re-process |
| **Debugging**       | ✅ Full skeleton    | ❌ Limited info    |
| **Code Complexity** | ✅ Simple           | Slightly complex   |

**Verdict:** ✅ **Keep extracting all 33 landmarks** - it's the right approach!

---

## 🚀 Ready to Build?

Your current implementation is optimal. Proceed with:

```bash
npx eas build --profile development --platform android
```

No changes needed! 🎉

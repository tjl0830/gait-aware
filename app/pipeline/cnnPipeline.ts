import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO, decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Class labels in alphabetical order (from your dataset folders)
const CLASS_LABELS = [
  'DIPLEGIC',
  'HEMIPLEGIC',
  'NEUROPATHIC',
  'NORMAL',
  'PARKINSON'
];

let model: tf.LayersModel | null = null;
let isModelLoaded = false;

/**
 * Initialize TensorFlow.js and load the CNN model
 */
export async function initializeCNNModel(): Promise<void> {
  console.log('[CNN] Initializing TensorFlow.js...');
  
  try {
    // Initialize TensorFlow.js for React Native
    await tf.ready();
    console.log('[CNN] TensorFlow.js backend:', tf.getBackend());
    
    // Load the model using bundleResourceIO
    console.log('[CNN] Loading model from assets...');
    
    // bundleResourceIO expects model.json and an array of weight file modules
    const modelJson = require('../../assets/models/cnn/model.json');
    const modelWeights = [
      require('../../assets/models/cnn/group1-shard1of1.bin'),
    ];
    
    model = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
    
    isModelLoaded = true;
    console.log('[CNN] ✅ Model loaded successfully');
    console.log('[CNN] Input shape:', model.inputs[0].shape);
    console.log('[CNN] Output shape:', model.outputs[0].shape);
    
    // Warm up the model with a dummy prediction
    console.log('[CNN] Warming up model...');
    const dummyInput = tf.zeros([1, 224, 224, 3]);
    const warmupPred = model.predict(dummyInput) as tf.Tensor;
    await warmupPred.data();
    dummyInput.dispose();
    warmupPred.dispose();
    console.log('[CNN] ✅ Model warmed up');
    
  } catch (error: any) {
    console.error('[CNN] ❌ Failed to load model:', error);
    throw new Error(`Failed to load CNN model: ${error.message}`);
  }
}

/**
 * Preprocess SEI image for CNN model
 * Converts image to tensor and normalizes to [0, 1]
 */
async function preprocessImage(imageUri: string): Promise<tf.Tensor3D> {
  console.log('[CNN] Preprocessing image:', imageUri);
  
  // Read image as base64
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: 'base64',
  });
  
  // Convert base64 to array buffer
  const imageDataArrayBuffer = tf.util.encodeString(base64, 'base64').buffer;
  const imageData = new Uint8Array(imageDataArrayBuffer);
  
  // Decode JPEG image to tensor
  const imageTensor = decodeJpeg(imageData, 3) as tf.Tensor3D;
  
  // Resize to 224x224
  const resized = tf.image.resizeBilinear(imageTensor, [224, 224]);
  
  // Normalize to [0, 1]
  const normalized = resized.div(255.0) as tf.Tensor3D;
  
  // Cleanup intermediate tensors
  imageTensor.dispose();
  resized.dispose();
  
  return normalized;
}

/**
 * Run CNN classification on SEI image
 * Returns predicted class and confidence scores
 */
export async function classifySEI(seiImageUri: string): Promise<{
  predictedClass: string;
  confidence: number;
  allScores: { label: string; score: number }[];
}> {
  if (!isModelLoaded || !model) {
    throw new Error('CNN model not loaded. Call initializeCNNModel() first.');
  }
  
  console.log('[CNN] Starting classification...');
  const startTime = Date.now();
  
  try {
    // Preprocess image
    const inputTensor = await preprocessImage(seiImageUri);
    
    // Add batch dimension [1, 224, 224, 3]
    const batchedInput = inputTensor.expandDims(0);
    
    // Run inference
    console.log('[CNN] Running inference...');
    const predictions = model.predict(batchedInput) as tf.Tensor;
    
    // Get probabilities (softmax output)
    const probabilities = await predictions.data();
    
    // Find predicted class (highest probability)
    const predictedIndex = probabilities.indexOf(Math.max(...Array.from(probabilities)));
    const predictedClass = CLASS_LABELS[predictedIndex];
    const confidence = probabilities[predictedIndex];
    
    // Create scores array for all classes
    const allScores = CLASS_LABELS.map((label, index) => ({
      label,
      score: probabilities[index],
    })).sort((a, b) => b.score - a.score); // Sort by score descending
    
    // Cleanup tensors
    inputTensor.dispose();
    batchedInput.dispose();
    predictions.dispose();
    
    const elapsed = Date.now() - startTime;
    console.log(`[CNN] ✅ Classification complete in ${elapsed}ms`);
    console.log(`[CNN] Predicted: ${predictedClass} (${(confidence * 100).toFixed(2)}%)`);
    
    return {
      predictedClass,
      confidence,
      allScores,
    };
    
  } catch (error: any) {
    console.error('[CNN] ❌ Classification failed:', error);
    throw new Error(`CNN classification failed: ${error.message}`);
  }
}

/**
 * Get model info and status
 */
export function getCNNModelInfo() {
  return {
    isLoaded: isModelLoaded,
    backend: tf.getBackend(),
    classLabels: CLASS_LABELS,
    modelShape: model ? {
      input: model.inputs[0].shape,
      output: model.outputs[0].shape,
    } : null,
  };
}

/**
 * TensorFlow Lite Model Inference for BiLSTM Gait Analysis
 * Loads and runs the BiLSTM autoencoder model trained in Python
 *
 * Model Specifications:
 * - Input: (1, 60, 16) - batch=1, sequence=60, features=16
 * - Output: (1, 60, 16) - reconstructed sequence
 * - Architecture: BiLSTM Autoencoder with latent_dim=32
 * - Uses SELECT_TF_OPS (TensorFlow Flex delegate)
 */

import * as tf from "@tensorflow/tfjs";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";

// Model specifications (must match training)
export const MODEL_SPECS = {
  sequence_length: 60,
  num_features: 16,
  latent_dim: 32,
  threshold: 0.174969, // From training (95th percentile)
};

// Global model instance
let modelInstance: tf.GraphModel | tf.LayersModel | null = null;
let isInitialized = false;

/**
 * Initialize TensorFlow.js backend
 * Must be called before any model operations
 */
export async function initializeTensorFlow(): Promise<void> {
  if (isInitialized) {
    console.log("TensorFlow.js already initialized");
    return;
  }

  try {
    console.log("Initializing TensorFlow.js...");
    await tf.ready();
    console.log(`TensorFlow.js ready. Backend: ${tf.getBackend()}`);
    isInitialized = true;
  } catch (error) {
    console.error("Failed to initialize TensorFlow.js:", error);
    throw new Error("TensorFlow.js initialization failed");
  }
}

/**
 * Load the TFLite model
 * Converts .tflite file to TensorFlow.js format
 *
 * @returns Loaded model instance
 */
export async function loadModel(): Promise<tf.GraphModel | tf.LayersModel> {
  if (modelInstance) {
    console.log("Model already loaded");
    return modelInstance;
  }

  try {
    console.log("Loading BiLSTM model...");

    // Ensure TensorFlow is initialized
    await initializeTensorFlow();

    // Load the .tflite file from assets
    const modelAsset = Asset.fromModule(
      require("../assets/models/bilstm/best_model_16landmarks.tflite")
    );
    await modelAsset.downloadAsync();

    if (!modelAsset.localUri) {
      throw new Error("Model asset not available");
    }

    // Read model file as base64
    const modelData = await FileSystem.readAsStringAsync(
      modelAsset.localUri,
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );

    // Convert base64 to ArrayBuffer
    const binaryString = atob(modelData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Load model from ArrayBuffer
    // Note: TFLite models with SELECT_TF_OPS need special handling
    // We'll try to load as GraphModel first
    try {
      modelInstance = await tf.loadGraphModel(
        tf.io.fromMemory(bytes.buffer as ArrayBuffer)
      );
      console.log("✅ Model loaded as GraphModel");
    } catch (graphError) {
      // If GraphModel fails, try LayersModel
      console.log("Trying LayersModel format...");
      modelInstance = await tf.loadLayersModel(
        tf.io.fromMemory(bytes.buffer as ArrayBuffer)
      );
      console.log("✅ Model loaded as LayersModel");
    }

    console.log(`Model size: ${(modelData.length / 1024).toFixed(2)} KB`);
    return modelInstance;
  } catch (error: any) {
    console.error("Failed to load model:", error);
    throw new Error(`Model loading failed: ${error.message}`);
  }
}

/**
 * Run inference on normalized windows
 *
 * @param windows - Normalized windows [num_windows, 60, 16]
 * @returns Array of MSE values (one per window)
 */
export async function runInference(
  windows: number[][][]
): Promise<number[]> {
  if (!modelInstance) {
    throw new Error("Model not loaded. Call loadModel() first.");
  }

  const errors: number[] = [];

  try {
    // Process each window separately (batch_size = 1)
    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];

      // Validate window shape
      if (
        window.length !== MODEL_SPECS.sequence_length ||
        window[0].length !== MODEL_SPECS.num_features
      ) {
        throw new Error(
          `Invalid window shape: expected [${MODEL_SPECS.sequence_length}, ${MODEL_SPECS.num_features}], got [${window.length}, ${window[0].length}]`
        );
      }

      // Convert to tensor: [1, 60, 16]
      const inputTensor = tf.tensor3d([window]);

      // Run inference
      const outputTensor = (await modelInstance.predict(
        inputTensor
      )) as tf.Tensor;

      // Calculate MSE: mean((input - output)^2)
      const diff = tf.sub(inputTensor, outputTensor);
      const squared = tf.square(diff);
      const mse = tf.mean(squared);

      // Get MSE value
      const mseValue = (await mse.data())[0];
      errors.push(mseValue);

      // Clean up tensors
      inputTensor.dispose();
      outputTensor.dispose();
      diff.dispose();
      squared.dispose();
      mse.dispose();
    }

    return errors;
  } catch (error: any) {
    console.error("Inference failed:", error);
    throw new Error(`Inference failed: ${error.message}`);
  }
}

/**
 * Calculate overall abnormality classification from window errors
 *
 * @param errors - Array of MSE values from all windows
 * @returns Abnormality result with classification
 */
export function classifyFromErrors(errors: number[]): {
  meanError: number;
  maxError: number;
  minError: number;
  isAbnormal: boolean;
  abnormalWindowCount: number;
  normalWindowCount: number;
  abnormalPercentage: number;
} {
  if (errors.length === 0) {
    throw new Error("No errors to classify");
  }

  const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
  const maxError = Math.max(...errors);
  const minError = Math.min(...errors);

  // Count windows above/below threshold
  const abnormalWindowCount = errors.filter(
    (e) => e >= MODEL_SPECS.threshold
  ).length;
  const normalWindowCount = errors.filter(
    (e) => e < MODEL_SPECS.threshold
  ).length;
  const abnormalPercentage = (abnormalWindowCount / errors.length) * 100;

  // Classify based on mean error (matches Python approach)
  const isAbnormal = meanError >= MODEL_SPECS.threshold;

  return {
    meanError,
    maxError,
    minError,
    isAbnormal,
    abnormalWindowCount,
    normalWindowCount,
    abnormalPercentage,
  };
}

/**
 * Dispose of model and free memory
 */
export function disposeModel(): void {
  if (modelInstance) {
    // TensorFlow.js models don't have a dispose method
    // but we can clear the reference
    modelInstance = null;
    console.log("Model disposed");
  }
}

/**
 * Get model memory usage info
 */
export function getMemoryInfo(): {
  numTensors: number;
  numBytes: number;
} {
  const memInfo = tf.memory();
  return {
    numTensors: memInfo.numTensors,
    numBytes: memInfo.numBytes,
  };
}

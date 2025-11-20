import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type VideoPickerProps = {
  onPress: () => void;
  isCompressing?: boolean;
};

export function VideoPicker({ onPress, isCompressing }: VideoPickerProps) {
  return (
    <TouchableOpacity 
      style={[styles.uploadButton, isCompressing && styles.uploadButtonDisabled]} 
      onPress={onPress}
      disabled={isCompressing}
    >
      {isCompressing ? (
        <View style={styles.compressingContainer}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.uploadButtonText}>Compressing...</Text>
        </View>
      ) : (
        <Text style={styles.uploadButtonText}>Choose Video</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  uploadButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: '#A0A0A0',
    opacity: 0.6,
  },
  compressingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
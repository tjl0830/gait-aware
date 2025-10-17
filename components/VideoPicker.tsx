import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

type VideoPickerProps = {
  onPress: () => void;
};

export function VideoPicker({ onPress }: VideoPickerProps) {
  return (
    <TouchableOpacity style={styles.uploadButton} onPress={onPress}>
      <Text style={styles.uploadButtonText}>Choose Video</Text>
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
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
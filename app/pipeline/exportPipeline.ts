import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';

export async function exportSei(seiSavedPath: string | null, fileName: string | null) {
  console.log('[Pipeline] Step: Export SEI - started');
  if (!seiSavedPath) {
    Alert.alert('No file', 'Generate the SEI first.');
    console.log('[Pipeline] Step: Export SEI - no SEI file');
    return;
  }
  const baseName = fileName?.split('.')[0] || 'video';
  if (Platform.OS === 'android') {
    const SAF = (FileSystem as any).StorageAccessFramework;
    if (!SAF?.requestDirectoryPermissionsAsync) {
      Alert.alert('Not supported', 'Storage Access Framework is not available.');
      console.log('[Pipeline] Step: Export SEI - SAF not available');
      return;
    }
    const perms = await SAF.requestDirectoryPermissionsAsync();
    if (!perms.granted) {
      Alert.alert('Permission denied', 'Export cancelled.');
      console.log('[Pipeline] Step: Export SEI - permission denied');
      return;
    }
    const filename = `${baseName}_sei.png`;
    const destUri = await SAF.createFileAsync(perms.directoryUri, filename, 'image/png');
    const content = await FileSystem.readAsStringAsync(seiSavedPath, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(destUri, content, { encoding: FileSystem.EncodingType.Base64 });
    Alert.alert('Exported', 'SEI PNG saved to the selected folder.');
    console.log('[Pipeline] Step: Export SEI - exported to SAF');
  } else {
    Alert.alert('Saved', `App file path:\n${seiSavedPath}`);
    console.log('[Pipeline] Step: Export SEI - saved to app path');
  }
  console.log('[Pipeline] Step: Export SEI - completed');
}

export async function exportJson(result: any, fileName: string | null) {
  console.log('[Pipeline] Step: Export JSON - started');
  if (!result?.outputFile) {
    Alert.alert('No file', 'Run analysis first to generate a JSON file.');
    console.log('[Pipeline] Step: Export JSON - no output file');
    return;
  }
  const baseName = fileName?.split('.')[0] || 'video';
  if (Platform.OS === 'android') {
    const SAF = (FileSystem as any).StorageAccessFramework;
    if (!SAF?.requestDirectoryPermissionsAsync) {
      Alert.alert('Not supported', 'Storage Access Framework is not available.');
      console.log('[Pipeline] Step: Export JSON - SAF not available');
      return;
    }
    const perms = await SAF.requestDirectoryPermissionsAsync();
    if (!perms.granted) {
      Alert.alert('Permission denied', 'Export cancelled.');
      console.log('[Pipeline] Step: Export JSON - permission denied');
      return;
    }
    const filename = `${baseName}_pose.json`;
    const destUri = await SAF.createFileAsync(perms.directoryUri, filename, 'application/json');
    const content = await FileSystem.readAsStringAsync(result.outputFile, { encoding: 'utf8' });
    await FileSystem.writeAsStringAsync(destUri, content, { encoding: 'utf8' });
    Alert.alert('Exported', 'JSON saved to the selected folder.');
    console.log('[Pipeline] Step: Export JSON - exported to SAF');
  } else {
    Alert.alert('Saved', `App file path:\n${result.outputFile}`);
    console.log('[Pipeline] Step: Export JSON - saved to app path');
  }
  console.log('[Pipeline] Step: Export JSON - completed');
}

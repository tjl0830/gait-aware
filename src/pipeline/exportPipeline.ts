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
    const filename = `${baseName}_sei.jpg`;
    const destUri = await SAF.createFileAsync(perms.directoryUri, filename, 'image/jpeg');
    const content = await FileSystem.readAsStringAsync(seiSavedPath, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(destUri, content, { encoding: FileSystem.EncodingType.Base64 });
    Alert.alert('Exported', 'SEI image saved to the selected folder.');
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

export async function exportAllResults(
  seiSavedPath: string | null, 
  result: any, 
  fileName: string | null
) {
  console.log('[Pipeline] Step: Export All Results - started');
  
  const baseName = fileName?.split('.')[0] || 'video';
  
  if (Platform.OS === 'android') {
    const SAF = (FileSystem as any).StorageAccessFramework;
    if (!SAF?.requestDirectoryPermissionsAsync) {
      Alert.alert('Not supported', 'Storage Access Framework is not available.');
      console.log('[Pipeline] Step: Export All Results - SAF not available');
      return;
    }
    
    // Request permission once
    const perms = await SAF.requestDirectoryPermissionsAsync();
    if (!perms.granted) {
      Alert.alert('Permission denied', 'Export cancelled.');
      console.log('[Pipeline] Step: Export All Results - permission denied');
      return;
    }
    
    let exportedFiles: string[] = [];
    
    // Export SEI if available
    if (seiSavedPath) {
      try {
        const seiFilename = `${baseName}_sei.jpg`; // Changed to .jpg
        const seiDestUri = await SAF.createFileAsync(perms.directoryUri, seiFilename, 'image/jpeg');
        const seiContent = await FileSystem.readAsStringAsync(seiSavedPath, { 
          encoding: FileSystem.EncodingType.Base64 
        });
        await FileSystem.writeAsStringAsync(seiDestUri, seiContent, { 
          encoding: FileSystem.EncodingType.Base64 
        });
        exportedFiles.push('SEI image');
        console.log('[Pipeline] Step: Export All Results - SEI exported');
      } catch (err: any) {
        console.error('[Pipeline] SEI export error:', err);
      }
    }
    
    // Export JSON if available
    if (result?.outputFile) {
      try {
        const jsonFilename = `${baseName}_pose.json`;
        const jsonDestUri = await SAF.createFileAsync(perms.directoryUri, jsonFilename, 'application/json');
        const jsonContent = await FileSystem.readAsStringAsync(result.outputFile, { encoding: 'utf8' });
        await FileSystem.writeAsStringAsync(jsonDestUri, jsonContent, { encoding: 'utf8' });
        exportedFiles.push('keypoints JSON');
        console.log('[Pipeline] Step: Export All Results - JSON exported');
      } catch (err: any) {
        console.error('[Pipeline] JSON export error:', err);
      }
    }
    
    if (exportedFiles.length > 0) {
      Alert.alert(
        'Export Successful', 
        `Exported ${exportedFiles.join(' and ')} to the selected folder.`
      );
    } else {
      Alert.alert('Export Failed', 'No files were exported.');
    }
    
  } else {
    // iOS - just show file paths
    const paths = [];
    if (seiSavedPath) paths.push(`SEI: ${seiSavedPath}`);
    if (result?.outputFile) paths.push(`JSON: ${result.outputFile}`);
    Alert.alert('Saved', paths.join('\n\n'));
    console.log('[Pipeline] Step: Export All Results - saved to app paths');
  }
  
  console.log('[Pipeline] Step: Export All Results - completed');
}

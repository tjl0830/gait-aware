import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Minimal helpful note: modules (loaded dynamically) that improve functionality:
// expo-file-system, expo-sharing, expo-media-library, @react-native-async-storage/async-storage, expo-image-picker
// npm packages: pdf-lib, base64-js
// If you use Expo Go and see missing native module errors, create a dev client or build with EAS.

const STORAGE_KEY = 'gaitaware:history';

type HistoryItem = {
  id: number;
  name: string;
  gaitType: string;
  jointDeviations?: string;
  images?: string[]; // URIs
  createdAt: string;
};

export default function Tab() {
  const [name, setName] = useState('');
  const [gaitType, setGaitType] = useState('');
  const [jointDeviations, setJointDeviations] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [previewDataUri, setPreviewDataUri] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const previewFilenameRef = useRef<string | null>(null);

  // cached dynamic modules
  const asyncStorageRef = useRef<any>(null);

  // ---------- helpers ----------
  const sanitizeFilename = (s: string) =>
    s
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\/\\?%*:|"<>]/g, '-')
      .replace(/,+/g, ',')
      .replace(/^,|,$/g, '')
      .substring(0, 120);

  async function ensureAsyncStorage() {
    if (asyncStorageRef.current) return asyncStorageRef.current;
    try {
      // @ts-ignore
      const mod = await import('@react-native-async-storage/async-storage');
      asyncStorageRef.current = mod.default ?? mod;
      return asyncStorageRef.current;
    } catch {
      asyncStorageRef.current = null;
      return null;
    }
  }

  async function loadFromStorage() {
    try {
      const storage = await ensureAsyncStorage();
      if (storage) {
        const raw = await storage.getItem(STORAGE_KEY);
        const list: HistoryItem[] = raw ? JSON.parse(raw) : [];
        setItems(list);
      } else {
        setItems([]);
      }
    } catch (e) {
      console.warn('loadFromStorage error', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveToStorage(list: HistoryItem[]) {
    try {
      const storage = await ensureAsyncStorage();
      if (storage) await storage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('saveToStorage error', e);
    }
  }

  useEffect(() => {
    loadFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // prefer legacy expo-file-system API (keeps writeAsStringAsync/readAsStringAsync) then fallback
  async function loadFileSystem() {
    try {
      // @ts-ignore
      const legacy = await import('expo-file-system/legacy').catch(() => null);
      if (legacy) return legacy.default ?? legacy;
    } catch {}
    try {
      // @ts-ignore
      const fs = await import('expo-file-system').catch(() => null);
      return fs ? fs.default ?? fs : null;
    } catch {
      return null;
    }
  }

  // convert Uint8Array -> base64 (tries base64-js then Buffer)
  async function bytesToBase64(bytes: Uint8Array) {
    try {
      const base64js = await import('base64-js').catch(() => null);
      if (base64js && base64js.fromByteArray) return base64js.fromByteArray(bytes);
    } catch {}
    try {
      // @ts-ignore
      return Buffer.from(bytes).toString('base64');
    } catch {
      return null;
    }
  }

  // load image bytes robustly (http(s) or local file/content URI)
  async function loadImageBytes(uri: string): Promise<Uint8Array | null> {
    let FileSystem: any = null;
    try {
      FileSystem = await loadFileSystem();
    } catch {
      FileSystem = null;
    }

    try {
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        const resp = await fetch(uri);
        const buf = await resp.arrayBuffer();
        return new Uint8Array(buf);
      }

      if (FileSystem && FileSystem.readAsStringAsync) {
        try {
          const encoding = (FileSystem.EncodingType && FileSystem.EncodingType.Base64) ? FileSystem.EncodingType.Base64 : 'base64';
          const b64 = await FileSystem.readAsStringAsync(uri, { encoding });
          if (b64) {
            try {
              const base64js = await import('base64-js').catch(() => null);
              if (base64js && base64js.toByteArray) return base64js.toByteArray(b64);
            } catch {}
            // @ts-ignore
            return Uint8Array.from(Buffer.from(b64, 'base64'));
          }
        } catch (fsErr) {
          console.warn('FileSystem.readAsStringAsync failed, falling back to fetch', fsErr);
        }
      }

      // last resort try fetch (some runtimes support fetch on file://)
      const resp = await fetch(uri);
      const arr = await resp.arrayBuffer();
      return new Uint8Array(arr);
    } catch (e) {
      console.warn('loadImageBytes failed for', uri, e);
      return null;
    }
  }

  // ---------- UI actions ----------
  const addHistory = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedGait = gaitType.trim();
    if (!trimmedName && !trimmedGait) {
      Alert.alert('Enter a name or gait type to save.');
      return;
    }
    const item: HistoryItem = {
      id: Date.now(),
      name: trimmedName || 'Unknown',
      gaitType: trimmedGait || 'Unspecified',
      jointDeviations: jointDeviations.trim() || undefined,
      images: selectedImages.length ? [...selectedImages] : undefined,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...items];
    setItems(next);
    await saveToStorage(next);
    setName('');
    setGaitType('');
    setJointDeviations('');
    setSelectedImages([]);
  }, [name, gaitType, jointDeviations, selectedImages, items]);

  async function deleteHistory(id: number) {
    Alert.alert('Delete entry', 'Delete this history entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = items.filter(i => i.id !== id);
          setItems(updated);
          await saveToStorage(updated);
        },
      },
    ]);
  }

  async function pickImage() {
    try {
      // @ts-ignore
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const granted = permission.granted ?? (permission.status === 'granted');
      if (!granted) {
        Alert.alert('Permission required', 'Gallery permission is required to pick images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85, // higher quality for PDF clarity
        allowsEditing: false,
      });

      const canceled = (result as any).canceled ?? (result as any).cancelled ?? false;
      const uri = (result as any).assets?.[0]?.uri ?? (result as any).uri ?? null;

      if (!canceled && uri) setSelectedImages([uri]);
    } catch (e) {
      console.warn('pickImage error', e);
      Alert.alert('Unavailable', 'Image picker not available. Install expo-image-picker for full functionality.');
    }
  }

  function removeSelectedImage(uri: string) {
    setSelectedImages(prev => prev.filter(u => u !== uri));
  }

  // ---------- PDF generation & preview ----------
  async function createPdfBytes(item: HistoryItem) {
    const [{ PDFDocument, StandardFonts }, base64js] = await Promise.all([
      import('pdf-lib'),
      import('base64-js').catch(() => null),
    ]);

    const pdfDoc = await (PDFDocument as any).create();
    const font = await (pdfDoc as any).embedFont(StandardFonts.Helvetica);
    const page = (pdfDoc as any).addPage([612, 792]);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    let y = pageHeight - 48;
    const margin = 48;
    const maxContentWidth = pageWidth - margin * 2;

    const drawTextLine = (txt: string, size = 12) => {
      page.drawText(txt, { x: margin, y, size, font });
      y -= size + 6;
    };

    drawTextLine('GaitAware — Result', 16);
    drawTextLine(`Name: ${item.name}`);
    drawTextLine(`Gait type: ${item.gaitType}`);
    if (item.jointDeviations) {
      drawTextLine('');
      drawTextLine('Joint deviations:');
      const text = item.jointDeviations;
      const approxCharsPerLine = 80;
      for (let i = 0; i < text.length; i += approxCharsPerLine) {
        drawTextLine(text.slice(i, i + approxCharsPerLine), 12);
      }
    }
    drawTextLine('');
    drawTextLine(`Recorded: ${new Date(item.createdAt).toLocaleString()}`);

    // embed first image only (keeps PDF smaller) — fits to width, no upscaling
    if (item.images && item.images.length) {
      for (const imgUri of item.images) {
        try {
          const imgBytes = await loadImageBytes(imgUri);
          if (!imgBytes) continue;

          const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50;
          let embeddedImage;
          try {
            embeddedImage = isPng ? await (pdfDoc as any).embedPng(imgBytes) : await (pdfDoc as any).embedJpg(imgBytes);
          } catch {
            try {
              embeddedImage = isPng ? await (pdfDoc as any).embedJpg(imgBytes) : await (pdfDoc as any).embedPng(imgBytes);
            } catch (e) {
              console.warn('embed fallback failed', e);
              continue;
            }
          }

          const imgWidth = embeddedImage.width ?? embeddedImage.size?.width ?? 0;
          const imgHeight = embeddedImage.height ?? embeddedImage.size?.height ?? 0;
          const maxW = maxContentWidth;
          const scaleW = imgWidth ? Math.min(1, maxW / imgWidth) : 1;
          const scale = scaleW;
          const drawW = imgWidth * scale;
          const drawH = imgHeight * scale;

          if (y - drawH < margin) {
            const p = (pdfDoc as any).addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
            p.drawImage(embeddedImage, { x: margin, y: y - drawH, width: drawW, height: drawH });
            y -= drawH + 12;
          } else {
            page.drawImage(embeddedImage, { x: margin, y: y - drawH, width: drawW, height: drawH });
            y -= drawH + 12;
          }
        } catch (e) {
          console.warn('image embed failed', e);
          continue;
        }
      }
    }

    const pdfBytes: Uint8Array = await pdfDoc.save();
    const b64 = await bytesToBase64(pdfBytes);
    if (!b64) throw new Error('Failed to encode PDF to base64');
    return b64;
  }

  async function generateAndPreview(item: HistoryItem) {
    setGeneratingId(item.id);
    try {
      const b64 = await createPdfBytes(item);
      // set friendly filename: "Name, GaitAware Analysis Report, test"
      const safeName = sanitizeFilename(item.name || 'Unknown');
      previewFilenameRef.current = `${safeName}, GaitAware Analysis Report`;
      setPreviewDataUri(`data:application/pdf;base64,${b64}`);
      setPreviewVisible(true);
    } catch (err) {
      console.warn('generate PDF error', err);
      Alert.alert('Error', 'Could not generate PDF.');
    } finally {
      setGeneratingId(null);
    }
  }

  // ---------- saving ----------
  async function savePreviewPdfLocally() {
    if (!previewDataUri) {
      Alert.alert('No PDF', 'No PDF is available to save.');
      return;
    }
    setSavingPdf(true);
    try {
      const b64 = previewDataUri.startsWith('data:') ? previewDataUri.split(',')[1] : previewDataUri;
      const FileSystem: any = await loadFileSystem();
      if (!FileSystem) {
        Alert.alert('Missing module', 'expo-file-system is required to save files locally. Install and rebuild.');
        return;
      }

      const filename = sanitizeFilename(previewFilenameRef.current ?? `GaitAware-${Date.now()}`) + '.pdf';
      const encoding = (FileSystem.EncodingType && FileSystem.EncodingType.Base64) ? FileSystem.EncodingType.Base64 : 'base64';

      // Android: use SAF + user-selected folder (choose Downloads)
      if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
        try {
          // @ts-ignore
          const res = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          const directoryUri = res.directoryUri ?? res;
          if (!directoryUri) {
            Alert.alert('Cancelled', 'Folder selection was cancelled. PDF not saved.');
            return;
          }
          // @ts-ignore
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(directoryUri, filename, 'application/pdf');
          if (fileUri) {
            await FileSystem.writeAsStringAsync(fileUri, b64, { encoding });
            Alert.alert('Saved', 'PDF saved to selected folder. Check your Downloads if you picked it.');
            return;
          }
        } catch (safErr) {
          console.warn('SAF save failed', safErr);
        }
      }

      // Fallback: write to app documents/cache and offer system share/save sheet
      const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
      const path = `${baseDir}${filename}`;
      await FileSystem.writeAsStringAsync(path, b64, { encoding });

      try {
        // @ts-ignore
        const SharingMod = await import('expo-sharing').catch(() => null);
        const Sharing = SharingMod ? SharingMod.default ?? SharingMod : null;
        if (Sharing && (await (Sharing.isAvailableAsync?.() ?? Promise.resolve(true)))) {
          await Sharing.shareAsync(path, { mimeType: 'application/pdf' });
          return;
        }
      } catch (shareErr) {
        console.warn('sharing failed', shareErr);
      }

      Alert.alert('Saved', `PDF saved to app folder:\n${path}\nUse Files app to move it to Downloads.`);
    } catch (e) {
      console.warn('savePreviewPdfLocally failed', e);
      Alert.alert('Save failed', 'Could not save PDF locally. See console for details.');
    } finally {
      setSavingPdf(false);
    }
  }

  // ---------- rendering helpers ----------
  function renderPdfPreview() {
    if (!previewDataUri) {
      return (
        <View style={styles.previewFallback}>
          <Text style={styles.previewFallbackText}>No PDF available to preview.</Text>
        </View>
      );
    }
    const b64 = previewDataUri.startsWith('data:') ? previewDataUri.split(',')[1] : previewDataUri;
    const html = `
      <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" />
      <style>html,body{height:100%;margin:0;padding:0}#viewer{width:100%;}canvas{display:block;margin:8px auto;max-width:100%;height:auto;}</style>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
      </head><body><div id="viewer"></div><script>
      (function(){const b='${b64}';function b64ToUint8Array(s){const t=atob(s);const u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);return u;}
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      pdfjsLib.getDocument({data:b64ToUint8Array(b)}).promise.then(function(pdf){const viewer=document.getElementById('viewer');for(let p=1;p<=pdf.numPages;p++){pdf.getPage(p).then(function(page){const scale=Math.min(window.innerWidth/page.getViewport({scale:1}).width,1.6);const vp=page.getViewport({scale});const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');canvas.width=vp.width;canvas.height=vp.height;viewer.appendChild(canvas);page.render({canvasContext:ctx,viewport:vp});});}}).catch(function(err){document.body.innerHTML='<div style="padding:20px;color:#900">Failed to load PDF: '+(err.message||err)+'</div>';});
      })();
      </script></body></html>
    `;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const WebView = require('react-native-webview').WebView ?? require('react-native-webview').default;
      return <WebView originWhitelist={['*']} source={{ html }} style={{ flex: 1 }} />;
    } catch (e) {
      return (
        <View style={styles.previewFallback}>
          <Text style={styles.previewFallbackText}>
            react-native-webview not available. Install and rebuild the app to preview PDFs inside the app.
          </Text>
          <TouchableOpacity
            style={styles.openExternBtn}
            onPress={() => {
              Linking.openURL(previewDataUri!).catch(() => {
                Alert.alert('Open failed', 'Cannot open PDF externally from this environment.');
              });
            }}
          >
            <Text style={styles.openExternText}>Open externally</Text>
          </TouchableOpacity>
        </View>
      );
    }
  }

  // ---------- item UI ----------
  function renderItem({ item }: { item: HistoryItem }) {
    const dateLabel = new Date(item.createdAt).toLocaleString();
    const thumbUri = item.images && item.images.length ? item.images[0] : null;
    return (
      <View style={styles.row}>
        <View style={styles.leftImageSlot}>
          {thumbUri ? <Image source={{ uri: thumbUri }} style={styles.thumb} /> : <View style={styles.placeholder}><Text style={styles.placeholderText}>No Image</Text></View>}
        </View>

        <View style={styles.rowLeft}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.gaitType}>{item.gaitType}</Text>
          {item.jointDeviations ? <Text style={styles.note}>{item.jointDeviations}</Text> : null}
          <Text style={styles.date}>{dateLabel}</Text>
        </View>

        <View style={styles.rowRight}>
          <TouchableOpacity style={styles.pdfBtn} onPress={() => generateAndPreview(item)} disabled={generatingId === item.id}>
            {generatingId === item.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.pdfBtnText}>Create PDF</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteHistory(item.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- main render ----------
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.headerRow}>
        <Text style={styles.headingCompact}>History</Text>
      </View>

      <View style={styles.form}>
        <TextInput placeholder="Name" value={name} onChangeText={setName} style={styles.input} placeholderTextColor="#666" />
        <TextInput placeholder="Gait type" value={gaitType} onChangeText={setGaitType} style={styles.input} placeholderTextColor="#666" />
        <TextInput placeholder="Joint deviations / notes" value={jointDeviations} onChangeText={setJointDeviations} style={[styles.input, styles.noteInput]} placeholderTextColor="#666" multiline />

        <View style={styles.imagePickerRow}>
          <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
            <Text style={styles.addImageText}>{selectedImages.length ? 'Replace Image' : 'Add Image'}</Text>
          </TouchableOpacity>

          <View style={styles.selectedImagesRow}>
            {selectedImages.map((uri, idx) => (
              <View key={`${uri}-${idx}`} style={styles.selectedImageWrap}>
                <Image source={{ uri }} style={styles.selectedThumb} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeSelectedImage(uri)}>
                  <Text style={styles.removeImageText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={addHistory}>
          <Text style={styles.addBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <FlatList data={items} keyExtractor={i => i.id.toString()} renderItem={renderItem} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading...' : 'No history yet'}</Text>} />

      <Modal visible={previewVisible} animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.previewHeader}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setPreviewVisible(false)} style={styles.previewClose}>
              <Text style={styles.previewCloseText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={savePreviewPdfLocally} style={[styles.previewClose, { marginRight: 8 }]} disabled={savingPdf}>
              {savingPdf ? <ActivityIndicator /> : <Text style={{ color: '#0b62d6', fontWeight: '600' }}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.previewBody}>{renderPdfPreview()}</View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 24 },
  headerRow: { paddingHorizontal: 20, paddingVertical: 8, marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headingCompact: { fontSize: 18, fontWeight: '700', color: '#000' },

  form: { paddingHorizontal: 20, paddingVertical: 12, marginHorizontal: 12, borderRadius: 8, marginBottom: 12, backgroundColor: '#fafafa' },
  input: { fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#000', backgroundColor: '#fff', marginBottom: 8 },
  noteInput: { minHeight: 60, textAlignVertical: 'top' },

  imagePickerRow: { flexDirection: 'column', marginBottom: 8 },
  addImageBtn: { backgroundColor: '#eef6ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' },
  addImageText: { color: '#0b62d6', fontWeight: '600' },
  selectedImagesRow: { flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' },
  selectedImageWrap: { marginRight: 8, marginBottom: 8, position: 'relative' },
  selectedThumb: { width: 64, height: 64, borderRadius: 6, borderWidth: 1, borderColor: '#ddd' },
  removeImageBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#d00', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  removeImageText: { color: '#fff', fontWeight: '700' },

  addBtn: { marginTop: 6, backgroundColor: '#0066cc', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  list: { paddingHorizontal: 12, paddingBottom: 48 },
  row: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 10, marginHorizontal: 8, borderWidth: 1, borderColor: '#eee', alignItems: 'flex-start' },
  leftImageSlot: { width: 72, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  thumb: { width: 64, height: 64, borderRadius: 6 },
  placeholder: { width: 64, height: 64, borderRadius: 6, backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#999', fontSize: 11 },

  rowLeft: { flex: 1 },
  rowRight: { justifyContent: 'center', alignItems: 'flex-end' },
  name: { fontSize: 16, fontWeight: '700' },
  gaitType: { fontSize: 15, color: '#333', marginTop: 4 },
  note: { fontSize: 14, color: '#333', marginTop: 6 },
  date: { fontSize: 12, color: '#666', marginTop: 8 },

  pdfBtn: { backgroundColor: '#0b62d6', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, marginBottom: 8 },
  pdfBtnText: { color: '#fff', fontWeight: '600' },

  deleteBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  deleteText: { color: '#d00', fontWeight: '600' },

  empty: { textAlign: 'center', color: '#666', marginTop: 24, fontSize: 16 },
  previewHeader: { height: 56, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  previewClose: { padding: 8 },
  previewCloseText: { color: '#0b62d6', fontWeight: '600' },
  previewBody: { flex: 1, backgroundColor: '#fff' },
  previewFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  previewFallbackText: { color: '#333', textAlign: 'center', marginBottom: 16 },
  openExternBtn: { backgroundColor: '#0b62d6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 },
  openExternText: { color: '#fff', fontWeight: '600' },
});

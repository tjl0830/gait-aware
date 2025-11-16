import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// NOTE: AsyncStorage, FileSystem, Sharing and ImagePicker are loaded dynamically to avoid bundler errors if not installed.
// Recommended installs for full functionality:
// npx expo install expo-file-system expo-sharing @react-native-async-storage/async-storage expo-image-picker
// npm install pdf-lib base64-js

const STORAGE_KEY = 'gaitaware:history';

// simple shape for stored items (now includes images)
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
  const [selectedImages, setSelectedImages] = useState<string[]>([]); // images chosen before saving
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  // dynamic AsyncStorage holder
  let AsyncStorage: any = null;

  async function ensureAsyncStorage() {
    if (AsyncStorage) return AsyncStorage;
    try {
      // try default export then module
      // @ts-ignore
      const mod = await import('@react-native-async-storage/async-storage');
      AsyncStorage = mod.default ?? mod;
      return AsyncStorage;
    } catch (e) {
      AsyncStorage = null;
      return null;
    }
  }

  useEffect(() => {
    loadFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFromStorage() {
    try {
      const storage = await ensureAsyncStorage();
      if (storage) {
        const raw = await storage.getItem(STORAGE_KEY);
        const list: HistoryItem[] = raw ? JSON.parse(raw) : [];
        setItems(list);
      } else {
        setItems([]); // in-memory only
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
      if (storage) {
        await storage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
    } catch (e) {
      console.warn('saveToStorage error', e);
    }
  }

  async function addHistory() {
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
  }

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

  // Image picker: pick one image (robust handling for different SDKs)
  async function pickImage() {
    try {
      // dynamic import to avoid bundler errors if expo-image-picker not installed
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
        quality: 0.6,
        allowsEditing: false,
      });

      // support both old and new result shapes:
      // new: { canceled: boolean, assets: [{ uri }] }
      // old: { cancelled: boolean, uri }
      const canceled = (result as any).canceled ?? (result as any).cancelled ?? false;
      const uri = (result as any).assets?.[0]?.uri ?? (result as any).uri ?? null;

      if (!canceled && uri) {
        // keep single test image (replace previous)
        setSelectedImages([uri]);
      }
    } catch (e) {
      console.warn('pickImage error', e);
      Alert.alert('Unavailable', 'Image picker not available. Install expo-image-picker for full functionality.');
    }
  }

  function removeSelectedImage(uri: string) {
    setSelectedImages(prev => prev.filter(u => u !== uri));
  }

  // Generate PDF, include images where possible, save to device and share
  async function generateAndSharePdf(item: HistoryItem) {
    setGeneratingId(item.id);
    try {
      const [{ PDFDocument, StandardFonts }, base64js] = await Promise.all([
        // pdf-lib
        import('pdf-lib'),
        import('base64-js').catch(() => null),
      ]);

      const pdfDoc = await (PDFDocument as any).create();
      const font = await (pdfDoc as any).embedFont(StandardFonts.Helvetica);
      const page = (pdfDoc as any).addPage([612, 792]);
      const { width, height } = page.getSize();
      let y = height - 48;
      const line = (txt: string, size = 12) => {
        page.drawText(txt, { x: 48, y, size, font });
        y -= size + 6;
      };

      line('GaitAware — Result', 16);
      line(`Name: ${item.name}`);
      line(`Gait type: ${item.gaitType}`);
      if (item.jointDeviations) {
        line('');
        line('Joint deviations:');
        const text = item.jointDeviations;
        const approxCharsPerLine = 80;
        for (let i = 0; i < text.length; i += approxCharsPerLine) {
          line(text.slice(i, i + approxCharsPerLine), 12);
        }
      }
      line('');
      line(`Recorded: ${new Date(item.createdAt).toLocaleString()}`);

      // try to embed images (one or more) below the text if present
      if (item.images && item.images.length) {
        // dynamic file system
        let FileSystem: any = null;
        try {
          // @ts-ignore
          FileSystem = await import('expo-file-system');
        } catch {
          FileSystem = null;
        }

        for (const imgUri of item.images) {
          try {
            let imgBytes: Uint8Array | null = null;

            if (FileSystem && FileSystem.readAsStringAsync) {
              // read as base64 then convert
              // Some URIs may be remote (http). For remote URIs, fetch is used.
              if (imgUri.startsWith('http')) {
                const resp = await fetch(imgUri);
                const arr = new Uint8Array(await resp.arrayBuffer());
                imgBytes = arr;
              } else {
                // file:// or content:// -- try readAsStringAsync
                const b64 = await FileSystem.readAsStringAsync(imgUri, { encoding: FileSystem.EncodingType.Base64 });
                const base64js = await import('base64-js');
                imgBytes = base64js.toByteArray(b64);
              }
            } else {
              // fallback: try fetch for bundled or remote URIs
              const resp = await fetch(imgUri);
              const arr = new Uint8Array(await resp.arrayBuffer());
              imgBytes = arr;
            }

            if (imgBytes) {
              // try to detect PNG vs JPG by data header
              const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50;
              let embeddedImage;
              if (isPng) {
                embeddedImage = await (pdfDoc as any).embedPng(imgBytes);
              } else {
                embeddedImage = await (pdfDoc as any).embedJpg(imgBytes);
              }
              const imgDims = embeddedImage.scale(0.5);
              // place image; if not enough vertical space, add new page
              if (y - imgDims.height < 48) {
                // add new page
                const p = (pdfDoc as any).addPage([612, 792]);
                y = 792 - 48;
                p.drawImage(embeddedImage, { x: 48, y: y - imgDims.height, width: imgDims.width, height: imgDims.height });
                y -= imgDims.height + 12;
              } else {
                page.drawImage(embeddedImage, { x: 48, y: y - imgDims.height, width: imgDims.width, height: imgDims.height });
                y -= imgDims.height + 12;
              }
            }
          } catch (e) {
            console.warn('embed image failed', e);
            // continue with other images
          }
        }
      }

      const pdfBytes: Uint8Array = await pdfDoc.save();

      // convert to base64 for saving
      let b64 = '';
      if (base64js && base64js.fromByteArray) {
        b64 = base64js.fromByteArray(pdfBytes);
      } else {
        try {
          // @ts-ignore
          b64 = Buffer.from(pdfBytes).toString('base64');
        } catch {
          Alert.alert('Error', 'Cannot encode PDF on this device (missing base64 library).');
          return;
        }
      }

      // dynamic file system & sharing
      let FileSystem: any = null;
      let Sharing: any = null;
      try {
        // try to load expo-file-system if installed
        // @ts-ignore
        FileSystem = await import('expo-file-system');
      } catch (e) {
        FileSystem = null;
      }
      try {
        // try to load expo-sharing if installed
        // @ts-ignore
        Sharing = await import('expo-sharing');
        Sharing = Sharing.default ?? Sharing;
      } catch (e) {
        Sharing = null;
      }

      const filename = `gait_${item.id}.pdf`;

      if (FileSystem && FileSystem.documentDirectory) {
        const path = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });

        // calling isAvailableAsync may throw if native module is not linked; guard it
        let shareAvailable = false;
        try {
          shareAvailable = !!(Sharing && (await Sharing.isAvailableAsync()));
        } catch (e) {
          console.warn('expo-sharing native module missing or failed:', e);
          shareAvailable = false;
        }

        if (shareAvailable) {
          try {
            await Sharing.shareAsync(path, { mimeType: 'application/pdf' });
            return;
          } catch (e) {
            console.warn('shareAsync failed', e);
            Alert.alert('Saved', `PDF saved to:\n${path}\nSharing failed.`);
            return;
          }
        } else {
          // Sharing not available: inform user where file is saved
          Alert.alert('Saved', `PDF saved to:\n${path}\nYou can share it using your device file manager.`);
          return;
        }
      } else {
        Alert.alert('Unavailable', 'FileSystem not available. Install expo-file-system for PDF saving.');
      }
    } catch (err) {
      console.warn('generateAndSharePdf error', err);
      Alert.alert('Error', 'Could not generate or share PDF.');
    } finally {
      setGeneratingId(null);
    }
  }

  function renderItem({ item }: { item: HistoryItem }) {
    const dateLabel = new Date(item.createdAt).toLocaleString();
    const thumbUri = item.images && item.images.length ? item.images[0] : null;
    return (
      <View style={styles.row}>
        <View style={styles.leftImageSlot}>
          {thumbUri ? (
            <Image source={{ uri: thumbUri }} style={styles.thumb} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>

        <View style={styles.rowLeft}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.gaitType}>{item.gaitType}</Text>
          {item.jointDeviations ? <Text style={styles.note}>{item.jointDeviations}</Text> : null}
          <Text style={styles.date}>{dateLabel}</Text>
        </View>

        <View style={styles.rowRight}>
          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={() => generateAndSharePdf(item)}
            disabled={generatingId === item.id}
          >
            {generatingId === item.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.pdfBtnText}>Create PDF</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteHistory(item.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.headerRow}>
        <Text style={styles.headingCompact}>History</Text>
      </View>

      <View style={styles.form}>
        <TextInput placeholder="Name" value={name} onChangeText={setName} style={styles.input} placeholderTextColor="#666" />
        <TextInput placeholder="Gait type" value={gaitType} onChangeText={setGaitType} style={styles.input} placeholderTextColor="#666" />
        <TextInput
          placeholder="Joint deviations / notes"
          value={jointDeviations}
          onChangeText={setJointDeviations}
          style={[styles.input, styles.noteInput]}
          placeholderTextColor="#666"
          multiline
        />

        <View style={styles.imagePickerRow}>
          <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
            <Text style={styles.addImageText}>{selectedImages.length ? 'Replace Image (tester)' : 'Add Image (tester)'}</Text>
          </TouchableOpacity>

          <View style={styles.selectedImagesRow}>
            {selectedImages.map((uri, idx) => (
              <View key={`${uri ?? 'img'}-${idx}`} style={styles.selectedImageWrap}>
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

      <FlatList
        data={items}
        keyExtractor={i => i.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading...' : 'No history yet'}</Text>}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 24 },
  headerRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headingCompact: { fontSize: 18, fontWeight: '700', color: '#000' },

  form: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#000',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
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
  row: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 10,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'flex-start',
  },
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
});

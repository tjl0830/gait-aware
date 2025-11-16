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
  pdfPath?: string; // local saved PDF path (file://...)
  gender?: string;
  age?: string;
  notes?: string;
};

export default function Tab() {
  // toggle whole form (name / gait / joint deviations / gender / age / notes / add image / save)
  const [showForm, setShowForm] = useState(true);
  const [name, setName] = useState('');
  const [gaitType, setGaitType] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [jointDeviations, setJointDeviations] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
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
      gender: gender.trim() || undefined,
      age: age.trim() || undefined,
      notes: notes.trim() || undefined,
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
    setGender('');
    setAge('');
    setNotes('');
  }, [name, gaitType, jointDeviations, selectedImages, items, gender, age, notes]);

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
  // create PDF bytes. heavy work deferred to InteractionManager to avoid blocking UI
  async function createPdfBytes(item: HistoryItem) {
    const [{ PDFDocument, StandardFonts, rgb }, base64js] = await Promise.all([
      import('pdf-lib'),
      import('base64-js').catch(() => null),
    ]);

    const pdfDoc = await (PDFDocument as any).create();
    const font = await (pdfDoc as any).embedFont(StandardFonts.Helvetica);
    // try to load a bold variant; fallback to same font
    let fontBold;
    try {
      // some pdf-lib builds expose Helvetica-Bold as StandardFonts.HelveticaBold
      // if not available this will throw and we fallback to a simulated bold
      // @ts-ignore
      fontBold = await (pdfDoc as any).embedFont((StandardFonts as any).HelveticaBold ?? StandardFonts.Helvetica);
    } catch {
      fontBold = font;
    }

    const page = (pdfDoc as any).addPage([612, 792]); // US Letter
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    const margin = 48;
    let y = pageHeight - margin;

    const maxContentWidth = pageWidth - margin * 2;

    // helper: draw bold text (uses bold font if available, otherwise draws twice for weight)
    const drawBold = (pg: any, text: string, x: number, yy: number, size: number) => {
      if (fontBold !== font) {
        pg.drawText(text, { x, y: yy, size, font: fontBold });
      } else {
        // simulate bold by drawing twice with tiny offset
        pg.drawText(text, { x, y: yy, size, font });
        pg.drawText(text, { x: x + 0.5, y: yy - 0.5, size, font });
      }
    };

    // subtle color helpers
    const gray = rgb ? rgb(0.45, 0.45, 0.45) : undefined;
    const lightGray = rgb ? rgb(0.9, 0.9, 0.9) : undefined;

    // small helper to draw a horizontal rule
    const drawHr = (pg: any, fromX: number, toX: number, atY: number) => {
      try {
        pg.drawLine({ start: { x: fromX, y: atY }, end: { x: toX, y: atY }, thickness: 0.5, color: gray });
      } catch {}
    };

    // --- Header logo (centered) ---
    try {
      // @ts-ignore
      const { Asset } = await import('expo-asset');
      const moduleRef = require('../../assets/images/gaitaware_header_text.png');
      await Asset.loadAsync(moduleRef);
      const assetObj = Asset.fromModule(moduleRef);
      const headerUri = assetObj.localUri ?? assetObj.uri;
      if (headerUri) {
        const headerBytes = await loadImageBytes(headerUri);
        if (headerBytes) {
          const isPngHeader = headerBytes[0] === 0x89 && headerBytes[1] === 0x50;
          let embeddedHeader: any = null;
          try {
            embeddedHeader = isPngHeader ? await (pdfDoc as any).embedPng(headerBytes) : await (pdfDoc as any).embedJpg(headerBytes);
          } catch {
            try {
              embeddedHeader = isPngHeader ? await (pdfDoc as any).embedJpg(headerBytes) : await (pdfDoc as any).embedPng(headerBytes);
            } catch (err) {
              console.warn('header embed failed', err);
            }
          }
          if (embeddedHeader) {
            const hdrW = embeddedHeader.width ?? embeddedHeader.size?.width ?? 0;
            const hdrH = embeddedHeader.height ?? embeddedHeader.size?.height ?? 0;
            const maxHeaderHeight = 40;
            let scale = 1;
            if (hdrW) scale = Math.min(1, maxContentWidth / hdrW);
            if (hdrH && hdrH * scale > maxHeaderHeight) scale = Math.min(scale, maxHeaderHeight / hdrH);
            const drawW = hdrW * scale;
            const drawH = hdrH * scale;
            const drawX = (pageWidth - drawW) / 2;
            const drawY = y - drawH;
            page.drawImage(embeddedHeader, { x: drawX, y: drawY, width: drawW, height: drawH });
            y = drawY - 22; // increased gap under header for better separation
          }
        }
      }
    } catch (e) {
      console.warn('Header image embed skipped', e);
    }

    // --- Disclaimer (centered, small) ---
    try {
      const disclaimer = 'Disclaimer: The analysis results are for informational purposes only and are not clinical diagnoses. Consult a healthcare professional for clinical assessment.';
      const size = 10;
      const maxW = maxContentWidth;
      function wrapText(text: string, f: any, s: number, mw: number) {
        const words = text.split(' ');
        const lines: string[] = [];
        let line = '';
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          const testWidth = f.widthOfTextAtSize(test, s);
          if (testWidth <= mw) line = test;
          else {
            if (line) lines.push(line);
            line = w;
          }
        }
        if (line) lines.push(line);
        return lines;
      }
      const lines = wrapText(disclaimer, font, size, maxW);
      for (const ln of lines) {
        const textWidth = font.widthOfTextAtSize(ln, size);
        const x = (pageWidth - textWidth) / 2;
        page.drawText(ln, { x, y, size, font, color: gray });
        y -= size + 4;
      }
      // larger gap between disclaimer and User Information as requested
      y -= 28;
    } catch (e) {
      console.warn('Failed to draw disclaimer', e);
    }

    if (y < 180) {
      (pdfDoc as any).addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    // --- User Information section (with uploaded image at left) ---
    try {
      // section title (bold)
      const titleSize = 14;
      drawBold(page, 'User Information', margin, y, titleSize);
      y -= titleSize + 8;
      drawHr(page, margin, pageWidth - margin, y + 6);
      y -= 6;

      // layout columns
      const leftColWidth = 120;
      const leftX = margin;
      const rightX = margin + leftColWidth + 16;
      const rightColWidth = pageWidth - rightX - margin;
      let topY = y;

      // draw a faint box background for the user info area for a professional look
      const infoBoxHeight = 110;
      try {
        if (lightGray) page.drawRectangle({ x: margin - 4, y: y - infoBoxHeight + 8, width: pageWidth - margin * 2 + 8, height: infoBoxHeight, color: lightGray, opacity: 0.15 });
      } catch {}

      // user uploaded image (left column)
      if (item.images && item.images.length) {
        try {
          const userImageUri = item.images[0];
          const imgBytes = await loadImageBytes(userImageUri);
          if (imgBytes) {
            const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50;
            let embedImg: any = null;
            try {
              embedImg = isPng ? await (pdfDoc as any).embedPng(imgBytes) : await (pdfDoc as any).embedJpg(imgBytes);
            } catch {
              try {
                embedImg = isPng ? await (pdfDoc as any).embedJpg(imgBytes) : await (pdfDoc as any).embedPng(imgBytes);
              } catch (e) {
                console.warn('user image embed failed', e);
                embedImg = null;
              }
            }
            if (embedImg) {
              const iw = embedImg.width ?? embedImg.size?.width ?? 0;
              const ih = embedImg.height ?? embedImg.size?.height ?? 0;
              const scale = iw ? Math.min(1, leftColWidth / iw) : 1;
              const drawW = iw * scale;
              const drawH = ih * scale;
              const drawY = topY - drawH;
              page.drawImage(embedImg, { x: leftX, y: drawY, width: drawW, height: drawH });
            }
          }
        } catch (e) {
          console.warn('user image section error', e);
        }
      }

      // right column: labels bold, values normal
      const labelSize = 11;
      const valueSize = 11;
      let cursorY = topY - 4;
      drawBold(page, 'Name:', rightX, cursorY, labelSize);
      page.drawText(` ${item.name ?? '—'}`, { x: rightX + 44, y: cursorY, size: valueSize, font, color: gray });
      cursorY -= labelSize + 6;

      drawBold(page, 'Gender:', rightX, cursorY, labelSize);
      page.drawText(` ${item.gender ?? '—'}`, { x: rightX + 56, y: cursorY, size: valueSize, font, color: gray });
      cursorY -= labelSize + 6;

      drawBold(page, 'Age:', rightX, cursorY, labelSize);
      page.drawText(` ${item.age ?? '—'}`, { x: rightX + 32, y: cursorY, size: valueSize, font, color: gray });
      cursorY -= labelSize + 8;

      drawBold(page, 'Notes:', rightX, cursorY, labelSize);
      cursorY -= labelSize + 4;
      // wrap notes into rightColWidth
      const wrap = (text: string, f: any, s: number, mw: number) => {
        const words = text.split(' ');
        const lines: string[] = [];
        let line = '';
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          const width = f.widthOfTextAtSize(test, s);
          if (width <= mw) line = test;
          else {
            if (line) lines.push(line);
            line = w;
          }
        }
        if (line) lines.push(line);
        return lines;
      };
      const noteLines = wrap(item.notes ?? '—', font, valueSize, rightColWidth);
      for (const ln of noteLines) {
        page.drawText(ln, { x: rightX, y: cursorY, size: valueSize, font, color: gray });
        cursorY -= valueSize + 4;
      }

      // move y below user info box
      y = y - infoBoxHeight - 8;
    } catch (e) {
      console.warn('User info section failed', e);
    }

    // --- Analysis Results (gait classification + detected potential joint abnormalities) ---
    try {
      const sectionTitleSize = 14;
      drawBold(page, 'Analysis Results', margin, y, sectionTitleSize);
      y -= sectionTitleSize + 8;
      drawHr(page, margin, pageWidth - margin, y + 6);
      y -= 6;

      // Gait classification (label bold)
      drawBold(page, 'Gait classification:', margin, y, 14);
      page.drawText(` ${item.gaitType ?? '—'}`, { x: margin + 120, y, size: 12, font, color: gray });
      y -= 20;

      // Detected potential joint abnormalities
      drawBold(page, 'Detected potential joint abnormalities:', margin, y, 12);
      y -= 16;

      const abnormalitiesText = item.jointDeviations ? item.jointDeviations : 'None detected';
      const abLines = (() => {
        const words = abnormalitiesText.split(' ');
        const lines: string[] = [];
        let line = '';
        const maxW = maxContentWidth;
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          const width = font.widthOfTextAtSize(test, 11);
          if (width <= maxW) line = test;
          else {
            if (line) lines.push(line);
            line = w;
          }
        }
        if (line) lines.push(line);
        return lines;
      })();

      for (const ln of abLines) {
        page.drawText('•', { x: margin + 2, y, size: 11, font });
        page.drawText(ln, { x: margin + 12, y, size: 11, font, color: gray });
        y -= 16;
        if (y < margin + 80) {
          (pdfDoc as any).addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
      }
    } catch (e) {
      console.warn('Analysis section failed', e);
    }

    // final save
    const pdfBytes: Uint8Array = await (pdfDoc as any).save();
    // convert to base64
    try {
      if (base64js && base64js.fromByteArray) return base64js.fromByteArray(pdfBytes);
    } catch {}
    try {
      // @ts-ignore
      return Buffer.from(pdfBytes).toString('base64');
    } catch (err) {
      throw new Error('Base64 conversion failed');
    }
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
      (function(){
        const b='${b64}';
        function b64ToUint8Array(s){const t=atob(s);const u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);return u;}
        pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        const data = b64ToUint8Array(b);
        pdfjsLib.getDocument({data}).promise.then(async function(pdf){
          const viewer=document.getElementById('viewer');
          for(let p=1;p<=pdf.numPages;p++){
            const page = await pdf.getPage(p);
            // base scale to fit width (remove or raise cap if you want larger renders)
            const baseVp = page.getViewport({scale:1});
            const fitScale = Math.min(window.innerWidth / baseVp.width, 1.6);
            const outputScale = window.devicePixelRatio || 1;
            const vp = page.getViewport({scale: fitScale * outputScale});
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if(!ctx){ continue; }
            // set high-res backing store size and CSS display size
            canvas.width = Math.floor(vp.width);
            canvas.height = Math.floor(vp.height);
            canvas.style.width = Math.floor(vp.width / outputScale) + 'px';
            canvas.style.height = Math.floor(vp.height / outputScale) + 'px';
            viewer.appendChild(canvas);
            // Optional: improve sharpness when drawing scaled bitmaps
            ctx.imageSmoothingEnabled = true;
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
          }
        }).catch(function(err){
          document.body.innerHTML='<div style="padding:20px;color:#900">Failed to load PDF: '+(err.message||err)+'</div>';
        });
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
            {generatingId === item.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.pdfBtnText}>View report</Text>}
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.form}>
        {/* global toggle to show/hide all inputs and action buttons */}
        <TouchableOpacity onPress={() => setShowForm(s => !s)} style={{ alignSelf: 'flex-start', padding: 8, backgroundColor: '#eee', borderRadius: 6, marginBottom: 10 }}>
          <Text style={{ fontSize: 14 }}>{showForm ? 'Hide inputs' : 'Show inputs'}</Text>
        </TouchableOpacity>

        {showForm && (
          <>
             <TextInput placeholder="Name" value={name} onChangeText={setName} style={styles.input} placeholderTextColor="#666" />
             <TextInput placeholder="Gait type" value={gaitType} onChangeText={setGaitType} style={styles.input} placeholderTextColor="#666" />
             <TextInput placeholder="Joint deviations / analysis" value={jointDeviations} onChangeText={setJointDeviations} style={[styles.input, styles.noteInput]} placeholderTextColor="#666" multiline />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <TextInput placeholder="Gender" value={gender} onChangeText={setGender} style={[styles.input, { flex: 1, marginRight: 8 }]} placeholderTextColor="#666" />
              <TextInput placeholder="Age" value={age} onChangeText={setAge} style={[styles.input, { width: 100 }]} placeholderTextColor="#666" keyboardType="numeric" />
            </View>
            <TextInput placeholder="Notes" value={notes} onChangeText={setNotes} style={[styles.input, styles.noteInput, { marginTop: 8 }]} placeholderTextColor="#666" multiline />

            <View style={{ flexDirection: 'row', marginTop: 10, alignItems: 'center' }}>
              <TouchableOpacity onPress={pickImage} style={[styles.actionBtn, { marginRight: 8 }]}>
                <Text style={styles.actionBtnText}>Add image</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addHistory} style={[styles.primaryBtn]}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
       </View>
 
       {/* Analysis History header */}
      <Text style={styles.analysisHeader}>Analysis History</Text>

       {/* rest of screen (history list, modal, etc.) */}
      <FlatList data={items} keyExtractor={i => i.id.toString()} renderItem={renderItem} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading...' : 'No history yet'}</Text>} />

      <Modal visible={previewVisible} animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.previewHeader}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setPreviewVisible(false)} style={styles.previewClose}>
              <Text style={styles.previewCloseText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={savePreviewPdfLocally} style={[styles.previewClose, { marginRight: 8 }]} disabled={savingPdf}>
              {savingPdf ? <ActivityIndicator /> : <Text style={{ color: '#0b62d6', fontWeight: '600' }}>Save as PDF</Text>}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.previewBody}>{renderPdfPreview()}</View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 24 },
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
  row: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderColor: '#a1a1a1ff', borderRadius: 8, marginBottom: 10, marginHorizontal: 8, borderWidth: 1.5, alignItems: 'flex-start' },
  leftImageSlot: { width: 72, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  thumb: { width: 64, height: 64, borderRadius: 6 },
  placeholder: { width: 64, height: 64, borderRadius: 6, backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#999', fontSize: 11 },

  rowLeft: { flex: 1 },
  rowRight: { justifyContent: 'center', alignItems: 'flex-end' },
  name: { fontSize: 18, fontWeight: '700' },
  gaitType: { fontSize: 17, color: '#333', marginTop: 4 },
  note: { fontSize: 16, color: '#333', marginTop: 2 },
  date: { fontSize: 14, color: '#666', marginTop: 9 },

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

  actionBtn: { backgroundColor: '#0b62d6', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '600' },

  primaryBtn: { backgroundColor: '#0066cc', paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600' },

  analysisHeader: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 14,
  },
});

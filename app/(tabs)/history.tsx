import { useFocusEffect } from "@react-navigation/native";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Minimal helpful note: modules (loaded dynamically) that improve functionality:
// expo-file-system, expo-sharing, expo-media-library, @react-native-async-storage/async-storage, expo-image-picker
// npm packages: pdf-lib, base64-js
// If you use Expo Go and see missing native module errors, create a dev client or build with EAS.

const STORAGE_KEY = "gaitaware:history";

type HistoryItem = {
  id: number;
  name: string;
  gaitType: string;
  jointDeviations?: string;
  images?: string[]; // URIs (SEI image file path)
  createdAt: string;
  pdfPath?: string; // local saved PDF path (file://...)
  gender?: string;
  age?: string;
  height?: string;
  weight?: string;
  notes?: string;
  // BiLSTM Pattern Analysis data
  patternAnalysis?: {
    isAbnormal: boolean;
    confidence: number;
    meanError: number;
    maxError: number;
    threshold: number;
  };
  // SEI image as base64 for PDF embedding
  seiImageBase64?: string;
  // CNN detailed scores
  cnnConfidence?: number;
};

export default function Tab() {
    // Share PDF for a specific history item
    async function sharePdfForItem(item: HistoryItem) {
      try {
        // If PDF already saved, use its path
        if (item.pdfPath) {
          const SharingMod = await import("expo-sharing").catch(() => null);
          const Sharing = SharingMod ? SharingMod.default ?? SharingMod : null;
          if (
            Sharing &&
            (await (Sharing.isAvailableAsync?.() ?? Promise.resolve(true)))
          ) {
            await Sharing.shareAsync(item.pdfPath, { mimeType: "application/pdf" });
            return;
          }
        }
        // Otherwise, generate PDF and share
        setSavingPdf(true);
        const pdfBytes = await createPdfBytes(item);
        const FileSystem: any = await loadFileSystem();
        if (!FileSystem) {
          Alert.alert("Missing module", "expo-file-system is required to share files locally. Install and rebuild.");
          setSavingPdf(false);
          return;
        }
        const filename = sanitizeFilename(item.name ?? `GaitAware-${Date.now()}`) + ".pdf";
        const encoding = FileSystem.EncodingType && FileSystem.EncodingType.Base64 ? FileSystem.EncodingType.Base64 : "base64";
        const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
        const path = `${baseDir}${filename}`;
        await FileSystem.writeAsStringAsync(path, pdfBytes, { encoding });
        const SharingMod = await import("expo-sharing").catch(() => null);
        const Sharing = SharingMod ? SharingMod.default ?? SharingMod : null;
        if (
          Sharing &&
          (await (Sharing.isAvailableAsync?.() ?? Promise.resolve(true)))
        ) {
          await Sharing.shareAsync(path, { mimeType: "application/pdf" });
        } else {
          Alert.alert("Share failed", "Sharing is not available on this device.");
        }
        setSavingPdf(false);
      } catch (e) {
        setSavingPdf(false);
        Alert.alert("Share failed", "Could not share PDF. See console for details.");
        console.warn("sharePdfForItem failed", e);
      }
    }
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
      .replace(/\s+/g, " ")
      .replace(/[\/\\?%*:|"<>]/g, "-")
      .replace(/,+/g, ",")
      .replace(/^,|,$/g, "")
      .substring(0, 120);

  const formatFriendlyDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      };
      return date.toLocaleDateString("en-US", options);
    } catch {
      return isoString;
    }
  };

  async function ensureAsyncStorage() {
    if (asyncStorageRef.current) return asyncStorageRef.current;
    try {
      // @ts-ignore
      const mod = await import("@react-native-async-storage/async-storage");
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
      console.warn("loadFromStorage error", e);
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
      console.warn("saveToStorage error", e);
    }
  }

  // Reload data when History tab is focused (fixes missing updates after save)
  useFocusEffect(
    React.useCallback(() => {
      loadFromStorage();
    }, [])
  );

  // prefer legacy expo-file-system API (keeps writeAsStringAsync/readAsStringAsync) then fallback
  async function loadFileSystem() {
    try {
      // @ts-ignore - expo-file-system/legacy type definition issue
      const legacy = await import("expo-file-system/legacy").catch(() => null);
      // @ts-ignore - type definition mismatch
      if (legacy) return legacy.default ?? legacy;
    } catch {}
    try {
      // @ts-ignore
      const fs = await import("expo-file-system").catch(() => null);
      return fs ? fs.default ?? fs : null;
    } catch {
      return null;
    }
  }

  // convert Uint8Array -> base64 (tries base64-js then Buffer)
  async function bytesToBase64(bytes: Uint8Array) {
    try {
      const base64js = await import("base64-js").catch(() => null);
      if (base64js && base64js.fromByteArray)
        return base64js.fromByteArray(bytes);
    } catch {}
    try {
      // @ts-ignore
      return Buffer.from(bytes).toString("base64");
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
      if (uri.startsWith("http://") || uri.startsWith("https://")) {
        const resp = await fetch(uri);
        const buf = await resp.arrayBuffer();
        return new Uint8Array(buf);
      }

      if (FileSystem && FileSystem.readAsStringAsync) {
        try {
          const encoding =
            FileSystem.EncodingType && FileSystem.EncodingType.Base64
              ? FileSystem.EncodingType.Base64
              : "base64";
          const b64 = await FileSystem.readAsStringAsync(uri, { encoding });
          if (b64) {
            try {
              const base64js = await import("base64-js").catch(() => null);
              if (base64js && base64js.toByteArray)
                return base64js.toByteArray(b64);
            } catch {}
            // @ts-ignore
            return Uint8Array.from(Buffer.from(b64, "base64"));
          }
        } catch (fsErr) {
          console.warn(
            "FileSystem.readAsStringAsync failed, falling back to fetch",
            fsErr
          );
        }
      }

      // last resort try fetch (some runtimes support fetch on file://)
      const resp = await fetch(uri);
      const arr = await resp.arrayBuffer();
      return new Uint8Array(arr);
    } catch (e) {
      console.warn("loadImageBytes failed for", uri, e);
      return null;
    }
  }

  // ---------- UI actions ----------
  async function deleteHistory(id: number) {
    Alert.alert("Delete entry", "Delete this history entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const updated = items.filter((i) => i.id !== id);
          setItems(updated);
          await saveToStorage(updated);
        },
      },
    ]);
  }

  // ---------- PDF generation & preview ----------
  // create PDF bytes. heavy work deferred to InteractionManager to avoid blocking UI
  async function createPdfBytes(item: HistoryItem) {
    const [{ PDFDocument, StandardFonts, rgb }, base64js] = await Promise.all([
      import("pdf-lib"),
      import("base64-js").catch(() => null),
    ]);

    const pdfDoc = await (PDFDocument as any).create();
    const font = await (pdfDoc as any).embedFont(StandardFonts.Helvetica);
    // try to load a bold variant; fallback to same font
    let fontBold;
    try {
      // some pdf-lib builds expose Helvetica-Bold as StandardFonts.HelveticaBold
      // if not available this will throw and we fallback to a simulated bold
      // @ts-ignore
      fontBold = await (pdfDoc as any).embedFont(
        (StandardFonts as any).HelveticaBold ?? StandardFonts.Helvetica
      );
    } catch {
      fontBold = font;
    }

    let page = (pdfDoc as any).addPage([612, 1008]); // US Legal (8.5" x 14") - changed from Letter for more vertical space
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    const margin = 48;
    let y = pageHeight - margin;

    const maxContentWidth = pageWidth - margin * 2;

    // helper: draw bold text (uses bold font if available, otherwise draws twice for weight)
    const drawBold = (
      pg: any,
      text: string,
      x: number,
      yy: number,
      size: number
    ) => {
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
        pg.drawLine({
          start: { x: fromX, y: atY },
          end: { x: toX, y: atY },
          thickness: 0.5,
          color: gray,
        });
      } catch {}
    };

    // --- Header logo (centered) ---
    try {
      // @ts-ignore
      const { Asset } = await import("expo-asset");
      const moduleRef = require("../../assets/images/gaitaware_header_text.png");
      await Asset.loadAsync(moduleRef);
      const assetObj = Asset.fromModule(moduleRef);
      const headerUri = assetObj.localUri ?? assetObj.uri;
      if (headerUri) {
        const headerBytes = await loadImageBytes(headerUri);
        if (headerBytes) {
          const isPngHeader =
            headerBytes[0] === 0x89 && headerBytes[1] === 0x50;
          let embeddedHeader: any = null;
          try {
            embeddedHeader = isPngHeader
              ? await (pdfDoc as any).embedPng(headerBytes)
              : await (pdfDoc as any).embedJpg(headerBytes);
          } catch {
            try {
              embeddedHeader = isPngHeader
                ? await (pdfDoc as any).embedJpg(headerBytes)
                : await (pdfDoc as any).embedPng(headerBytes);
            } catch (err) {
              console.warn("header embed failed", err);
            }
          }
          if (embeddedHeader) {
            const hdrW =
              embeddedHeader.width ?? embeddedHeader.size?.width ?? 0;
            const hdrH =
              embeddedHeader.height ?? embeddedHeader.size?.height ?? 0;
            const maxHeaderHeight = 40;
            let scale = 1;
            if (hdrW) scale = Math.min(1, maxContentWidth / hdrW);
            if (hdrH && hdrH * scale > maxHeaderHeight)
              scale = Math.min(scale, maxHeaderHeight / hdrH);
            const drawW = hdrW * scale;
            const drawH = hdrH * scale;
            const drawX = (pageWidth - drawW) / 2;
            const drawY = y - drawH;
            page.drawImage(embeddedHeader, {
              x: drawX,
              y: drawY,
              width: drawW,
              height: drawH,
            });
            y = drawY - 22; // increased gap under header for better separation
          }
        }
      }
    } catch (e) {
      console.warn("Header image embed skipped", e);
    }

    // --- Disclaimer (centered, small) ---
    try {
      const disclaimer =
        "IMPORTANT NOTICE: This analysis is provided for informational and educational purposes only. It is NOT a medical diagnosis and should NOT replace professional medical advice. GaitAware uses artificial intelligence to analyze walking patterns, but we are not medical professionals. Please consult a qualified healthcare provider or physical therapist for proper evaluation and diagnosis. If you have concerns about your walking or mobility, seek professional medical care.";
      const size = 9;
      const maxW = maxContentWidth;
      function wrapText(text: string, f: any, s: number, mw: number) {
        const words = text.split(" ");
        const lines: string[] = [];
        let line = "";
        for (const w of words) {
          const test = line ? line + " " + w : w;
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

      // Draw light background box for disclaimer
      const disclaimerHeight = lines.length * (size + 4) + 12;
      try {
        if (lightGray)
          page.drawRectangle({
            x: margin - 8,
            y: y - disclaimerHeight + 4,
            width: pageWidth - margin * 2 + 16,
            height: disclaimerHeight,
            color: lightGray,
            opacity: 0.3,
          });
      } catch {}

      y -= 6; // padding top
      for (const ln of lines) {
        const textWidth = font.widthOfTextAtSize(ln, size);
        const x = (pageWidth - textWidth) / 2;
        page.drawText(ln, { x, y, size, font, color: gray });
        y -= size + 4;
      }
      // larger gap between disclaimer and User Information as requested
      y -= 28;
    } catch (e) {
      console.warn("Failed to draw disclaimer", e);
    }

    // Check if we need a new page before User Information
    if (y < 180) {
      const newPage = (pdfDoc as any).addPage([pageWidth, pageHeight]);
      page = newPage; // Update page reference
      y = pageHeight - margin;
    }

    // --- Analysis Date/Time (right-aligned, above User Information) ---
    try {
      const dateObj = new Date(item.createdAt);
      const dateStr = dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const timeStr = dateObj.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const dateTimeText = `Analysis Date: ${dateStr} at ${timeStr}`;
      const dateSize = 10;
      const dateWidth = font.widthOfTextAtSize(dateTimeText, dateSize);
      const dateX = pageWidth - margin - dateWidth;
      page.drawText(dateTimeText, {
        x: dateX,
        y,
        size: dateSize,
        font,
        color: gray,
      });
      y -= dateSize + 16;
    } catch (e) {
      console.warn("Failed to draw date/time", e);
    }

    // --- User Information section ---
    try {
      // section title (bold)
      const titleSize = 14;
      drawBold(page, "User Information", margin, y, titleSize);
      y -= titleSize + 8;
      drawHr(page, margin, pageWidth - margin, y + 6);
      y -= 10;

      // draw a faint box background for the user info area for a professional look
      const infoBoxHeight = 90;
      try {
        if (lightGray)
          page.drawRectangle({
            x: margin - 4,
            y: y - infoBoxHeight + 8,
            width: pageWidth - margin * 2 + 8,
            height: infoBoxHeight,
            color: lightGray,
            opacity: 0.15,
          });
      } catch {}

      // Single column layout (no image)
      const labelSize = 11;
      const valueSize = 11;
      let cursorY = y - 4;

      drawBold(page, "Name:", margin, cursorY, labelSize);
      page.drawText(` ${item.name ?? "—"}`, {
        x: margin + 44,
        y: cursorY,
        size: valueSize,
        font,
        color: gray,
      });
      cursorY -= labelSize + 6;

      drawBold(page, "Gender:", margin, cursorY, labelSize);
      page.drawText(` ${item.gender ?? "—"}`, {
        x: margin + 56,
        y: cursorY,
        size: valueSize,
        font,
        color: gray,
      });
      cursorY -= labelSize + 6;

      drawBold(page, "Age:", margin, cursorY, labelSize);
      page.drawText(` ${item.age ?? "—"}`, {
        x: margin + 32,
        y: cursorY,
        size: valueSize,
        font,
        color: gray,
      });
      cursorY -= labelSize + 6;

      drawBold(page, "Height:", margin, cursorY, labelSize);
      page.drawText(` ${item.height ? item.height + " cm" : "—"}`, {
        x: margin + 50,
        y: cursorY,
        size: valueSize,
        font,
        color: gray,
      });
      cursorY -= labelSize + 6;

      drawBold(page, "Weight:", margin, cursorY, labelSize);
      page.drawText(` ${item.weight ? item.weight + " kg" : "—"}`, {
        x: margin + 54,
        y: cursorY,
        size: valueSize,
        font,
        color: gray,
      });
      cursorY -= labelSize + 8;

      drawBold(page, "Notes:", margin, cursorY, labelSize);
      cursorY -= labelSize + 4;
      // wrap notes into max content width
      const wrap = (text: string, f: any, s: number, mw: number) => {
        const words = text.split(" ");
        const lines: string[] = [];
        let line = "";
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
      const noteLines = wrap(
        item.notes ?? "—",
        font,
        valueSize,
        maxContentWidth
      );
      for (const ln of noteLines) {
        page.drawText(ln, {
          x: margin,
          y: cursorY,
          size: valueSize,
          font,
          color: gray,
        });
        cursorY -= valueSize + 4;
      }

      // move y below user info section with proper spacing
      y = cursorY - 16; // Use actual cursorY position with extra spacing
    } catch (e) {
      console.warn("User info section failed", e);
    }

    // Check if we need a new page before Summary
    if (y < 400) {
      const newPage = (pdfDoc as any).addPage([pageWidth, pageHeight]);
      page = newPage;
      y = pageHeight - margin;
    }

    // --- Summary Section (Quick Overview) ---
    try {
      const sectionTitleSize = 14;
      drawBold(page, "Summary", margin, y, sectionTitleSize);
      y -= sectionTitleSize + 8;
      drawHr(page, margin, pageWidth - margin, y + 6);
      y -= 14;

      // Determine overall status
      const isAbnormal = item.patternAnalysis?.isAbnormal ?? false;
      const hasAbnormalJoints = item.patternAnalysis?.jointErrors
        ? item.patternAnalysis.jointErrors.filter(
            (j: any) =>
              j.isAbnormal && j.joint !== "LEFT_HIP" && j.joint !== "RIGHT_HIP"
          ).length > 0
        : false;

      const overallStatus =
        isAbnormal || hasAbnormalJoints ? "Attention Needed" : "Normal";

      // Overall Assessment
      drawBold(page, "Overall Assessment:", margin, y, 11);
      page.drawText(overallStatus, {
        x: margin + 140,
        y,
        size: 11,
        font: fontBold,
        color: rgb(0, 0, 0), // Black color
      });
      y -= 18;

      // Walking Type
      const walkingType = item.gaitType?.split("(")[0].trim() ?? "—";
      drawBold(page, "Walking Type:", margin, y, 11);
      page.drawText(walkingType, {
        x: margin + 95,
        y,
        size: 11,
        font,
        color: rgb(0, 0, 0), // Black color
      });
      y -= 16;

      // Movement Pattern
      const movementPattern = item.patternAnalysis?.isAbnormal
        ? "Irregular pattern detected"
        : "Normal pattern";
      drawBold(page, "Movement Pattern:", margin, y, 11);
      page.drawText(movementPattern, {
        x: margin + 130,
        y,
        size: 11,
        font,
        color: rgb(0, 0, 0), // Black color
      });
      y -= 24;
    } catch (e) {
      console.warn("Summary section failed", e);
    }

    // --- Joint Movement Analysis (Detailed Findings) ---
    try {
      const sectionTitleSize = 14;
      drawBold(page, "Joint Movement Details", margin, y, sectionTitleSize);
      y -= sectionTitleSize + 8;
      drawHr(page, margin, pageWidth - margin, y + 6);
      y -= 10;

      // Add explanation about percentages
      page.drawText("(Values at 100% indicate irregular movement)", {
        x: margin,
        y,
        size: 9,
        font,
        color: gray,
      });
      y -= 18;

      // Display joint data if available
      if (item.patternAnalysis?.jointErrors) {
        const joints = item.patternAnalysis.jointErrors.filter(
          (j: any) => j.joint !== "LEFT_HIP" && j.joint !== "RIGHT_HIP"
        );

        if (joints.length > 0) {
          const abnormalCount = joints.filter((j: any) => j.isAbnormal).length;

          // Summary line
          const summaryText =
            abnormalCount > 0
              ? `${abnormalCount} out of ${joints.length} joints need attention`
              : `All ${joints.length} joints moving normally`;
          page.drawText("   " + summaryText, {
            x: margin + 4,
            y,
            size: 10,
            font: fontBold,
            color:
              abnormalCount > 0 ? rgb(0.93, 0.42, 0) : rgb(0.18, 0.49, 0.2),
          });
          y -= 16;

          // List each joint
          for (const joint of joints) {
            const percentage = Math.min(
              100,
              (joint.error / joint.threshold) * 100
            ).toFixed(0);
            const jointName = joint.joint.replace(/_/g, " ");
            const status = joint.isAbnormal ? "Needs attention" : "Normal";
            const statusColor = joint.isAbnormal
              ? rgb(0.93, 0.42, 0)
              : rgb(0.18, 0.49, 0.2);

            // Joint name and percentage
            page.drawText(`   • ${jointName}:`, {
              x: margin + 8,
              y,
              size: 10,
              font,
              color: gray,
            });
            page.drawText(`${percentage}%`, {
              x: margin + 180,
              y,
              size: 10,
              font: fontBold,
              color: statusColor,
            });
            page.drawText(`[${status}]`, {
              x: margin + 230,
              y,
              size: 9,
              font,
              color: statusColor,
            });
            y -= 14;

            // Check if we need a new page for joint list
            if (y < margin + 100) {
              const newPage = (pdfDoc as any).addPage([pageWidth, pageHeight]);
              page = newPage; // Update page reference
              y = pageHeight - margin;
            }
          }
        } else {
          page.drawText("   • No joint data available", {
            x: margin + 8,
            y,
            size: 10,
            font,
            color: gray,
          });
          y -= 16;
        }
      } else {
        // Fallback to old jointDeviations text if no structured data
        const abnormalitiesText = item.jointDeviations
          ? item.jointDeviations
          : "None detected";
        page.drawText(`   • ${abnormalitiesText}`, {
          x: margin + 8,
          y,
          size: 10,
          font,
          color: gray,
        });
        y -= 16;
      }

      // Add space before SEI image
      y -= 10;
    } catch (e) {
      console.warn("Analysis section failed", e);
    }

    // --- Gait Pattern Visualization (SEI Image) ---
    if (item.seiImageBase64) {
      try {
        // Check if we need a new page
        if (y < 280) {
          const newPage = (pdfDoc as any).addPage([pageWidth, pageHeight]);
          page = newPage; // Update page reference
          y = pageHeight - margin;
        }

        drawBold(page, "Gait Pattern Visualization", margin, y, 14);
        y -= 20;

        // Convert base64 to bytes
        const base64Data = item.seiImageBase64.includes(",")
          ? item.seiImageBase64.split(",")[1]
          : item.seiImageBase64;

        let imgBytes: Uint8Array | null = null;
        try {
          const base64js = await import("base64-js").catch(() => null);
          if (base64js && base64js.toByteArray) {
            imgBytes = base64js.toByteArray(base64Data);
          }
        } catch {}

        if (!imgBytes) {
          try {
            // @ts-ignore
            imgBytes = Uint8Array.from(Buffer.from(base64Data, "base64"));
          } catch {}
        }

        if (imgBytes) {
          // Embed the SEI image (try PNG first, then JPG)
          let seiImage: any = null;
          try {
            seiImage = await (pdfDoc as any).embedJpg(imgBytes);
          } catch {
            try {
              seiImage = await (pdfDoc as any).embedPng(imgBytes);
            } catch (e) {
              console.warn("SEI image embed failed", e);
            }
          }

          if (seiImage) {
            const imgWidth = seiImage.width ?? seiImage.size?.width ?? 224;
            const imgHeight = seiImage.height ?? seiImage.size?.height ?? 224;

            // Scale to fit in PDF (max 200x200)
            const maxSize = 200;
            let scale = 1;
            if (imgWidth > maxSize || imgHeight > maxSize) {
              scale = Math.min(maxSize / imgWidth, maxSize / imgHeight);
            }

            const drawW = imgWidth * scale;
            const drawH = imgHeight * scale;
            const drawX = (pageWidth - drawW) / 2; // Center the image
            const drawY = y - drawH;

            page.drawImage(seiImage, {
              x: drawX,
              y: drawY,
              width: drawW,
              height: drawH,
            });

            y = drawY - 10;

            // Add description
            const desc = "Visual representation of your walking pattern";
            const descWidth = font.widthOfTextAtSize(desc, 10);
            const descX = (pageWidth - descWidth) / 2;
            page.drawText(desc, {
              x: descX,
              y,
              size: 10,
              font,
              color: gray,
            });
            y -= 20;
          }
        }
      } catch (e) {
        console.warn("SEI image section failed", e);
      }
    }

    // final save
    const pdfBytes: Uint8Array = await (pdfDoc as any).save();
    // convert to base64
    try {
      if (base64js && base64js.fromByteArray)
        return base64js.fromByteArray(pdfBytes);
    } catch {}
    try {
      // @ts-ignore
      return Buffer.from(pdfBytes).toString("base64");
    } catch (err) {
      throw new Error("Base64 conversion failed");
    }
  }

  async function generateAndPreview(item: HistoryItem) {
    setGeneratingId(item.id);
    try {
      const b64 = await createPdfBytes(item);
      // set friendly filename: "Name, GaitAware Analysis Report, test"
      const safeName = sanitizeFilename(item.name || "Unknown");
      previewFilenameRef.current = `${safeName}, GaitAware Analysis Report`;
      setPreviewDataUri(`data:application/pdf;base64,${b64}`);
      setPreviewVisible(true);
    } catch (err) {
      console.warn("generate PDF error", err);
      Alert.alert("Error", "Could not generate PDF.");
    } finally {
      setGeneratingId(null);
    }
  }

  // ---------- saving ----------
  async function savePreviewPdfLocally() {
    if (!previewDataUri) {
      Alert.alert("No PDF", "No PDF is available to save.");
      return;
    }
    setSavingPdf(true);
    try {
      const b64 = previewDataUri.startsWith("data:")
        ? previewDataUri.split(",")[1]
        : previewDataUri;
      const FileSystem: any = await loadFileSystem();
      if (!FileSystem) {
        Alert.alert(
          "Missing module",
          "expo-file-system is required to save files locally. Install and rebuild."
        );
        return;
      }

      const filename =
        sanitizeFilename(
          previewFilenameRef.current ?? `GaitAware-${Date.now()}`
        ) + ".pdf";
      const encoding =
        FileSystem.EncodingType && FileSystem.EncodingType.Base64
          ? FileSystem.EncodingType.Base64
          : "base64";

      // Android: use SAF + user-selected folder (choose Downloads)
      if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
        try {
          // @ts-ignore
          const res =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          const directoryUri = res.directoryUri ?? res;
          if (!directoryUri) {
            Alert.alert(
              "Cancelled",
              "Folder selection was cancelled. PDF not saved."
            );
            return;
          }
          // @ts-ignore
          const fileUri =
            await FileSystem.StorageAccessFramework.createFileAsync(
              directoryUri,
              filename,
              "application/pdf"
            );
          if (fileUri) {
            await FileSystem.writeAsStringAsync(fileUri, b64, { encoding });
            Alert.alert(
              "Saved",
              "PDF saved to selected folder. Check your Downloads if you picked it."
            );
            return;
          }
        } catch (safErr) {
          console.warn("SAF save failed", safErr);
        }
      }

      // Fallback: write to app documents/cache and offer system share/save sheet
      const baseDir =
        FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
      const path = `${baseDir}${filename}`;
      await FileSystem.writeAsStringAsync(path, b64, { encoding });

      try {
        // @ts-ignore
        const SharingMod = await import("expo-sharing").catch(() => null);
        const Sharing = SharingMod ? SharingMod.default ?? SharingMod : null;
        if (
          Sharing &&
          (await (Sharing.isAvailableAsync?.() ?? Promise.resolve(true)))
        ) {
          await Sharing.shareAsync(path, { mimeType: "application/pdf" });
          return;
        }
      } catch (shareErr) {
        console.warn("sharing failed", shareErr);
      }

      Alert.alert(
        "Saved",
        `PDF saved to app folder:\n${path}\nUse Files app to move it to Downloads.`
      );
    } catch (e) {
      console.warn("savePreviewPdfLocally failed", e);
      Alert.alert(
        "Save failed",
        "Could not save PDF locally. See console for details."
      );
    } finally {
      setSavingPdf(false);
    }
  }

  // ---------- rendering helpers ----------
  function renderPdfPreview() {
    if (!previewDataUri) {
      return (
        <View style={styles.previewFallback}>
          <Text style={styles.previewFallbackText}>
            No PDF available to preview.
          </Text>
        </View>
      );
    }
    const b64 = previewDataUri.startsWith("data:")
      ? previewDataUri.split(",")[1]
      : previewDataUri;
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
      const WebView =
        require("react-native-webview").WebView ??
        require("react-native-webview").default;
      return (
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          style={{ flex: 1 }}
        />
      );
    } catch (e) {
      return (
        <View style={styles.previewFallback}>
          <Text style={styles.previewFallbackText}>
            react-native-webview not available. Install and rebuild the app to
            preview PDFs inside the app.
          </Text>
          <TouchableOpacity
            style={styles.openExternBtn}
            onPress={() => {
              Linking.openURL(previewDataUri!).catch(() => {
                Alert.alert(
                  "Open failed",
                  "Cannot open PDF externally from this environment."
                );
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
    const dateLabel = formatFriendlyDate(item.createdAt);
    const displayName = item.name || `Analysis - ${dateLabel.split(",")[0]}`;

    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.gaitType}>{item.gaitType}</Text>
          {(item.gender || item.age) && (
            <Text style={styles.metadata}>
              {item.gender}
              {item.gender && item.age ? ", " : ""}
              {item.age ? `${item.age} years` : ""}
            </Text>
          )}
          {item.notes && <Text style={styles.note}>{item.notes}</Text>}
          <Text style={styles.date}>{dateLabel}</Text>
        </View>

        <View style={styles.rowRight}>
          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={() => generateAndPreview(item)}
            disabled={generatingId === item.id}
          >
            {generatingId === item.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.pdfBtnText}>View PDF</Text>
            )}
          </TouchableOpacity>

            {/* Share Button below View PDF */}
            <TouchableOpacity
              style={styles.pdfBtn}
              onPress={() => sharePdfForItem(item)}
              disabled={savingPdf}
            >
              {savingPdf ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.pdfBtnText}>Share PDF</Text>
              )}
            </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => deleteHistory(item.id)}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- main render ----------
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      {/* Analysis History header */}
      <Text style={styles.analysisHeader}>Saved Reports</Text>

      {/* rest of screen (history list, modal, etc.) */}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading
              ? "Loading..."
              : "No saved reports yet.\nAnalyze a video from the Record tab to get started."}
          </Text>
        }
      />

      <Modal
        visible={previewVisible}
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewHeader}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              onPress={() => setPreviewVisible(false)}
              style={styles.previewClose}
            >
              <Text style={styles.previewCloseText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={savePreviewPdfLocally}
              style={[styles.previewClose, { marginRight: 8 }]}
              disabled={savingPdf}
            >
              {savingPdf ? (
                <ActivityIndicator />
              ) : (
                <Text style={{ color: "#0b62d6", fontWeight: "600" }}>
                  Download PDF
                </Text>
              )}
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

  list: { paddingHorizontal: 12, paddingBottom: 48 },
  row: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderColor: "#ddd",
    borderRadius: 10,
    marginBottom: 12,
    marginHorizontal: 8,
    borderWidth: 1,
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  rowLeft: { flex: 1 },
  rowRight: { justifyContent: "center", alignItems: "flex-end" },
  name: { fontSize: 18, fontWeight: "700", color: "#222" },
  gaitType: { fontSize: 16, color: "#555", marginTop: 4 },
  metadata: { fontSize: 14, color: "#777", marginTop: 3 },
  note: { fontSize: 14, color: "#666", marginTop: 4, fontStyle: "italic" },
  date: { fontSize: 13, color: "#999", marginTop: 6 },

  pdfBtn: {
    backgroundColor: "#0b62d6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
    width: 120,
    alignItems: "center",
  },
  pdfBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  deleteBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  deleteText: { color: "#d00", fontWeight: "600", fontSize: 14 },

  empty: {
    textAlign: "center",
    color: "#999",
    marginTop: 48,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 32,
  },
  previewHeader: {
    height: 56,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  previewClose: { padding: 8 },
  previewCloseText: { color: "#0b62d6", fontWeight: "600" },
  previewBody: { flex: 1, backgroundColor: "#fff" },
  previewFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  previewFallbackText: { color: "#333", textAlign: "center", marginBottom: 16 },
  openExternBtn: {
    backgroundColor: "#0b62d6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  openExternText: { color: "#fff", fontWeight: "600" },

  analysisHeader: {
    fontSize: 26,
    fontWeight: "700",
    color: "#222",
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
});

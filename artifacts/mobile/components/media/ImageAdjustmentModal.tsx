import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";

export type ImageCropAspect = "original" | "square" | "portrait" | "landscape";

type Props = {
  visible: boolean;
  asset: ImagePickerAsset | null;
  title?: string;
  defaultAspect?: ImageCropAspect;
  onCancel: () => void;
  onDone: (asset: ImagePickerAsset) => void;
};

type Point = { x: number; y: number };
const ASPECTS: { value: ImageCropAspect; label: string; ratio?: number }[] = [
  { value: "original", label: "Original" },
  { value: "square", label: "1:1", ratio: 1 },
  { value: "portrait", label: "4:5", ratio: 4 / 5 },
  { value: "landscape", label: "16:9", ratio: 16 / 9 },
];

function clampPan(value: Point, imageWidth: number, imageHeight: number, cropWidth: number, cropHeight: number): Point {
  const maxX = Math.max(0, (imageWidth - cropWidth) / 2);
  const maxY = Math.max(0, (imageHeight - cropHeight) / 2);
  return { x: Math.max(-maxX, Math.min(maxX, value.x)), y: Math.max(-maxY, Math.min(maxY, value.y)) };
}

export default function ImageAdjustmentModal({
  visible,
  asset,
  title = "Adjust photo",
  defaultAspect = "original",
  onCancel,
  onDone,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [sourceSize, setSourceSize] = useState<Point>({ x: 0, y: 0 });
  const [aspect, setAspect] = useState<ImageCropAspect>(defaultAspect);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const panRef = useRef(pan);
  const panStart = useRef<Point>({ x: 0, y: 0 });
  const metricsRef = useRef({ imageWidth: 0, imageHeight: 0, cropWidth: 0, cropHeight: 0 });

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    if (!visible || !asset?.uri) return;
    let active = true;
    setSourceSize({ x: asset.width || 0, y: asset.height || 0 });
    setAspect(defaultAspect);
    setRotation(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSaving(false);
    setError("");
    Image.getSize(asset.uri, (imageWidth, imageHeight) => {
      if (active) setSourceSize({ x: imageWidth, y: imageHeight });
    }, () => {
      if (active && asset.width && asset.height) setSourceSize({ x: asset.width, y: asset.height });
    });
    return () => { active = false; };
  }, [asset?.uri, asset?.width, asset?.height, defaultAspect, visible]);

  const sourceWidth = sourceSize.x;
  const sourceHeight = sourceSize.y;
  const swapsDimensions = Math.abs(rotation % 180) === 90;
  const orientedWidth = swapsDimensions ? sourceHeight : sourceWidth;
  const orientedHeight = swapsDimensions ? sourceWidth : sourceHeight;
  const selectedAspect = ASPECTS.find((item) => item.value === aspect);
  const ratio = selectedAspect?.ratio ?? (orientedWidth && orientedHeight ? orientedWidth / orientedHeight : 1);
  const previewSide = Math.max(220, Math.min(windowWidth - 44, 360));
  const cropWidth = ratio >= 1 ? previewSide : previewSide * ratio;
  const cropHeight = ratio >= 1 ? previewSide / ratio : previewSide;
  const fitScale = sourceWidth && sourceHeight
    ? Math.max(cropWidth / orientedWidth, cropHeight / orientedHeight)
    : 1;
  const displayWidth = orientedWidth * fitScale * zoom;
  const displayHeight = orientedHeight * fitScale * zoom;
  const rawDisplayWidth = sourceWidth * fitScale * zoom;
  const rawDisplayHeight = sourceHeight * fitScale * zoom;
  metricsRef.current = { imageWidth: displayWidth, imageHeight: displayHeight, cropWidth, cropHeight };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { panStart.current = panRef.current; },
    onPanResponderMove: (_event, gesture) => {
      const metrics = metricsRef.current;
      setPan(clampPan(
        { x: panStart.current.x + gesture.dx, y: panStart.current.y + gesture.dy },
        metrics.imageWidth,
        metrics.imageHeight,
        metrics.cropWidth,
        metrics.cropHeight,
      ));
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: () => { panStart.current = panRef.current; },
  }), []);

  const rotate = (degrees: number) => {
    setRotation((current) => (current + degrees + 360) % 360);
    setPan({ x: 0, y: 0 });
  };

  const changeZoom = (delta: number) => {
    const nextZoom = Math.max(1, Math.min(3, Math.round((zoom + delta) * 100) / 100));
    setZoom(nextZoom);
    setPan((current) => clampPan(current, orientedWidth * fitScale * nextZoom, orientedHeight * fitScale * nextZoom, cropWidth, cropHeight));
  };

  const saveAdjustedPhoto = async () => {
    if (!asset || !sourceWidth || !sourceHeight || saving) return;
    setSaving(true);
    try {
      const scale = fitScale * zoom;
      const imageLeft = (cropWidth - displayWidth) / 2 + pan.x;
      const imageTop = (cropHeight - displayHeight) / 2 + pan.y;
      const originX = Math.max(0, Math.floor(-imageLeft / scale));
      const originY = Math.max(0, Math.floor(-imageTop / scale));
      const width = Math.max(1, Math.min(Math.round(cropWidth / scale), orientedWidth - originX));
      const height = Math.max(1, Math.min(Math.round(cropHeight / scale), orientedHeight - originY));
      const actions: ImageManipulator.Action[] = [];
      if (rotation) actions.push({ rotate: rotation });
      actions.push({ crop: { originX, originY, width, height } });
      const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: 0.88,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      const fileName = (asset.fileName || "photo").replace(/\.[^.]+$/, "") + ".jpg";
      onDone({
        ...asset,
        uri: result.uri,
        width: result.width,
        height: result.height,
        base64: result.base64 ?? undefined,
        fileName,
        mimeType: "image/jpeg",
        fileSize: undefined,
      });
    } catch {
      setSaving(false);
      setError("Could not adjust this photo. Try another image.");
    }
  };

  const displayedImageStyle = {
    position: "absolute" as const,
    width: rawDisplayWidth,
    height: rawDisplayHeight,
    left: (cropWidth - displayWidth) / 2 + pan.x + (displayWidth - rawDisplayWidth) / 2,
    top: (cropHeight - displayHeight) / 2 + pan.y + (displayHeight - rawDisplayHeight) / 2,
    transform: [{ rotate: `${rotation}deg` }],
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"} onRequestClose={onCancel}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} disabled={saving} style={styles.headerButton} accessibilityLabel="Cancel photo adjustment">
            <Ionicons name="close" size={23} color="#172033" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={() => void saveAdjustedPhoto()} disabled={saving || !sourceWidth} style={[styles.doneButton, (saving || !sourceWidth) && styles.disabled]}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.doneText}>Use photo</Text>}
          </TouchableOpacity>
        </View>
        <View style={styles.previewArea}>
          {asset && sourceWidth > 0 ? (
            <View style={[styles.cropWindow, { width: cropWidth, height: cropHeight }]} {...panResponder.panHandlers}>
              <Image source={{ uri: asset.uri }} style={displayedImageStyle} resizeMode="stretch" />
              <View pointerEvents="none" style={styles.cropBorder} />
              <View pointerEvents="none" style={styles.gridVerticalOne} />
              <View pointerEvents="none" style={styles.gridVerticalTwo} />
              <View pointerEvents="none" style={styles.gridHorizontalOne} />
              <View pointerEvents="none" style={styles.gridHorizontalTwo} />
            </View>
          ) : <ActivityIndicator size="large" color="#3D5AF1" />}
          <Text style={styles.dragHint}>Drag the photo to adjust the crop</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.controls}>
          <Text style={styles.controlLabel}>Crop shape</Text>
          <View style={styles.aspectRow}>
            {ASPECTS.map((option) => (
              <TouchableOpacity key={option.value} onPress={() => { setAspect(option.value); setPan({ x: 0, y: 0 }); }} style={[styles.aspectButton, aspect === option.value && styles.aspectActive]}>
                <Text style={[styles.aspectText, aspect === option.value && styles.aspectTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.toolRow}>
            <TouchableOpacity style={styles.toolButton} onPress={() => rotate(-90)} accessibilityLabel="Rotate left">
              <Ionicons name="arrow-undo-outline" size={21} color="#344054" /><Text style={styles.toolText}>Rotate left</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={() => rotate(90)} accessibilityLabel="Rotate right">
              <Ionicons name="arrow-redo-outline" size={21} color="#344054" /><Text style={styles.toolText}>Rotate right</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={() => changeZoom(-0.2)} accessibilityLabel="Zoom out">
              <Ionicons name="remove-circle-outline" size={21} color="#344054" /><Text style={styles.toolText}>Zoom out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={() => changeZoom(0.2)} accessibilityLabel="Zoom in">
              <Ionicons name="add-circle-outline" size={21} color="#344054" /><Text style={styles.toolText}>Zoom in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8FC" },
  header: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E7EAF2" },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F1F3F8", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", color: "#172033", fontSize: 16, fontFamily: "Inter_700Bold" },
  doneButton: { minWidth: 82, minHeight: 38, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  doneText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  disabled: { opacity: 0.5 },
  previewArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  cropWindow: { position: "relative", overflow: "hidden", backgroundColor: "#111827", borderRadius: 3 },
  cropBorder: { ...StyleSheet.absoluteFillObject, borderColor: "#fff", borderWidth: 1.5 },
  gridVerticalOne: { position: "absolute", left: "33.333%", top: 0, bottom: 0, borderLeftWidth: 1, borderColor: "rgba(255,255,255,0.46)" },
  gridVerticalTwo: { position: "absolute", left: "66.666%", top: 0, bottom: 0, borderLeftWidth: 1, borderColor: "rgba(255,255,255,0.46)" },
  gridHorizontalOne: { position: "absolute", top: "33.333%", left: 0, right: 0, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.46)" },
  gridHorizontalTwo: { position: "absolute", top: "66.666%", left: 0, right: 0, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.46)" },
  dragHint: { color: "#667085", marginTop: 13, fontSize: 12, fontFamily: "Inter_500Medium" },
  error: { color: "#B42318", textAlign: "center", fontSize: 12, fontFamily: "Inter_500Medium", paddingHorizontal: 16, paddingBottom: 8 },
  controls: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: Platform.OS === "ios" ? 28 : 20, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E7EAF2" },
  controlLabel: { color: "#667085", fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  aspectRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  aspectButton: { flex: 1, height: 38, borderRadius: 11, backgroundColor: "#F2F4F7", alignItems: "center", justifyContent: "center" },
  aspectActive: { backgroundColor: "#EAF0FF", borderWidth: 1, borderColor: "#AAB9F5" },
  aspectText: { color: "#667085", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  aspectTextActive: { color: "#355BE5" },
  toolRow: { flexDirection: "row", justifyContent: "space-between", gap: 5 },
  toolButton: { flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: "#F8F9FC", borderRadius: 10 },
  toolText: { color: "#475467", fontSize: 9, fontFamily: "Inter_600SemiBold" },
});

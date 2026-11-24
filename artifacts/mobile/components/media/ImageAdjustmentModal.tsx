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

export type ImageCropAspect = "original" | "square" | "portrait" | "landscape" | "free";

type Props = {
  visible: boolean;
  asset: ImagePickerAsset | null;
  title?: string;
  defaultAspect?: ImageCropAspect;
  onCancel: () => void;
  onDone: (asset: ImagePickerAsset) => void;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HandleType =
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "move"
  | null;

const ASPECTS: { value: ImageCropAspect; label: string; ratio?: number }[] = [
  { value: "original", label: "Original" },
  { value: "square", label: "1:1", ratio: 1 },
  { value: "portrait", label: "4:5", ratio: 4 / 5 },
  { value: "landscape", label: "16:9", ratio: 16 / 9 },
  { value: "free", label: "Free" },
];

const MIN_CROP_DIM = 44;
const HANDLE_HIT_RADIUS = 30;

function computeInitialCrop(
  imgBounds: Rect,
  aspect: ImageCropAspect,
  naturalRatio: number
): Rect {
  if (imgBounds.width <= 0 || imgBounds.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let targetRatio: number | undefined;
  if (aspect === "square") {
    targetRatio = 1;
  } else if (aspect === "portrait") {
    targetRatio = 4 / 5;
  } else if (aspect === "landscape") {
    targetRatio = 16 / 9;
  } else if (aspect === "original") {
    targetRatio = naturalRatio > 0 ? naturalRatio : imgBounds.width / imgBounds.height;
  }

  if (!targetRatio) {
    return {
      x: imgBounds.x,
      y: imgBounds.y,
      width: imgBounds.width,
      height: imgBounds.height,
    };
  }

  const containerRatio = imgBounds.width / imgBounds.height;
  let cropW: number;
  let cropH: number;

  if (targetRatio > containerRatio) {
    cropW = imgBounds.width;
    cropH = Math.min(imgBounds.height, cropW / targetRatio);
  } else {
    cropH = imgBounds.height;
    cropW = Math.min(imgBounds.width, cropH * targetRatio);
  }

  const cropX = imgBounds.x + (imgBounds.width - cropW) / 2;
  const cropY = imgBounds.y + (imgBounds.height - cropH) / 2;

  return {
    x: Math.round(cropX),
    y: Math.round(cropY),
    width: Math.round(cropW),
    height: Math.round(cropH),
  };
}

export default function ImageAdjustmentModal({
  visible,
  asset,
  title = "Adjust photo",
  defaultAspect = "original",
  onCancel,
  onDone,
}: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [aspect, setAspect] = useState<ImageCropAspect>(defaultAspect);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [cropRect, setCropRect] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cropRectRef = useRef(cropRect);
  cropRectRef.current = cropRect;

  const startCropRef = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const activeHandleRef = useRef<HandleType>(null);
  const imgBoundsRef = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    if (!visible || !asset?.uri) return;
    let active = true;
    setAspect(defaultAspect);
    setRotation(0);
    setZoom(1);
    setSaving(false);
    setError("");

    const initialW = asset.width || 0;
    const initialH = asset.height || 0;
    setSourceSize({ width: initialW, height: initialH });

    Image.getSize(
      asset.uri,
      (w, h) => {
        if (active) setSourceSize({ width: w, height: h });
      },
      () => {
        if (active && initialW && initialH) {
          setSourceSize({ width: initialW, height: initialH });
        }
      }
    );

    return () => {
      active = false;
    };
  }, [asset?.uri, asset?.width, asset?.height, defaultAspect, visible]);

  const previewWidth = Math.min(windowWidth - 32, 420);
  const previewHeight = Math.max(260, Math.min(windowHeight * 0.44, 380));

  const swapsDimensions = Math.abs(rotation % 180) === 90;
  const orientedWidth = swapsDimensions ? sourceSize.height : sourceSize.width;
  const orientedHeight = swapsDimensions ? sourceSize.width : sourceSize.height;
  const naturalRatio = orientedHeight > 0 ? orientedWidth / orientedHeight : 1;

  const baseScale =
    orientedWidth > 0 && orientedHeight > 0
      ? Math.min(previewWidth / orientedWidth, previewHeight / orientedHeight)
      : 1;

  const displayWidth = Math.round(orientedWidth * baseScale * zoom);
  const displayHeight = Math.round(orientedHeight * baseScale * zoom);

  const imgLeft = Math.round((previewWidth - displayWidth) / 2);
  const imgTop = Math.round((previewHeight - displayHeight) / 2);

  const imgBounds: Rect = useMemo(
    () => ({
      x: imgLeft,
      y: imgTop,
      width: displayWidth,
      height: displayHeight,
    }),
    [imgLeft, imgTop, displayWidth, displayHeight]
  );
  imgBoundsRef.current = imgBounds;

  useEffect(() => {
    if (imgBounds.width > 0 && imgBounds.height > 0) {
      const initial = computeInitialCrop(imgBounds, aspect, naturalRatio);
      setCropRect(initial);
    }
  }, [imgBounds, aspect, rotation]);

  const selectAspect = (newAspect: ImageCropAspect) => {
    setAspect(newAspect);
    const updated = computeInitialCrop(imgBoundsRef.current, newAspect, naturalRatio);
    setCropRect(updated);
  };

  const rotate = (delta: number) => {
    setRotation((current) => (current + delta + 360) % 360);
  };

  const changeZoom = (delta: number) => {
    setZoom((curr) => {
      const next = Math.max(1, Math.min(2.5, Math.round((curr + delta) * 100) / 100));
      return next;
    });
  };

  const resetAll = () => {
    setRotation(0);
    setZoom(1);
    setAspect(defaultAspect);
    const initial = computeInitialCrop(imgBoundsRef.current, defaultAspect, naturalRatio);
    setCropRect(initial);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const current = cropRectRef.current;
          const left = current.x;
          const top = current.y;
          const right = current.x + current.width;
          const bottom = current.y + current.height;

          startCropRef.current = { ...current };

          const dist = (x1: number, y1: number, x2: number, y2: number) =>
            Math.hypot(x1 - x2, y1 - y2);

          const dTL = dist(locationX, locationY, left, top);
          const dTR = dist(locationX, locationY, right, top);
          const dBL = dist(locationX, locationY, left, bottom);
          const dBR = dist(locationX, locationY, right, bottom);

          if (dTL <= HANDLE_HIT_RADIUS) {
            activeHandleRef.current = "tl";
            return;
          }
          if (dTR <= HANDLE_HIT_RADIUS) {
            activeHandleRef.current = "tr";
            return;
          }
          if (dBL <= HANDLE_HIT_RADIUS) {
            activeHandleRef.current = "bl";
            return;
          }
          if (dBR <= HANDLE_HIT_RADIUS) {
            activeHandleRef.current = "br";
            return;
          }

          if (
            Math.abs(locationY - top) <= HANDLE_HIT_RADIUS &&
            locationX >= left - 12 &&
            locationX <= right + 12
          ) {
            activeHandleRef.current = "top";
            return;
          }
          if (
            Math.abs(locationY - bottom) <= HANDLE_HIT_RADIUS &&
            locationX >= left - 12 &&
            locationX <= right + 12
          ) {
            activeHandleRef.current = "bottom";
            return;
          }
          if (
            Math.abs(locationX - left) <= HANDLE_HIT_RADIUS &&
            locationY >= top - 12 &&
            locationY <= bottom + 12
          ) {
            activeHandleRef.current = "left";
            return;
          }
          if (
            Math.abs(locationX - right) <= HANDLE_HIT_RADIUS &&
            locationY >= top - 12 &&
            locationY <= bottom + 12
          ) {
            activeHandleRef.current = "right";
            return;
          }

          if (
            locationX >= left &&
            locationX <= right &&
            locationY >= top &&
            locationY <= bottom
          ) {
            activeHandleRef.current = "move";
            return;
          }

          activeHandleRef.current = null;
        },

        onPanResponderMove: (_evt, gesture) => {
          const handle = activeHandleRef.current;
          if (!handle) return;

          const start = startCropRef.current;
          const bounds = imgBoundsRef.current;
          const dx = gesture.dx;
          const dy = gesture.dy;

          let nextX = start.x;
          let nextY = start.y;
          let nextW = start.width;
          let nextH = start.height;

          const imgRight = bounds.x + bounds.width;
          const imgBottom = bounds.y + bounds.height;

          if (handle === "move") {
            nextX = Math.max(bounds.x, Math.min(imgRight - start.width, start.x + dx));
            nextY = Math.max(bounds.y, Math.min(imgBottom - start.height, start.y + dy));
            setCropRect({ x: nextX, y: nextY, width: start.width, height: start.height });
            return;
          }

          if (handle === "left" || handle === "tl" || handle === "bl") {
            const rawLeft = start.x + dx;
            nextX = Math.max(bounds.x, Math.min(start.x + start.width - MIN_CROP_DIM, rawLeft));
            nextW = start.x + start.width - nextX;
          }

          if (handle === "right" || handle === "tr" || handle === "br") {
            const rawWidth = start.width + dx;
            nextW = Math.max(MIN_CROP_DIM, Math.min(imgRight - start.x, rawWidth));
          }

          if (handle === "top" || handle === "tl" || handle === "tr") {
            const rawTop = start.y + dy;
            nextY = Math.max(bounds.y, Math.min(start.y + start.height - MIN_CROP_DIM, rawTop));
            nextH = start.y + start.height - nextY;
          }

          if (handle === "bottom" || handle === "bl" || handle === "br") {
            const rawHeight = start.height + dy;
            nextH = Math.max(MIN_CROP_DIM, Math.min(imgBottom - start.y, rawHeight));
          }

          const activeAspectConfig = ASPECTS.find((a) => a.value === aspect);
          const ratio = activeAspectConfig?.ratio;

          if (ratio) {
            if (handle === "left" || handle === "right") {
              nextH = Math.round(nextW / ratio);
              if (nextY + nextH > imgBottom) {
                nextH = imgBottom - nextY;
                nextW = Math.round(nextH * ratio);
                if (handle === "left") nextX = start.x + start.width - nextW;
              }
            } else if (handle === "top" || handle === "bottom") {
              nextW = Math.round(nextH * ratio);
              if (nextX + nextW > imgRight) {
                nextW = imgRight - nextX;
                nextH = Math.round(nextW / ratio);
                if (handle === "top") nextY = start.y + start.height - nextH;
              }
            } else if (handle === "br") {
              nextH = Math.round(nextW / ratio);
              if (nextY + nextH > imgBottom) {
                nextH = imgBottom - nextY;
                nextW = Math.round(nextH * ratio);
              }
            } else if (handle === "bl") {
              nextH = Math.round(nextW / ratio);
              if (nextY + nextH > imgBottom) {
                nextH = imgBottom - nextY;
                nextW = Math.round(nextH * ratio);
                nextX = start.x + start.width - nextW;
              }
            } else if (handle === "tr") {
              nextH = Math.round(nextW / ratio);
              nextY = start.y + start.height - nextH;
              if (nextY < bounds.y) {
                nextY = bounds.y;
                nextH = start.y + start.height - nextY;
                nextW = Math.round(nextH * ratio);
              }
            } else if (handle === "tl") {
              nextH = Math.round(nextW / ratio);
              nextY = start.y + start.height - nextH;
              if (nextY < bounds.y) {
                nextY = bounds.y;
                nextH = start.y + start.height - nextY;
                nextW = Math.round(nextH * ratio);
                nextX = start.x + start.width - nextW;
              }
            }
          }

          setCropRect({
            x: Math.round(nextX),
            y: Math.round(nextY),
            width: Math.round(nextW),
            height: Math.round(nextH),
          });
        },

        onPanResponderRelease: () => {
          activeHandleRef.current = null;
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [aspect]
  );

  const saveAdjustedPhoto = async () => {
    if (!asset || !orientedWidth || !orientedHeight || saving) return;
    setSaving(true);
    try {
      const bounds = imgBoundsRef.current;
      const scaleToNatural = orientedWidth / bounds.width;

      const relX = cropRect.x - bounds.x;
      const relY = cropRect.y - bounds.y;
      const relW = cropRect.width;
      const relH = cropRect.height;

      const originX = Math.max(0, Math.min(orientedWidth - 1, Math.round(relX * scaleToNatural)));
      const originY = Math.max(0, Math.min(orientedHeight - 1, Math.round(relY * scaleToNatural)));
      const width = Math.max(1, Math.min(orientedWidth - originX, Math.round(relW * scaleToNatural)));
      const height = Math.max(1, Math.min(orientedHeight - originY, Math.round(relH * scaleToNatural)));

      const actions: ImageManipulator.Action[] = [];
      if (rotation % 360 !== 0) {
        actions.push({ rotate: (rotation % 360 + 360) % 360 });
      }
      actions.push({
        crop: {
          originX,
          originY,
          width,
          height,
        },
      });

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
      setError("Could not crop this photo. Please try again.");
    }
  };

  const rawImageWidth = swapsDimensions ? displayHeight : displayWidth;
  const rawImageHeight = swapsDimensions ? displayWidth : displayHeight;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onCancel}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onCancel}
            disabled={saving}
            style={styles.headerButton}
            accessibilityLabel="Cancel photo adjustment"
          >
            <Ionicons name="close" size={23} color="#172033" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity
            onPress={() => void saveAdjustedPhoto()}
            disabled={saving || !sourceSize.width}
            style={[styles.doneButton, (saving || !sourceSize.width) && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.doneText}>Use photo</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.previewArea}>
          {asset && sourceSize.width > 0 ? (
            <View
              style={[styles.previewContainer, { width: previewWidth, height: previewHeight }]}
              {...panResponder.panHandlers}
            >
              <View
                style={[
                  styles.imageWrapper,
                  {
                    left: imgBounds.x,
                    top: imgBounds.y,
                    width: imgBounds.width,
                    height: imgBounds.height,
                  },
                ]}
              >
                <Image
                  source={{ uri: asset.uri }}
                  style={{
                    width: rawImageWidth,
                    height: rawImageHeight,
                    transform: [{ rotate: `${rotation}deg` }],
                  }}
                  resizeMode="stretch"
                />
              </View>

              <View
                pointerEvents="none"
                style={[
                  styles.maskOverlay,
                  { top: 0, left: 0, right: 0, height: Math.max(0, cropRect.y) },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.maskOverlay,
                  {
                    top: cropRect.y + cropRect.height,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.maskOverlay,
                  {
                    top: cropRect.y,
                    left: 0,
                    width: Math.max(0, cropRect.x),
                    height: cropRect.height,
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.maskOverlay,
                  {
                    top: cropRect.y,
                    left: cropRect.x + cropRect.width,
                    right: 0,
                    height: cropRect.height,
                  },
                ]}
              />

              <View
                pointerEvents="none"
                style={[
                  styles.cropBox,
                  {
                    left: cropRect.x,
                    top: cropRect.y,
                    width: cropRect.width,
                    height: cropRect.height,
                  },
                ]}
              >
                <View style={styles.gridV1} />
                <View style={styles.gridV2} />
                <View style={styles.gridH1} />
                <View style={styles.gridH2} />

                <View style={[styles.cornerTL, styles.cornerHoriz]} />
                <View style={[styles.cornerTL, styles.cornerVert]} />
                <View style={[styles.cornerTR, styles.cornerHoriz]} />
                <View style={[styles.cornerTR, styles.cornerVert]} />
                <View style={[styles.cornerBL, styles.cornerHoriz]} />
                <View style={[styles.cornerBL, styles.cornerVert]} />
                <View style={[styles.cornerBR, styles.cornerHoriz]} />
                <View style={[styles.cornerBR, styles.cornerVert]} />

                <View style={styles.edgeHandleTop} />
                <View style={styles.edgeHandleBottom} />
                <View style={styles.edgeHandleLeft} />
                <View style={styles.edgeHandleRight} />
              </View>
            </View>
          ) : (
            <ActivityIndicator size="large" color="#7C3AED" />
          )}

          <Text style={styles.dragHint}>
            Slide left, right, upper, below edges to crop · Drag center to move
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.controls}>
          <Text style={styles.controlLabel}>Crop shape</Text>
          <View style={styles.aspectRow}>
            {ASPECTS.map((option) => {
              const active = aspect === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => selectAspect(option.value)}
                  style={[styles.aspectButton, active && styles.aspectActive]}
                >
                  <Text style={[styles.aspectText, active && styles.aspectTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.toolRow}>
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => rotate(-90)}
              accessibilityLabel="Rotate left"
            >
              <Ionicons name="arrow-undo-outline" size={20} color="#344054" />
              <Text style={styles.toolText}>Rotate left</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => rotate(90)}
              accessibilityLabel="Rotate right"
            >
              <Ionicons name="arrow-redo-outline" size={20} color="#344054" />
              <Text style={styles.toolText}>Rotate right</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => changeZoom(-0.2)}
              accessibilityLabel="Zoom out"
            >
              <Ionicons name="remove-circle-outline" size={20} color="#344054" />
              <Text style={styles.toolText}>Zoom out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => changeZoom(0.2)}
              accessibilityLabel="Zoom in"
            >
              <Ionicons name="add-circle-outline" size={20} color="#344054" />
              <Text style={styles.toolText}>Zoom in</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolButton}
              onPress={resetAll}
              accessibilityLabel="Reset crop"
            >
              <Ionicons name="refresh-outline" size={20} color="#344054" />
              <Text style={styles.toolText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8FC" },
  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E7EAF2",
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F3F8",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#172033",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 8,
  },
  doneButton: {
    minWidth: 86,
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  disabled: { opacity: 0.5 },
  previewArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  previewContainer: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#0D1117",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  imageWrapper: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  maskOverlay: {
    position: "absolute",
    backgroundColor: "rgba(10, 15, 30, 0.62)",
  },
  cropBox: {
    position: "absolute",
    borderColor: "#FFFFFF",
    borderWidth: 1.5,
  },
  gridV1: {
    position: "absolute",
    left: "33.333%",
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  gridV2: {
    position: "absolute",
    left: "66.666%",
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  gridH1: {
    position: "absolute",
    top: "33.333%",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  gridH2: {
    position: "absolute",
    top: "66.666%",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  cornerHoriz: {
    position: "absolute",
    width: 18,
    height: 3.5,
    backgroundColor: "#FFFFFF",
  },
  cornerVert: {
    position: "absolute",
    width: 3.5,
    height: 18,
    backgroundColor: "#FFFFFF",
  },
  cornerTL: { top: -2, left: -2 },
  cornerTR: { top: -2, right: -2 },
  cornerBL: { bottom: -2, left: -2 },
  cornerBR: { bottom: -2, right: -2 },
  edgeHandleTop: {
    position: "absolute",
    top: -3.5,
    left: "50%",
    marginLeft: -16,
    width: 32,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  edgeHandleBottom: {
    position: "absolute",
    bottom: -3.5,
    left: "50%",
    marginLeft: -16,
    width: 32,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  edgeHandleLeft: {
    position: "absolute",
    left: -3.5,
    top: "50%",
    marginTop: -16,
    width: 7,
    height: 32,
    borderRadius: 3.5,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  edgeHandleRight: {
    position: "absolute",
    right: -3.5,
    top: "50%",
    marginTop: -16,
    width: 7,
    height: 32,
    borderRadius: 3.5,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  dragHint: {
    color: "#667085",
    marginTop: 13,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  error: {
    color: "#B42318",
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  controls: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 28 : 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E7EAF2",
  },
  controlLabel: {
    color: "#667085",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 10,
  },
  aspectRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  aspectButton: {
    flex: 1,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
  },
  aspectActive: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1.5,
    borderColor: "#7C3AED",
  },
  aspectText: { color: "#667085", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  aspectTextActive: { color: "#7C3AED", fontFamily: "Inter_700Bold" },
  toolRow: { flexDirection: "row", justifyContent: "space-between", gap: 5 },
  toolButton: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: "#F8F9FC",
    borderRadius: 10,
  },
  toolText: { color: "#475467", fontSize: 9, fontFamily: "Inter_600SemiBold" },
});

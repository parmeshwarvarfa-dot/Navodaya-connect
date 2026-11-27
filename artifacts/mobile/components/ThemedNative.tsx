import React, { forwardRef } from "react";
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from "react-native";
import { theme } from "@/constants/theme";

function fontFamilyFor(style: TextInputProps["style"] | TextProps["style"]) {
  const flattened = StyleSheet.flatten(style);
  if (flattened?.fontFamily) return flattened.fontFamily;

  const weight = String(flattened?.fontWeight ?? "400");
  if (weight === "bold" || Number(weight) >= 700) return theme.typography.fontFamily.bold;
  if (Number(weight) >= 600) return theme.typography.fontFamily.semibold;
  if (Number(weight) >= 500) return theme.typography.fontFamily.medium;
  return theme.typography.fontFamily.regular;
}

export const ThemedText = forwardRef<NativeText, TextProps>(function ThemedText(
  { style, ...props },
  ref,
) {
  return (
    <NativeText
      ref={ref}
      {...props}
      style={[{ fontFamily: fontFamilyFor(style) }, style]}
    />
  );
});

export const ThemedTextInput = forwardRef<NativeTextInput, TextInputProps>(function ThemedTextInput(
  { style, ...props },
  ref,
) {
  return (
    <NativeTextInput
      ref={ref}
      {...props}
      style={[{ fontFamily: fontFamilyFor(style) }, style]}
    />
  );
});

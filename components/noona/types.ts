import type { StyleProp, ViewStyle } from "react-native";

export type NoonaSize = "sm" | "md" | "lg";
export type NoonaVariant = "icon" | "avatar" | "empty" | "welcome" | "loading";
export type NoonaMood = "happy" | "neutral" | "encouraging";

export type NoonaBrandProps = {
  size?: NoonaSize;
  variant?: NoonaVariant;
  mood?: NoonaMood;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

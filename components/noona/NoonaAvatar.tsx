import { NoonaMascot } from "./NoonaMascot";
import type { NoonaBrandProps } from "./types";

export function NoonaAvatar({ variant = "avatar", accessibilityLabel = "Noona, AI coach", ...props }: NoonaBrandProps) {
  return <NoonaMascot {...props} variant={variant} accessibilityLabel={accessibilityLabel} />;
}

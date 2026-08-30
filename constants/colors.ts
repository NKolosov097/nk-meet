type ColorPalette = Readonly<Record<string, string>>

export const BACKGROUND_COLORS = {
  danger: "#FF3B30",
  secondary: "#333333",
  tertiary: "rgba(0, 0, 0, 0.8)",
  background: "#111111",
  lightBackground: "#1e1e1e",
  black: "#000000",
  primary: "#0062CC",
  dangerAction: "#D72C21",
  disabled: "#4A4A4A",
  participantBadge: "#333333",
  transparent: "transparent",
  elevated: "#4A4A4A",
  overlay: "rgba(0, 0, 0, 0.5)",
} satisfies ColorPalette

export const TEXT_COLORS = {
  light: "#FFFFFF",
  secondary: "#333",
  danger: "#FF3B30",
  placeholder: "#999999",
  disabled: "#BDBDBD",
  onPrimary: "#FFFFFF",
  onDanger: "#FFFFFF",
  placeholderOnLight: "#767676",
  paginationIcon: "#8CC8FF",
  participantStatusDanger: "#FF6B63",
} satisfies ColorPalette

export const BORDER_COLORS = {
  light: "#FFFFFF",
  secondary: "#ddd",
  lightBorder: "#ddd",
  danger: "#f44336",
  divider: "rgba(255, 255, 255, 0.15)",
  controlDivider: "rgba(255, 255, 255, 0.5)",
  selectionIndicator: "#FFFFFF",
  speakingIndicator: "#64D2FF",
} satisfies ColorPalette

export const SHADOW_COLORS = {
  black: "#000000",
} satisfies ColorPalette

export const NATIVE_CONFIG_COLORS = {
  adaptiveIconBackground: "#FFFFFF",
  splashBackground: "#FFFFFF",
} satisfies ColorPalette

type RgbaColor = {
  red: number
  green: number
  blue: number
  alpha: number
}

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
const RGBA_COLOR_PATTERN =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d+(?:\.\d+)?|\.\d+)\s*\)$/
const RGBA_FUNCTION_NAME = "rgba"

// Creates a consistent validation error for unsupported color strings.
const unsupportedColorError = (color: string): Error =>
  new Error(
    `Unsupported color format: ${color}. Use #RRGGBB or ${RGBA_FUNCTION_NAME}(r, g, b, a).`,
  )

// Parses supported hex and rgba strings into numeric color channels.
const parseColor = (color: string): RgbaColor => {
  const hexMatch = color.match(HEX_COLOR_PATTERN)

  if (hexMatch) {
    return {
      red: Number.parseInt(hexMatch[1], 16),
      green: Number.parseInt(hexMatch[2], 16),
      blue: Number.parseInt(hexMatch[3], 16),
      alpha: 1,
    }
  }

  const rgbaMatch = color.match(RGBA_COLOR_PATTERN)

  if (!rgbaMatch) {
    throw unsupportedColorError(color)
  }

  const [red, green, blue, alpha] = rgbaMatch.slice(1).map(Number)

  if (red > 255 || green > 255 || blue > 255 || alpha > 1) {
    throw unsupportedColorError(color)
  }

  return { red, green, blue, alpha }
}

// Converts an RGB channel to a two-character uppercase hex value.
const channelToHex = (channel: number): string =>
  Math.round(channel).toString(16).padStart(2, "0").toUpperCase()

// Rounds a composited color channel to the nearest integer.
const roundedChannel = (channel: number): number => Math.round(channel)

// Limits alpha precision while omitting unnecessary trailing zeroes.
const formattedAlpha = (alpha: number): string =>
  Number(alpha.toFixed(3)).toString()

// Calculates WCAG relative luminance from an RGB color.
const relativeLuminance = ({ red, green, blue }: RgbaColor): number => {
  // Converts a gamma-encoded sRGB channel to its linear-light value.
  const linearize = (channel: number): number => {
    const normalized = channel / 255

    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  return (
    0.2126 * linearize(red) +
    0.7152 * linearize(green) +
    0.0722 * linearize(blue)
  )
}

// Composites a foreground color over a background and returns a CSS color.
export const compositeColor = (
  foreground: string,
  background: string,
): string => {
  const foregroundColor = parseColor(foreground)
  const backgroundColor = parseColor(background)
  const alpha =
    foregroundColor.alpha + backgroundColor.alpha * (1 - foregroundColor.alpha)

  // Blends one foreground channel with its matching background channel.
  const composeChannel = (
    foregroundChannel: number,
    backgroundChannel: number,
  ): number =>
    alpha === 0
      ? 0
      : (foregroundChannel * foregroundColor.alpha +
          backgroundChannel *
            backgroundColor.alpha *
            (1 - foregroundColor.alpha)) /
        alpha

  const red = composeChannel(foregroundColor.red, backgroundColor.red)
  const green = composeChannel(foregroundColor.green, backgroundColor.green)
  const blue = composeChannel(foregroundColor.blue, backgroundColor.blue)

  if (alpha === 1) {
    return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`
  }

  return `${RGBA_FUNCTION_NAME}(${roundedChannel(red)}, ${roundedChannel(green)}, ${roundedChannel(blue)}, ${formattedAlpha(alpha)})`
}

// Calculates the WCAG contrast ratio against an opaque background.
export const contrastRatio = (
  foreground: string,
  background: string,
): number => {
  const backgroundColor = parseColor(background)

  if (backgroundColor.alpha !== 1) {
    throw new Error(
      "Background color must be opaque to calculate contrast without a canvas.",
    )
  }

  const compositedForeground = parseColor(
    compositeColor(foreground, background),
  )
  const foregroundLuminance = relativeLuminance(compositedForeground)
  const backgroundLuminance = relativeLuminance(backgroundColor)

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}

import { Rect, Svg, Text } from "react-native-svg"

import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

interface NKolosovIconProps {
  // Fill color for the "NK" glyph
  color?: string
}

export const NKolosovIcon = ({
  color = TEXT_COLORS.light,
}: NKolosovIconProps) => (
  <Svg width="100%" height="100%" viewBox="0 0 40 40">
    <Rect width={40} height={40} rx={8} fill={BACKGROUND_COLORS.secondary} />
    <Text
      x={20}
      y={25}
      fontSize={15}
      fontWeight="600"
      fill={color}
      textAnchor="middle"
    >
      NK
    </Text>
  </Svg>
)

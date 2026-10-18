import { Svg, Text } from "react-native-svg"

import { TEXT_COLORS } from "@/constants/colors"

interface NKolosovIconProps {
  // Fill color for the "NK" glyph
  color?: string
}

export const NKolosovIcon = ({
  color = TEXT_COLORS.light,
}: NKolosovIconProps) => (
  <Svg width="100%" height="100%" viewBox="0 0 40 40">
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

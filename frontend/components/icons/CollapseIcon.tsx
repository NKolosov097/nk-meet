import React from "react"

import { Path, Svg } from "react-native-svg"

import { TEXT_COLORS } from "@/constants/colors"

import { IconProps } from "./types"

export const CollapseIcon = ({
  size = 16,
  color = TEXT_COLORS.light,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path
      fill={color}
      d="M5,5L5,1L3.5,1L3.5,3.5L1,3.5L1,5Z M11,5L11,1L12.5,1L12.5,3.5L15,3.5L15,5Z M11,11L11,15L12.5,15L12.5,12.5L15,12.5L15,11Z M5,11L5,15L3.5,15L3.5,12.5L1,12.5L1,11Z"
    />
  </Svg>
)

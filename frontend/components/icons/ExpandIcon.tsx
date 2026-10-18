import React from "react"

import { Path, Svg } from "react-native-svg"

import { TEXT_COLORS } from "@/constants/colors"

import { IconProps } from "./types"

export const ExpandIcon = ({
  size = 16,
  color = TEXT_COLORS.light,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path
      fill={color}
      d="M1,1L5,1L5,2.5L2.5,2.5L2.5,5L1,5Z M15,1L11,1L11,2.5L13.5,2.5L13.5,5L15,5Z M15,15L11,15L11,13.5L13.5,13.5L13.5,11L15,11Z M1,15L5,15L5,13.5L2.5,13.5L2.5,11L1,11Z"
    />
  </Svg>
)

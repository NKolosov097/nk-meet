import React from "react"

import { Path, Svg } from "react-native-svg"

import { TEXT_COLORS } from "@/constants/colors"

import { IconProps } from "./types"

export const ChevronLeftIcon = ({
  size = 20,
  color = TEXT_COLORS.light,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path d="M10 2L4 8L10 14Z" fill={color} />
  </Svg>
)

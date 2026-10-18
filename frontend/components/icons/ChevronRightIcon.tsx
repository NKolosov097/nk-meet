import React from "react"

import { Path, Svg } from "react-native-svg"

import { TEXT_COLORS } from "@/constants/colors"

import { IconProps } from "./types"

export const ChevronRightIcon = ({
  size = 20,
  color = TEXT_COLORS.light,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path d="M6 2L12 8L6 14Z" fill={color} />
  </Svg>
)

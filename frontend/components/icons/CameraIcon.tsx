import React from "react"

import { Path, Svg } from "react-native-svg"

import { TEXT_COLORS } from "@/constants/colors"

import { IconProps } from "./types"

export const CameraIcon = ({
  size = 22,
  color = TEXT_COLORS.light,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path
      fill={color}
      d="m0 4.5c0-.82843.671573-1.5 1.5-1.5h8c.8284 0 1.5.67157 1.5 1.5v7c0 .8284-.6716 1.5-1.5 1.5h-8c-.828427 0-1.5-.6716-1.5-1.5z"
    />
    <Path
      fill={color}
      d="m15.2 3.6-2.8 2.1c-.2518.18885-.4.48524-.4.8v3c0 .31476.1482.6111.4.8l2.8 2.1c.3296.2472.8.012.8-.4v-8c0-.41202-.4704-.64721-.8-.4z"
    />
  </Svg>
)

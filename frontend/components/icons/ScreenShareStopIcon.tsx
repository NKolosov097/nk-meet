import React from "react"

import { Path, Svg } from "react-native-svg"

import { TEXT_COLORS } from "@/constants/colors"

import { IconProps } from "./types"

export const ScreenShareStopIcon = ({
  size = 22,
  color = TEXT_COLORS.light,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path
      fill="none"
      stroke={color}
      strokeWidth={1.4}
      strokeLinejoin="round"
      d="m1.7 3.5c0-.55228.44772-1 1-1h10.6c.5523 0 1 .44772 1 1v6.6c0 .5523-.4477 1-1 1h-10.6c-.55228 0-1-.4477-1-1z"
    />
    <Path
      fill="none"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
      d="m5.6 13.6h4.8"
    />
    <Path
      fill="none"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
      d="m1.9 14.1 12.2-12.2"
    />
  </Svg>
)

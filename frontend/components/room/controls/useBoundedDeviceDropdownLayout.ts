import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  type LayoutChangeEvent,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native"

import {
  calculateBoundedDropdownLayout,
  calculateOverlayCoverStyle,
} from "./deviceDropdownLayout"

export const useBoundedDeviceDropdownLayout = (isDropdownVisible: boolean) => {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions()
  const containerRef = useRef<View>(null)
  const [containerX, setContainerX] = useState(0)
  const [containerY, setContainerY] = useState(0)
  const [containerOffsetInParent, setContainerOffsetInParent] = useState({
    x: 0,
    y: 0,
  })

  const measureContainer = useCallback((): void => {
    containerRef.current?.measureInWindow((x, y) => {
      setContainerX(x)
      setContainerY(y)
    })
  }, [])

  const onContainerLayout = useCallback(
    (event: LayoutChangeEvent): void => {
      const { x, y } = event.nativeEvent.layout
      setContainerOffsetInParent({ x, y })
      measureContainer()
    },
    [measureContainer],
  )

  useEffect(() => {
    if (isDropdownVisible) {
      measureContainer()
    }
  }, [isDropdownVisible, measureContainer, viewportWidth, viewportHeight])

  const dropdownPositionStyle = useMemo<ViewStyle>(
    () => calculateBoundedDropdownLayout(viewportWidth, containerX),
    [containerX, viewportWidth],
  )

  const overlayStyle = useMemo<ViewStyle>(
    () =>
      calculateOverlayCoverStyle(
        viewportWidth,
        viewportHeight,
        containerX - containerOffsetInParent.x,
        containerY - containerOffsetInParent.y,
      ),
    [
      viewportWidth,
      viewportHeight,
      containerX,
      containerY,
      containerOffsetInParent,
    ],
  )

  return {
    containerRef,
    onContainerLayout,
    dropdownPositionStyle,
    overlayStyle,
  }
}

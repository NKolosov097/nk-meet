export const DEVICE_DROPDOWN_MAX_WIDTH = 300
export const DEVICE_DROPDOWN_VIEWPORT_MARGIN = 16

interface BoundedDropdownLayout {
  // Dropdown width, in pixels
  width: number
  // Dropdown's horizontal offset from its anchor, in pixels
  left: number
}

export const calculateBoundedDropdownLayout = (
  viewportWidth: number,
  anchorX: number,
): BoundedDropdownLayout => {
  const safeViewportWidth = Math.max(0, viewportWidth)
  const viewportMargin = Math.min(
    DEVICE_DROPDOWN_VIEWPORT_MARGIN,
    safeViewportWidth / 2,
  )
  const width = Math.min(
    DEVICE_DROPDOWN_MAX_WIDTH,
    safeViewportWidth - viewportMargin * 2,
  )
  const minimumLeft = viewportMargin - anchorX
  const maximumLeft = safeViewportWidth - viewportMargin - width - anchorX

  return {
    width,
    left: Math.min(Math.max(0, minimumLeft), maximumLeft),
  }
}

export interface OverlayCoverStyle {
  // Vertical offset from the anchor's top edge needed to reach the viewport's top edge
  top: number
  // Horizontal offset from the anchor's left edge needed to reach the viewport's left edge
  left: number
  // Overlay width, sized to span the full viewport
  width: number
  // Overlay height, sized to span the full viewport
  height: number
}

export const calculateOverlayCoverStyle = (
  viewportWidth: number,
  viewportHeight: number,
  anchorX: number,
  anchorY: number,
): OverlayCoverStyle => ({
  top: -anchorY + 0,
  left: -anchorX + 0,
  width: Math.max(0, viewportWidth),
  height: Math.max(0, viewportHeight),
})

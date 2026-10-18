import type { LayoutChangeEvent, View } from "react-native"

import { act, renderHook } from "@testing-library/react-native"

import { useBoundedDeviceDropdownLayout } from "./useBoundedDeviceDropdownLayout"

const layoutEvent = (): LayoutChangeEvent =>
  ({
    nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } },
  }) as LayoutChangeEvent

const fakeMeasuredView = (x: number, y: number): View =>
  ({
    measureInWindow: (callback: (x: number, y: number) => void) =>
      callback(x, y),
  }) as unknown as View

test("positions the overlay to cover the full window from the container's measured location", async () => {
  const { result } = await renderHook(() =>
    useBoundedDeviceDropdownLayout(true),
  )

  result.current.containerRef.current = fakeMeasuredView(40, 580)

  await act(async () => {
    result.current.onContainerLayout(layoutEvent())
  })

  expect(result.current.overlayStyle.left).toBe(-40)
  expect(result.current.overlayStyle.top).toBe(-580)
  expect(result.current.overlayStyle.width).toBeGreaterThan(0)
  expect(result.current.overlayStyle.height).toBeGreaterThan(0)
})

test("positions the overlay against its true positioning parent, not just the anchor's window offset", async () => {
  const { result } = await renderHook(() =>
    useBoundedDeviceDropdownLayout(true),
  )

  result.current.containerRef.current = fakeMeasuredView(100, 60)

  await act(async () => {
    result.current.onContainerLayout({
      nativeEvent: { layout: { x: 15, y: 10, width: 0, height: 0 } },
    } as LayoutChangeEvent)
  })

  expect(result.current.overlayStyle.left).toBe(-85)
  expect(result.current.overlayStyle.top).toBe(-50)
})

// Minimum horizontal drag distance, in pixels, before a gesture counts as an
// intentional page-swipe rather than a tap or a scroll attempt.
export const SWIPE_THRESHOLD = 40

export interface SwipeGesture {
  // Horizontal distance travelled since the gesture started, in pixels. Negative is leftward.
  dx: number
  // Vertical distance travelled since the gesture started, in pixels.
  dy: number
}

// True once a gesture has moved far enough horizontally, and more
// horizontally than vertically, to count as a page-swipe.
export const isHorizontalSwipe = (gesture: SwipeGesture): boolean =>
  Math.abs(gesture.dx) > SWIPE_THRESHOLD &&
  Math.abs(gesture.dx) > Math.abs(gesture.dy)

// A leftward swipe (finger moving right-to-left, negative dx) requests the
// next page; a rightward swipe requests the previous page.
export const getSwipeDirection = (
  gesture: SwipeGesture,
): "next" | "previous" => (gesture.dx < 0 ? "next" : "previous")

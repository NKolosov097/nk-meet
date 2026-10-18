import assert from "node:assert/strict"
import test from "node:test"

import {
  getSwipeDirection,
  isHorizontalSwipe,
  SWIPE_THRESHOLD,
} from "./swipeResponder.ts"

test("ignores a drag that hasn't crossed the swipe threshold", () => {
  assert.equal(isHorizontalSwipe({ dx: SWIPE_THRESHOLD - 1, dy: 0 }), false)
})

test("ignores a drag that is mostly vertical", () => {
  assert.equal(
    isHorizontalSwipe({ dx: SWIPE_THRESHOLD + 10, dy: SWIPE_THRESHOLD + 20 }),
    false,
  )
})

test("recognizes a rightward drag past the threshold as a horizontal swipe", () => {
  assert.equal(isHorizontalSwipe({ dx: SWIPE_THRESHOLD + 10, dy: 0 }), true)
})

test("recognizes a leftward drag past the threshold as a horizontal swipe", () => {
  assert.equal(isHorizontalSwipe({ dx: -(SWIPE_THRESHOLD + 10), dy: 0 }), true)
})

test("treats a left swipe as a request for the next page", () => {
  assert.equal(getSwipeDirection({ dx: -60, dy: 0 }), "next")
})

test("treats a right swipe as a request for the previous page", () => {
  assert.equal(getSwipeDirection({ dx: 60, dy: 0 }), "previous")
})

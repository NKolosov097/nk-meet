import assert from "node:assert/strict"
import test from "node:test"

import {
  getGridDimensions,
  getPageSlice,
  getTileSize,
  getTotalPages,
} from "./gridLayout.ts"

test("shows a single full-screen tile for one participant", () => {
  assert.deepEqual(getGridDimensions(1), { columns: 1, rows: 1, pageSize: 1 })
})

test("stacks two participants in one column", () => {
  assert.deepEqual(getGridDimensions(2), { columns: 1, rows: 2, pageSize: 2 })
})

test("uses a 2x2 grid for three participants", () => {
  assert.deepEqual(getGridDimensions(3), { columns: 2, rows: 2, pageSize: 4 })
})

test("uses a 2x2 grid for four participants", () => {
  assert.deepEqual(getGridDimensions(4), { columns: 2, rows: 2, pageSize: 4 })
})

test("uses a 2x3 grid for five participants", () => {
  assert.deepEqual(getGridDimensions(5), { columns: 2, rows: 3, pageSize: 6 })
})

test("uses a 2x3 grid for six participants", () => {
  assert.deepEqual(getGridDimensions(6), { columns: 2, rows: 3, pageSize: 6 })
})

test("uses a 2x4 grid for seven participants", () => {
  assert.deepEqual(getGridDimensions(7), { columns: 2, rows: 4, pageSize: 8 })
})

test("uses a 2x4 grid for eight participants", () => {
  assert.deepEqual(getGridDimensions(8), { columns: 2, rows: 4, pageSize: 8 })
})

test("keeps the 2x4 grid and paginates for nine participants", () => {
  assert.deepEqual(getGridDimensions(9), { columns: 2, rows: 4, pageSize: 8 })
})

test("keeps the 2x4 grid for a much larger room", () => {
  assert.deepEqual(getGridDimensions(17), { columns: 2, rows: 4, pageSize: 8 })
})

test("fits everyone on one page when the count is below the page size", () => {
  assert.equal(getTotalPages(8, 8), 1)
})

test("adds a second page for one participant past the page size", () => {
  assert.equal(getTotalPages(9, 8), 2)
})

test("adds a third page for a large room", () => {
  assert.equal(getTotalPages(17, 8), 3)
})

test("always reports at least one page", () => {
  assert.equal(getTotalPages(0, 8), 1)
})

test("slices the first page from the start of the list", () => {
  assert.deepEqual(getPageSlice(0, 8), { start: 0, end: 8 })
})

test("slices the second page after the first page size", () => {
  assert.deepEqual(getPageSlice(1, 8), { start: 8, end: 16 })
})

test("slices pages using the current grid's page size", () => {
  assert.deepEqual(getPageSlice(2, 6), { start: 12, end: 18 })
})

test("computes tile size for a 2x2 grid", () => {
  assert.deepEqual(getTileSize(650, 330, 2, 2), { width: 310, height: 150 })
})

test("computes tile size for a single full-screen tile", () => {
  assert.deepEqual(getTileSize(400, 800, 1, 1), { width: 380, height: 780 })
})

test("clamps to zero instead of going negative on a tiny container", () => {
  assert.deepEqual(getTileSize(10, 10, 2, 3), { width: 0, height: 0 })
})

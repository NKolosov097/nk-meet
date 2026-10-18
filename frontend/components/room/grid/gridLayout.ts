// Spacing between adjacent tiles in the grid.
export const GRID_GAP = 10
// Spacing between the grid and the edges of its container.
export const GRID_PADDING = 10

export interface GridDimensions {
  // Number of tile columns in the grid.
  columns: number
  // Number of tile rows in the grid.
  rows: number
  // Participants shown per page — always columns * rows.
  pageSize: number
}

// Maps a count of participant/track entries (a screen-sharing participant
// contributes two entries, one camera and one screen-share) to a grid shape
// per the product's breakpoints: 1 -> 1x1 full screen, 2 -> 1x2 stacked,
// 3-4 -> 2x2, 5-6 -> 2x3, 7+ -> 2x4 (with 9+ paginated 8-per-page by
// getTotalPages/getPageSlice).
export const getGridDimensions = (participantCount: number): GridDimensions => {
  if (participantCount <= 1) {
    return { columns: 1, rows: 1, pageSize: 1 }
  }

  if (participantCount === 2) {
    return { columns: 1, rows: 2, pageSize: 2 }
  }

  if (participantCount <= 4) {
    return { columns: 2, rows: 2, pageSize: 4 }
  }

  if (participantCount <= 6) {
    return { columns: 2, rows: 3, pageSize: 6 }
  }

  return { columns: 2, rows: 4, pageSize: 8 }
}

// Number of pages needed to show every participant, always at least 1
// (so an empty room still has a page to render).
export const getTotalPages = (
  participantCount: number,
  pageSize: number,
): number => Math.max(1, Math.ceil(participantCount / pageSize))

export interface PageSlice {
  // Index of the first item on the current page, inclusive.
  start: number
  // Index one past the last item on the current page, exclusive.
  end: number
}

// Array indices (start inclusive, end exclusive) for the given page.
export const getPageSlice = (
  currentPage: number,
  pageSize: number,
): PageSlice => ({
  start: currentPage * pageSize,
  end: currentPage * pageSize + pageSize,
})

export interface TileSize {
  // Width of one tile, in pixels.
  width: number
  // Height of one tile, in pixels.
  height: number
}

// Per-tile pixel size that fits `columns` x `rows` tiles, with GRID_GAP
// between them and GRID_PADDING around the edges, inside a measured
// container. Clamps to 0 instead of going negative on a tiny container.
export const getTileSize = (
  containerWidth: number,
  containerHeight: number,
  columns: number,
  rows: number,
): TileSize => {
  const availableWidth = Math.max(
    0,
    containerWidth - GRID_PADDING * 2 - GRID_GAP * (columns - 1),
  )
  const availableHeight = Math.max(
    0,
    containerHeight - GRID_PADDING * 2 - GRID_GAP * (rows - 1),
  )

  return {
    width: columns > 0 ? availableWidth / columns : 0,
    height: rows > 0 ? availableHeight / rows : 0,
  }
}

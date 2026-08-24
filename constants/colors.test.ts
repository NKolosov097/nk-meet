import { contrastRatio } from "../utils/accessibility/contrast"

import { BACKGROUND_COLORS, BORDER_COLORS, TEXT_COLORS } from "./colors"

describe("semantic color palette", () => {
  it("provides accessible action and placeholder colors", () => {
    expect(BACKGROUND_COLORS.primary).toBe("#0062CC")
    expect(BACKGROUND_COLORS.dangerAction).toBe("#D72C21")
    expect(TEXT_COLORS.placeholderOnLight).toBe("#767676")
    expect(
      contrastRatio(TEXT_COLORS.placeholderOnLight, "#FFFFFF"),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(TEXT_COLORS.onPrimary, BACKGROUND_COLORS.primary),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(TEXT_COLORS.onDanger, BACKGROUND_COLORS.dangerAction),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it("provides accessible participant and pagination colors", () => {
    expect(TEXT_COLORS.paginationIcon).toBe("#8CC8FF")
    expect(BACKGROUND_COLORS.participantBadge).toBe("#333333")
    expect(TEXT_COLORS.participantStatusDanger).toBe("#FF6B63")
    expect(
      contrastRatio(TEXT_COLORS.paginationIcon, "#4A4A4A"),
    ).toBeGreaterThanOrEqual(3)
    expect(
      contrastRatio(
        TEXT_COLORS.participantStatusDanger,
        BACKGROUND_COLORS.participantBadge,
      ),
    ).toBeGreaterThanOrEqual(3)
  })

  it("keeps disabled text readable on its existing disabled background", () => {
    expect(
      contrastRatio(TEXT_COLORS.disabled, BACKGROUND_COLORS.disabled),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it("keeps meaningful control dividers visible on room control surfaces", () => {
    expect(
      contrastRatio(BORDER_COLORS.controlDivider, "#333333"),
    ).toBeGreaterThanOrEqual(3)
    expect(
      contrastRatio(BORDER_COLORS.controlDivider, BACKGROUND_COLORS.elevated),
    ).toBeGreaterThanOrEqual(3)
  })

  it("keeps selection indicators distinct from selected and unselected surfaces", () => {
    expect(BORDER_COLORS.selectionIndicator).toEqual(expect.any(String))
    expect(
      contrastRatio(
        BORDER_COLORS.selectionIndicator,
        BACKGROUND_COLORS.primary,
      ),
    ).toBeGreaterThanOrEqual(3)
    expect(
      contrastRatio(
        BORDER_COLORS.selectionIndicator,
        BACKGROUND_COLORS.secondary,
      ),
    ).toBeGreaterThanOrEqual(3)
    expect(
      contrastRatio(BORDER_COLORS.selectionIndicator, BACKGROUND_COLORS.black),
    ).toBeGreaterThanOrEqual(3)
  })
})

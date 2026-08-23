import { compositeColor, contrastRatio } from "./contrast"

describe("compositeColor", () => {
  it("blends a half-transparent foreground over an opaque background", () => {
    expect(compositeColor("rgba(0, 0, 0, 0.5)", "#FFFFFF")).toBe("#808080")
  })

  it("preserves the combined alpha of two translucent colors", () => {
    expect(compositeColor("rgba(255, 0, 0, 0.5)", "rgba(0, 0, 255, 0.5)")).toBe(
      "rgba(170, 0, 85, 0.75)",
    )
  })

  it("accepts an opaque rgba alpha written as a decimal", () => {
    expect(compositeColor("rgba(12, 34, 56, 1.0)", "#FFFFFF")).toBe("#0C2238")
  })

  it("rejects unsupported color formats with a helpful error", () => {
    expect(() => compositeColor("red", "#FFFFFF")).toThrow(
      "Unsupported color format: red. Use #RRGGBB or rgba(r, g, b, a).",
    )
  })
})

describe("contrastRatio", () => {
  it("returns the WCAG ratio for black text on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 2)
  })

  it("uses the composited foreground when calculating contrast", () => {
    expect(contrastRatio("rgba(0, 0, 0, 0.5)", "#FFFFFF")).toBeCloseTo(3.95, 2)
  })
})

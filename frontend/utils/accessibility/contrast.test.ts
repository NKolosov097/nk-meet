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

  it("rejects rgba channels outside the 0 to 255 range", () => {
    expect(() => compositeColor("rgba(256, 0, 0, 1)", "#FFFFFF")).toThrow(
      "Unsupported color format: rgba(256, 0, 0, 1). Use #RRGGBB or rgba(r, g, b, a).",
    )
  })

  it("rejects rgba alpha values greater than one", () => {
    expect(() => compositeColor("rgba(0, 0, 0, 1.01)", "#FFFFFF")).toThrow(
      "Unsupported color format: rgba(0, 0, 0, 1.01). Use #RRGGBB or rgba(r, g, b, a).",
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

  it("uses WCAG red channel luminance for a chromatic foreground", () => {
    expect(contrastRatio("#FF0000", "#000000")).toBeCloseTo(5.25, 2)
  })

  it("rejects a translucent background without a canvas", () => {
    expect(() => contrastRatio("#FFFFFF", "rgba(0, 0, 0, 0.5)")).toThrow(
      "Background color must be opaque to calculate contrast without a canvas.",
    )
  })
})

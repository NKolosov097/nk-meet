// a11y:components/room/CompanyIcon.tsx
// a11y:components/icons/NKolosovIcon.tsx
import { processColor } from "react-native"

import { render } from "@testing-library/react-native"

import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"
import { DEFAULT_COMPANY_ID } from "@/constants/company"
import { contrastRatio } from "@/utils/accessibility/contrast"

import { CompanyIcon } from "./CompanyIcon"

type RenderedNode = {
  type: string
  props: Record<string, unknown>
  children?: unknown[]
}

const renderedNodesOfType = (node: unknown, type: string): RenderedNode[] => {
  if (!node || typeof node !== "object") return []

  const renderedNode = node as RenderedNode
  const descendants = (renderedNode.children ?? []).flatMap(child =>
    renderedNodesOfType(child, type),
  )

  return renderedNode.type === type
    ? [renderedNode, ...descendants]
    : descendants
}

const nativeColor = (color: string) => ({
  type: 0,
  payload: processColor(color),
})

test("renders the registered NKolosov icon as an accessible, readable image", async () => {
  const view = await render(<CompanyIcon company={DEFAULT_COMPANY_ID} />)
  const icon = view.getByLabelText("NKolosov company")

  expect(icon).toHaveProp("accessibilityRole", "image")
  expect(icon).toHaveStyle({ height: 50, aspectRatio: 1 })

  const rectNodes = renderedNodesOfType(view.toJSON(), "RNSVGRect")
  expect(rectNodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        props: expect.objectContaining({
          fill: nativeColor(BACKGROUND_COLORS.secondary),
        }),
      }),
    ]),
  )

  const textNodes = renderedNodesOfType(view.toJSON(), "RNSVGText")
  expect(textNodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        props: expect.objectContaining({
          fill: nativeColor(TEXT_COLORS.light),
        }),
      }),
    ]),
  )
  expect(
    contrastRatio(TEXT_COLORS.light, BACKGROUND_COLORS.secondary),
  ).toBeGreaterThanOrEqual(3)
})

test("falls back to initials for a company without a registered icon", async () => {
  const view = await render(<CompanyIcon company="nkolosov-1" />)
  const icon = view.getByLabelText("nkolosov-1 company")

  expect(icon).toHaveProp("accessibilityRole", "image")
  expect(icon).toHaveStyle({
    height: 50,
    aspectRatio: 1,
    backgroundColor: BACKGROUND_COLORS.secondary,
  })
  expect(view.getByText("N1")).toBeVisible()
  expect(
    contrastRatio(TEXT_COLORS.light, BACKGROUND_COLORS.secondary),
  ).toBeGreaterThanOrEqual(3)
})

test("derives two-letter initials from hyphenated and single-word company ids", async () => {
  const hyphenated = await render(<CompanyIcon company="acme-corp" />)
  expect(hyphenated.getByText("AC")).toBeVisible()

  const singleWord = await render(<CompanyIcon company="acme" />)
  expect(singleWord.getByText("AC")).toBeVisible()
})

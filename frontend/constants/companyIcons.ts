import { ReactElement } from "react"

import { NKolosovIcon } from "@/components/icons"

import { DEFAULT_COMPANY_ID } from "./company"

export interface CompanyIconEntry {
  // SVG icon component that fills its wrapper via width/height="100%"
  Icon: (props: { color: string }) => ReactElement
  // Width-to-height ratio applied to the View sizing this icon
  aspectRatio: number
}

export const COMPANY_ICONS: Readonly<Record<string, CompanyIconEntry>> = {
  [DEFAULT_COMPANY_ID]: { Icon: NKolosovIcon, aspectRatio: 1 },
}

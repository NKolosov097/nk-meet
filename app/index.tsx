import { Redirect } from "expo-router"

import { DEFAULT_COMPANY_ID } from "@/constants/company"

export default function RootScreen() {
  return <Redirect href={`/${DEFAULT_COMPANY_ID}`} />
}

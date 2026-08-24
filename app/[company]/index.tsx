import { useEffect } from "react"

import { useLocalSearchParams, useRouter } from "expo-router"

import { HomeScreen } from "@/screens/HomeScreen"
import { slugify } from "@/services/roomSlug"

export default function CompanyHomeScreen() {
  const { company: rawCompany } = useLocalSearchParams<{ company: string }>()
  const router = useRouter()
  const company = slugify(rawCompany ?? "")
  const isCanonical = company === rawCompany

  useEffect(() => {
    if (isCanonical) return

    router.replace(company ? `/${company}` : "/")
  }, [company, isCanonical, router])

  if (!company) return null

  return <HomeScreen company={company} />
}

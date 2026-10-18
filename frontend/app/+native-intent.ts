import { parseMeetingPath } from "@/services/roomSlug"

interface RedirectSystemPathParams {
  // The raw incoming path from Expo Router (launch URL or runtime deep link)
  path: string
}

// Keeps a supported incoming link on its canonical company landing or meeting
// route so the router and active-room registry agree on both identity segments.
export const redirectSystemPath = ({
  path,
}: RedirectSystemPathParams): string => {
  const { company, slug } = parseMeetingPath(path)

  if (!company) return "/"

  return slug ? `/${company}/${slug}` : `/${company}`
}

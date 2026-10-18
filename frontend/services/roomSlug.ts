const ROOM_SLUG_ADJECTIVES = [
  "quiet",
  "brave",
  "amber",
  "swift",
  "calm",
  "bold",
  "lucky",
  "gentle",
]

const ROOM_SLUG_NOUNS = [
  "tiger",
  "river",
  "comet",
  "maple",
  "harbor",
  "falcon",
  "meadow",
  "otter",
]

// Collapses anything that isn't a lowercase letter or digit into a single
// "-" and trims leading/trailing dashes, so both typed codes and generated
// slugs always match the format LiveKit room names accept.
export const slugify = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

// Percent-decoding fails on a malformed escape ("%zz"), which a deep link is
// free to contain — fall back to the raw text and let slugify clean it up.
const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

const urlSegments = (url: string): string[] => {
  const urlWithoutQuery = url.split(/[?#]/)[0]
  let path = urlWithoutQuery

  try {
    const parsed = new URL(urlWithoutQuery)
    path =
      parsed.protocol === "http:" || parsed.protocol === "https:"
        ? parsed.pathname
        : `${parsed.host}${parsed.pathname}`
  } catch {
    path = urlWithoutQuery.replace(/^[a-z][a-z\d+.-]*:/i, "")
  }

  return path
    .split("/")
    .filter(part => part !== "")
    .map(segment => slugify(decodeSegment(segment)))
}

export interface RoomIdentity {
  // Canonical company segment from a company landing or meeting link
  company: string
  // Canonical meeting segment; empty for a company landing link
  slug: string
}

// Parses only the routes this app owns: /company and /company/room. Any
// additional segments are rejected so a native link cannot target a different room.
export const parseMeetingPath = (url: string): RoomIdentity => {
  const segments = urlSegments(url)

  if (segments.length === 0 || segments.length > 2 || !segments[0]) {
    return { company: "", slug: "" }
  }

  if (segments.length === 2 && !segments[1]) {
    return { company: "", slug: "" }
  }

  return { company: segments[0], slug: segments[1] ?? "" }
}

export const roomIdentityFromUrl = parseMeetingPath

// LiveKit identifies rooms globally, so both canonical URL segments are joined
// with a separator that slugify() cannot create from either source segment.
export const roomSlug = (company: string, slug: string): string =>
  company ? `${company}--${slug}` : slug

export const generateRoomSlug = (): string => {
  const adjective =
    ROOM_SLUG_ADJECTIVES[
      Math.floor(Math.random() * ROOM_SLUG_ADJECTIVES.length)
    ]
  const noun =
    ROOM_SLUG_NOUNS[Math.floor(Math.random() * ROOM_SLUG_NOUNS.length)]
  const suffix = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0")

  return `${adjective}-${noun}-${suffix}`
}

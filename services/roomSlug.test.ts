import { generateRoomSlug, roomSlugFromUrl, slugify } from "./roomSlug"

describe("slugify", () => {
  test("lowercases and trims the input", () => {
    expect(slugify("  Ada Lovelace  ")).toBe("ada-lovelace")
  })

  test("collapses invalid characters into a single dash", () => {
    expect(slugify("Team!!Sync??2024")).toBe("team-sync-2024")
  })

  test("strips leading and trailing dashes", () => {
    expect(slugify("--hello--")).toBe("hello")
  })

  test("returns an empty string for input with no valid characters", () => {
    expect(slugify("!!!")).toBe("")
  })
})

describe("roomSlugFromUrl", () => {
  test("reads the slug out of a custom-scheme link", () => {
    expect(roomSlugFromUrl("nk-meet://team-sync")).toBe("team-sync")
  })

  test("canonicalizes an escaped, mixed-case slug", () => {
    expect(roomSlugFromUrl("nk-meet://Team%20Sync")).toBe("team-sync")
  })

  test("ignores a query string and a fragment", () => {
    expect(roomSlugFromUrl("nk-meet://room-a?ref=chat#top")).toBe("room-a")
  })

  test("reads the first path segment of a triple-slashed link", () => {
    expect(roomSlugFromUrl("nk-meet:///room-a/details")).toBe("room-a")
  })

  test("returns an empty slug for a link that names no room", () => {
    expect(roomSlugFromUrl("nk-meet://")).toBe("")
  })

  test("returns an empty slug for a link with no valid characters", () => {
    expect(roomSlugFromUrl("nk-meet://!!!")).toBe("")
  })

  test("falls back to the raw segment for a malformed escape", () => {
    expect(roomSlugFromUrl("nk-meet://room%zz")).toBe("room-zz")
  })
})

describe("generateRoomSlug", () => {
  test("produces a lowercase word-word-number slug", () => {
    const slug = generateRoomSlug()
    expect(slug).toMatch(/^[a-z]+-[a-z]+-\d{2}$/)
  })

  test("is deterministic for a fixed random source", () => {
    const randomSpy = jest
      .spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)

    expect(generateRoomSlug()).toBe("quiet-tiger-00")

    randomSpy.mockRestore()
  })
})

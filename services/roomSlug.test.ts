import {
  generateRoomSlug,
  parseMeetingPath,
  roomIdentityFromUrl,
  roomSlug,
  slugify,
} from "./roomSlug"

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

describe("roomIdentityFromUrl", () => {
  test("keeps canonical company and room segments from a deep link", () => {
    expect(
      roomIdentityFromUrl("nk-meet://Nkolosov/Expo%20Development%20Client"),
    ).toEqual({
      company: "nkolosov",
      slug: "expo-development-client",
    })
  })

  test("returns a company-only identity for a landing deep link", () => {
    expect(roomIdentityFromUrl("nk-meet://Nkolosov")).toEqual({
      company: "nkolosov",
      slug: "",
    })
  })

  test("rejects additional path segments instead of collapsing them", () => {
    expect(roomIdentityFromUrl("nk-meet://nkolosov/weekly-sync/extra")).toEqual(
      {
        company: "",
        slug: "",
      },
    )
  })
})

describe("parseMeetingPath", () => {
  test.each([
    [
      "nk-meet:/Nkolosov/Weekly%20Sync",
      { company: "nkolosov", slug: "weekly-sync" },
    ],
    [
      "nk-meet:Nkolosov/Weekly%20Sync",
      { company: "nkolosov", slug: "weekly-sync" },
    ],
    [
      "https://meet.example/Nkolosov/Weekly%20Sync",
      { company: "nkolosov", slug: "weekly-sync" },
    ],
  ])("parses the company and room path from %s", (path, expected) => {
    expect(parseMeetingPath(path)).toEqual(expected)
  })

  test("rejects extra path segments without using the URL host as a company", () => {
    expect(
      parseMeetingPath("https://meet.example/nkolosov/weekly-sync/extra"),
    ).toEqual({
      company: "",
      slug: "",
    })
  })
})

describe("roomSlug", () => {
  test("creates a deterministic LiveKit room name scoped to its company", () => {
    expect(roomSlug("nkolosov", "weekly-sync")).toBe("nkolosov--weekly-sync")
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

import { act, renderHook } from "@testing-library/react-native"

import { Track } from "livekit-client"

import { getTrackKey } from "@/components/room/grid/trackKey"

import { useParticipantSpotlight } from "./useParticipantSpotlight"

const track = (
  identity: string,
  source: Track.Source = Track.Source.Camera,
) =>
  ({
    participant: { identity, name: identity, isLocal: false },
    source,
    publication: undefined,
  }) as never

test("starts in grid view with nobody spotlighted", async () => {
  const tracks = [track("ada"), track("grace")]
  const { result } = await renderHook(() => useParticipantSpotlight(tracks))

  expect(result.current.expandedTrack).toBeNull()
  expect(result.current.carouselTracks).toEqual(tracks)
  expect(result.current.canManuallySelect).toBe(true)
})

test("spotlights the selected track and moves the rest to the carousel", async () => {
  const ada = track("ada")
  const grace = track("grace")
  const { result } = await renderHook(() =>
    useParticipantSpotlight([ada, grace]),
  )

  await act(async () => {
    result.current.selectSpotlight(getTrackKey(ada))
  })

  expect(result.current.expandedTrack).toBe(ada)
  expect(result.current.carouselTracks).toEqual([grace])
})

test("swaps the spotlight to a different track", async () => {
  const ada = track("ada")
  const grace = track("grace")
  const { result } = await renderHook(() =>
    useParticipantSpotlight([ada, grace]),
  )

  await act(async () => {
    result.current.selectSpotlight(getTrackKey(ada))
  })
  await act(async () => {
    result.current.selectSpotlight(getTrackKey(grace))
  })

  expect(result.current.expandedTrack).toBe(grace)
  expect(result.current.carouselTracks).toEqual([ada])
})

test("collapses back to grid view", async () => {
  const ada = track("ada")
  const { result } = await renderHook(() => useParticipantSpotlight([ada]))

  await act(async () => {
    result.current.selectSpotlight(getTrackKey(ada))
  })
  await act(async () => {
    result.current.clearSpotlight()
  })

  expect(result.current.expandedTrack).toBeNull()
})

test("falls back to grid view when the spotlighted participant leaves", async () => {
  const ada = track("ada")
  const grace = track("grace")
  const { result, rerender } = await renderHook(
    ({ tracks }: { tracks: never[] }) => useParticipantSpotlight(tracks),
    { initialProps: { tracks: [ada, grace] } },
  )

  await act(async () => {
    result.current.selectSpotlight(getTrackKey(ada))
  })
  expect(result.current.expandedTrack).toBe(ada)

  await rerender({ tracks: [grace] })

  expect(result.current.expandedTrack).toBeNull()
  expect(result.current.carouselTracks).toEqual([grace])
})

test("an active screen share overrides an existing manual selection", async () => {
  const ada = track("ada")
  const share = track("grace", Track.Source.ScreenShare)
  const { result, rerender } = await renderHook(
    ({ tracks }: { tracks: never[] }) => useParticipantSpotlight(tracks),
    { initialProps: { tracks: [ada] } },
  )

  await act(async () => {
    result.current.selectSpotlight(getTrackKey(ada))
  })
  expect(result.current.expandedTrack).toBe(ada)

  await rerender({ tracks: [ada, share] })

  expect(result.current.expandedTrack).toBe(share)
  expect(result.current.canManuallySelect).toBe(false)
})

test("ignores manual selection attempts while a screen share is active", async () => {
  const ada = track("ada")
  const share = track("grace", Track.Source.ScreenShare)
  const { result } = await renderHook(() =>
    useParticipantSpotlight([ada, share]),
  )

  await act(async () => {
    result.current.selectSpotlight(getTrackKey(ada))
  })

  expect(result.current.expandedTrack).toBe(share)
})

test("returns to grid view, discarding the prior manual pick, once the screen share ends", async () => {
  const ada = track("ada")
  const share = track("grace", Track.Source.ScreenShare)
  const { result, rerender } = await renderHook(
    ({ tracks }: { tracks: never[] }) => useParticipantSpotlight(tracks),
    { initialProps: { tracks: [ada, share] } },
  )

  await act(async () => {
    result.current.selectSpotlight(getTrackKey(ada))
  })
  expect(result.current.expandedTrack).toBe(share)

  await rerender({ tracks: [ada] })

  expect(result.current.expandedTrack).toBeNull()
  expect(result.current.canManuallySelect).toBe(true)
})

// a11y:components/room/spotlight/ParticipantSpotlight.tsx
import { fireEvent, render } from "@testing-library/react-native"

import type { TrackReferenceOrPlaceholder } from "@livekit/react-native"
import { Track } from "livekit-client"

import { ParticipantSpotlight } from "./ParticipantSpotlight"

jest.mock("@/components/participant/ParticipantTile", () => ({
  ParticipantTile: (props: never) => {
    const { trackRef, isSpotlighted, onToggleSpotlight } = props as {
      trackRef: { participant: { identity: string; name: string } }
      isSpotlighted?: boolean
      onToggleSpotlight?: VoidFunction
    }
    const React = require("react")
    const { Text, TouchableOpacity } = require("react-native")

    return React.createElement(
      TouchableOpacity,
      {
        testID: `tile-${trackRef.participant.identity}`,
        onPress: onToggleSpotlight,
        accessibilityLabel: isSpotlighted ? "spotlighted" : "not-spotlighted",
      },
      React.createElement(Text, null, trackRef.participant.name),
    )
  },
}))

const track = (
  identity: string,
  source: Track.Source = Track.Source.Camera,
): TrackReferenceOrPlaceholder =>
  ({
    participant: { identity, name: identity, isLocal: false },
    source,
    publication: undefined,
  }) as never

test("renders the expanded track fullscreen and the rest in the carousel", async () => {
  const ada = track("ada")
  const grace = track("grace")

  const view = await render(
    <ParticipantSpotlight
      expandedTrack={ada}
      carouselTracks={[grace]}
      canManuallySelect
      onSelect={jest.fn()}
      onCollapse={jest.fn()}
    />,
  )

  expect(view.getByTestId("tile-ada")).toBeOnTheScreen()
  expect(view.getByTestId("tile-grace")).toBeOnTheScreen()
  expect(view.getByTestId("tile-ada").props.accessibilityLabel).toBe(
    "spotlighted",
  )
})

test("tapping a carousel tile swaps the spotlight", async () => {
  const ada = track("ada")
  const grace = track("grace")
  const onSelect = jest.fn()

  const view = await render(
    <ParticipantSpotlight
      expandedTrack={ada}
      carouselTracks={[grace]}
      canManuallySelect
      onSelect={onSelect}
      onCollapse={jest.fn()}
    />,
  )

  await fireEvent.press(view.getByLabelText("Show grace fullscreen"))

  expect(onSelect).toHaveBeenCalledWith(`grace-${Track.Source.Camera}`)
})

test("collapsing the fullscreen tile returns to grid view", async () => {
  const ada = track("ada")
  const onCollapse = jest.fn()

  const view = await render(
    <ParticipantSpotlight
      expandedTrack={ada}
      carouselTracks={[]}
      canManuallySelect
      onSelect={jest.fn()}
      onCollapse={onCollapse}
    />,
  )

  await fireEvent.press(view.getByTestId("tile-ada"))

  expect(onCollapse).toHaveBeenCalledTimes(1)
})

test("hides manual controls while a screen share forces the view", async () => {
  const share = track("grace", Track.Source.ScreenShare)
  const ada = track("ada")

  const view = await render(
    <ParticipantSpotlight
      expandedTrack={share}
      carouselTracks={[ada]}
      canManuallySelect={false}
      onSelect={jest.fn()}
      onCollapse={jest.fn()}
    />,
  )

  expect(view.getByTestId("tile-grace").props.onPress).toBeUndefined()
  expect(view.queryByLabelText("Show ada fullscreen")).not.toBeOnTheScreen()
})

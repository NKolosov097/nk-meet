import type { ReactNode } from "react"
import { processColor } from "react-native"

import { render } from "@testing-library/react-native"

import {
  isTrackReference,
  type TrackReferenceOrPlaceholder,
  useTrackMutedIndicator,
} from "@livekit/react-native"
import { Track } from "livekit-client"

import { ParticipantPlaceholderIcon } from "@/components/icons"
import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

import { ParticipantTile } from "./ParticipantTile"

jest.mock("expo-blur", () => ({
  BlurView: ({
    children,
    style,
  }: {
    children?: ReactNode
    style?: unknown
  }) => {
    const React = require("react")
    const { View } = require("react-native")

    return React.createElement(
      View,
      { testID: "participant-badge", style },
      children,
    )
  },
}))

jest.mock("@livekit/react-native", () => ({
  isTrackReference: jest.fn(),
  useTrackMutedIndicator: jest.fn(),
  VideoTrack: () => {
    const React = require("react")
    const { View } = require("react-native")

    return React.createElement(View, { testID: "participant-video" })
  },
}))

const mockIsTrackReference = isTrackReference as unknown as jest.Mock
const mockUseTrackMutedIndicator = useTrackMutedIndicator as jest.Mock

const connectedTrack = {
  participant: {
    identity: "ada",
    name: "Ada",
    isLocal: false,
  },
  publication: { track: {} },
  source: Track.Source.Camera,
} as unknown as TrackReferenceOrPlaceholder

type RenderedNativeNode = {
  type: string
  props: Record<string, unknown>
  children?: unknown[]
}

const svgPathProps = (node: unknown): Record<string, unknown>[] => {
  if (!node || typeof node !== "object") {
    return []
  }

  const renderedNode = node as RenderedNativeNode
  const descendantPaths = (renderedNode.children ?? []).flatMap(svgPathProps)

  return renderedNode.type === "RNSVGPath"
    ? [renderedNode.props, ...descendantPaths]
    : descendantPaths
}

const svgColor = (color: string) => ({
  type: 0,
  payload: processColor(color),
})

beforeEach(() => {
  jest.clearAllMocks()
})

test("keeps a connected video participant's badge readable over its video", async () => {
  mockIsTrackReference.mockReturnValue(true)
  mockUseTrackMutedIndicator
    .mockReturnValueOnce({ isMuted: false })
    .mockReturnValueOnce({ isMuted: true })

  const view = await render(
    <ParticipantTile trackRef={connectedTrack} width={240} height={135} />,
  )

  expect(view.getByTestId("participant-video")).toBeOnTheScreen()
  expect(view.getByTestId("participant-badge")).toHaveStyle({
    backgroundColor: BACKGROUND_COLORS.participantBadge,
  })
  expect(view.getByText("Ada")).toHaveStyle({ color: TEXT_COLORS.light })
  expect(svgPathProps(view.toJSON())).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        fill: svgColor(TEXT_COLORS.participantStatusDanger),
      }),
    ]),
  )
})

test("uses the opaque badge and semantic placeholder color when a connected camera is unavailable", async () => {
  mockIsTrackReference.mockReturnValue(false)
  mockUseTrackMutedIndicator.mockReturnValue({ isMuted: false })

  const view = await render(
    <ParticipantTile trackRef={connectedTrack} width={240} height={135} />,
  )

  expect(view.getByTestId("participant-badge")).toHaveStyle({
    backgroundColor: BACKGROUND_COLORS.participantBadge,
  })
  expect(svgPathProps(view.toJSON())).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        fill: svgColor(TEXT_COLORS.placeholder),
      }),
    ]),
  )
})

test("keeps a pre-join video participant's badge readable and muted status distinct", async () => {
  const view = await render(
    <ParticipantTile
      previewTrack={{} as never}
      displayName="Ada"
      isMicrophoneEnabled={false}
      width={240}
      height={135}
    />,
  )

  expect(view.getByTestId("participant-video")).toBeOnTheScreen()
  expect(view.getByTestId("participant-badge")).toHaveStyle({
    backgroundColor: BACKGROUND_COLORS.participantBadge,
  })
  expect(view.getByText("Ada (You)")).toHaveStyle({
    color: TEXT_COLORS.light,
  })
  expect(svgPathProps(view.toJSON())).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        fill: svgColor(TEXT_COLORS.participantStatusDanger),
      }),
    ]),
  )
})

test("uses the same opaque badge and placeholder color for a pre-join camera-off preview", async () => {
  const view = await render(
    <ParticipantTile
      previewTrack={null}
      displayName="Ada"
      isMicrophoneEnabled
      width={240}
      height={135}
    />,
  )

  expect(view.getByTestId("participant-badge")).toHaveStyle({
    backgroundColor: BACKGROUND_COLORS.participantBadge,
  })
  expect(svgPathProps(view.toJSON())).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        fill: svgColor(TEXT_COLORS.placeholder),
      }),
    ]),
  )
})

test("defaults the placeholder icon to an opaque meaningful semantic color", async () => {
  const view = await render(<ParticipantPlaceholderIcon />)

  for (const path of svgPathProps(view.toJSON())) {
    expect(path.fill).toEqual(svgColor(TEXT_COLORS.placeholder))
    expect(path.fillOpacity).toBeUndefined()
  }
})

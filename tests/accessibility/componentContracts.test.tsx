import { existsSync, readdirSync } from "node:fs"
import path from "node:path"

import { processColor } from "react-native"

import { render } from "@testing-library/react-native"

import { ActiveRoom } from "@/components/room/ActiveRoom"
import { ControlBarPreview } from "@/components/room/grid/ControlBarPreview"
import { GridPreview } from "@/components/room/grid/GridPreview"
import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

jest.mock("@/components/room/ControlBar", () => ({
  ControlBar: () => {
    const React = require("react")
    const { View } = require("react-native")

    return React.createElement(View, { testID: "covered-control-bar" })
  },
}))

jest.mock("@/components/room/VideoConference", () => ({
  VideoConference: () => {
    const React = require("react")
    const { View } = require("react-native")

    return React.createElement(View, {
      testID: "covered-video-conference",
    })
  },
}))

jest.mock("@/components/room/useRegisterActiveRoomDisconnect", () => ({
  useRegisterActiveRoomDisconnect: jest.fn(),
}))

type CoverageKind = "contract" | "decorative" | "structural"

type VisualComponentContract = {
  source: string
  owner: string
  kind: CoverageKind
  rationale?: string
}

export const VISUAL_COMPONENT_CONTRACTS: readonly VisualComponentContract[] = [
  {
    source: "app/_layout.tsx",
    owner: "app/_layout.test.tsx",
    kind: "structural",
    rationale:
      "Chooses the native stack or GridPreview and adds no independent visual content.",
  },
  {
    source: "app/index.tsx",
    owner: "app/index.test.tsx",
    kind: "structural",
    rationale: "Redirect-only route with no rendered visual surface.",
  },
  {
    source: "app/[company]/[slug].tsx",
    owner: "app/[company]/[slug].test.tsx",
    kind: "structural",
    rationale:
      "Owns route and LiveKit state while JoinScreen and ActiveRoom own the visuals.",
  },
  {
    source: "app/[company]/index.tsx",
    owner: "app/[company]/index.test.tsx",
    kind: "structural",
    rationale:
      "Normalizes the company route and delegates visuals to HomeScreen.",
  },
  {
    source: "screens/HomeScreen.tsx",
    owner: "screens/HomeScreen.test.tsx",
    kind: "contract",
  },
  {
    source: "screens/JoinScreen.tsx",
    owner: "screens/JoinScreen.test.tsx",
    kind: "contract",
  },
  {
    source: "components/participant/ParticipantTile.tsx",
    owner: "components/participant/ParticipantTile.test.tsx",
    kind: "contract",
  },
  {
    source: "components/room/ActiveRoom.tsx",
    owner: "tests/accessibility/componentContracts.test.tsx",
    kind: "structural",
    rationale:
      "Provides the room surface while covered VideoConference and ControlBar children own its interactive visuals.",
  },
  {
    source: "components/room/ConfirmDisconnectModal.tsx",
    owner: "components/room/ConfirmDisconnectModal.test.tsx",
    kind: "contract",
  },
  {
    source: "components/room/ControlBar.tsx",
    owner: "components/room/ControlBar.integration.test.tsx",
    kind: "contract",
  },
  {
    source: "components/room/VideoConference.tsx",
    owner: "components/room/VideoConference.integration.test.tsx",
    kind: "contract",
  },
  {
    source: "components/room/controls/CameraControl.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "contract",
  },
  {
    source: "components/room/controls/DeviceDropdown.tsx",
    owner: "components/room/controls/DeviceDropdown.test.tsx",
    kind: "contract",
  },
  {
    source: "components/room/controls/MediaDeviceButton.tsx",
    owner: "components/room/controls/MediaDeviceButton.test.tsx",
    kind: "contract",
  },
  {
    source: "components/room/controls/MicrophoneControl.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "contract",
  },
  {
    source: "components/room/grid/ControlBarPreview.tsx",
    owner: "tests/accessibility/componentContracts.test.tsx",
    kind: "decorative",
    rationale:
      "Development-only noninteractive footprint delegates its imagery to the covered control icons and is hidden from accessibility.",
  },
  {
    source: "components/room/grid/GridPreview.tsx",
    owner: "tests/accessibility/componentContracts.test.tsx",
    kind: "contract",
  },
  {
    source: "components/room/grid/PaginationBar.tsx",
    owner: "components/room/grid/PaginationBar.test.tsx",
    kind: "contract",
  },
  {
    source: "components/room/grid/ParticipantGrid.tsx",
    owner: "components/room/VideoConference.integration.test.tsx",
    kind: "structural",
    rationale:
      "Lays out covered ParticipantTile children without adding meaningful colors or controls.",
  },
  {
    source: "components/icons/CameraDisabledIcon.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "decorative",
    rationale:
      "State is announced by its owning camera button; the SVG has no independent semantics.",
  },
  {
    source: "components/icons/CameraIcon.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "decorative",
    rationale:
      "State is announced by its owning camera button; the SVG has no independent semantics.",
  },
  {
    source: "components/icons/ChevronLeftIcon.tsx",
    owner: "components/room/grid/PaginationBar.test.tsx",
    kind: "decorative",
    rationale:
      "Direction is announced by the owning labeled button; the SVG has no independent semantics.",
  },
  {
    source: "components/icons/ChevronRightIcon.tsx",
    owner: "components/room/grid/PaginationBar.test.tsx",
    kind: "decorative",
    rationale:
      "Direction is announced by the owning labeled button; the SVG has no independent semantics.",
  },
  {
    source: "components/icons/DisconnectIcon.tsx",
    owner: "components/room/ControlBar.integration.test.tsx",
    kind: "decorative",
    rationale:
      "Action is announced by the owning disconnect button; the SVG has no independent semantics.",
  },
  {
    source: "components/icons/MicDisabledIcon.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "decorative",
    rationale:
      "State is announced by its owning microphone button; the SVG has no independent semantics.",
  },
  {
    source: "components/icons/MicIcon.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "decorative",
    rationale:
      "State is announced by its owning microphone button; the SVG has no independent semantics.",
  },
  {
    source: "components/icons/ParticipantPlaceholderIcon.tsx",
    owner: "components/participant/ParticipantTile.test.tsx",
    kind: "decorative",
    rationale:
      "ParticipantTile announces participant state while directly testing this meaningful SVG color.",
  },
] as const

const repositoryRoot = path.resolve(__dirname, "../..")
const excludedRuntimeDirectories = new Set([
  ".claude",
  ".expo",
  ".git",
  ".pnpm",
  ".pnpm-store",
  ".superpowers",
  ".worktrees",
  "__tests__",
  "android",
  "assets",
  "build",
  "coverage",
  "dist",
  "docs",
  "ios",
  "node_modules",
  "patches",
  "tests",
])

const findRuntimeTsxFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && excludedRuntimeDirectories.has(entry.name)) {
      return []
    }

    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) return findRuntimeTsxFiles(absolutePath)
    if (
      !entry.name.endsWith(".tsx") ||
      /\.(?:spec|test)\.tsx$/.test(entry.name)
    ) {
      return []
    }

    return [path.relative(repositoryRoot, absolutePath).replaceAll("\\", "/")]
  })

const nativeColor = (color: string) => ({
  type: 0,
  payload: processColor(color),
})

type RenderedNode = {
  type: string
  props: Record<string, unknown>
  children?: unknown[]
}

const renderedNodesOfType = (node: unknown, type: string): RenderedNode[] => {
  if (!node || typeof node !== "object") return []

  const renderedNode = node as RenderedNode
  const descendants = (renderedNode.children ?? []).flatMap(child =>
    renderedNodesOfType(child, type),
  )

  return renderedNode.type === type
    ? [renderedNode, ...descendants]
    : descendants
}

test("accounts for every runtime TSX visual module with an existing owning contract", () => {
  const runtimeSources = findRuntimeTsxFiles(repositoryRoot).sort()
  const inventoriedSources = VISUAL_COMPONENT_CONTRACTS.map(
    entry => entry.source,
  )
  const uncoveredVisualComponents = runtimeSources.filter(
    source => !inventoriedSources.includes(source),
  )
  const staleInventoryEntries = inventoriedSources.filter(
    source => !runtimeSources.includes(source),
  )
  const duplicateInventoryEntries = inventoriedSources.filter(
    (source, index) => inventoriedSources.indexOf(source) !== index,
  )
  const missingOwnerTests = VISUAL_COMPONENT_CONTRACTS.filter(
    entry =>
      !/\.(?:integration\.)?test\.tsx$/.test(entry.owner) ||
      !existsSync(path.join(repositoryRoot, entry.owner)),
  ).map(entry => `${entry.source} -> ${entry.owner}`)
  const unexplainedExceptions = VISUAL_COMPONENT_CONTRACTS.filter(
    entry => entry.kind !== "contract" && !entry.rationale?.trim(),
  ).map(entry => entry.source)

  expect(uncoveredVisualComponents).toEqual([])
  expect(staleInventoryEntries).toEqual([])
  expect(duplicateInventoryEntries).toEqual([])
  expect(missingOwnerTests).toEqual([])
  expect(unexplainedExceptions).toEqual([])
})

test("GridPreview exposes selected preset semantics and an AA primary pair", async () => {
  try {
    const view = await render(<GridPreview />)
    const selectedPreset = view.getByRole("button", {
      name: "Show 1 participant",
    })

    expect(selectedPreset.props.accessibilityState).toEqual({ selected: true })
    expect(selectedPreset).toHaveStyle({
      backgroundColor: BACKGROUND_COLORS.primary,
    })
    expect(view.getByText("1")).toHaveStyle({ color: TEXT_COLORS.onPrimary })

    const unselectedPreset = view.getByRole("button", {
      name: "Show 2 participants",
    })
    expect(unselectedPreset.props.accessibilityState).toEqual({
      selected: false,
    })
    expect(unselectedPreset).toHaveStyle({
      backgroundColor: BACKGROUND_COLORS.secondary,
    })
  } catch (error) {
    throw error
  }
})

test("ControlBarPreview is decorative and renders the covered control icons", async () => {
  try {
    const view = await render(<ControlBarPreview />)
    const preview = view.getByTestId("control-bar-preview", {
      includeHiddenElements: true,
    })

    expect(preview.props.accessibilityElementsHidden).toBe(true)
    expect(preview.props.importantForAccessibility).toBe("no-hide-descendants")
    expect(
      view.getByTestId("control-bar-preview-disconnect", {
        includeHiddenElements: true,
      }),
    ).toHaveStyle({ backgroundColor: BACKGROUND_COLORS.dangerAction })

    const svgNodes = renderedNodesOfType(view.toJSON(), "RNSVGSvgView")
    expect(svgNodes).toHaveLength(3)
    const pathNodes = renderedNodesOfType(view.toJSON(), "RNSVGPath")
    expect(pathNodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          props: expect.objectContaining({
            fill: nativeColor(TEXT_COLORS.onDanger),
          }),
        }),
      ]),
    )
  } catch (error) {
    throw error
  }
})

test("ActiveRoom supplies the room surface and delegates visuals to covered children", async () => {
  try {
    const view = await render(
      <ActiveRoom
        company="acme"
        roomSlug="weekly-sync"
        onForcedDisconnect={jest.fn()}
      />,
    )

    expect(view.getByTestId("active-room")).toHaveStyle({
      backgroundColor: BACKGROUND_COLORS.black,
    })
    expect(view.getByTestId("covered-video-conference")).toBeOnTheScreen()
    expect(view.getByTestId("covered-control-bar")).toBeOnTheScreen()
  } catch (error) {
    throw error
  }
})

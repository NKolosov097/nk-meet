import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { processColor } from "react-native"

import { fireEvent, render } from "@testing-library/react-native"

import { ActiveRoom } from "@/components/room/ActiveRoom"
import { ControlBarPreview } from "@/components/room/grid/ControlBarPreview"
import { GridPreview } from "@/components/room/grid/GridPreview"
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  TEXT_COLORS,
} from "@/constants/colors"

// a11y:components/room/ActiveRoom.tsx
// a11y:components/room/grid/ControlBarPreview.tsx
// a11y:components/room/grid/GridPreview.tsx

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

jest.mock("@/components/room/useSharedMeetingStartedAt", () => ({
  useSharedMeetingStartedAt: () => Date.now(),
}))

type CoverageKind = "contract" | "decorative" | "structural"

type VisualComponentContract = {
  contractId: string
  source: string
  owner: string
  kind: CoverageKind
  rationale?: string
}

export const VISUAL_COMPONENT_CONTRACTS: readonly VisualComponentContract[] = [
  {
    contractId: "a11y:app/_layout.tsx",
    source: "app/_layout.tsx",
    owner: "app/_layout.test.tsx",
    kind: "structural",
    rationale:
      "Chooses the native stack or GridPreview and adds no independent visual content.",
  },
  {
    contractId: "a11y:app/index.tsx",
    source: "app/index.tsx",
    owner: "app/index.test.tsx",
    kind: "structural",
    rationale: "Redirect-only route with no rendered visual surface.",
  },
  {
    contractId: "a11y:app/[company]/[slug].tsx",
    source: "app/[company]/[slug].tsx",
    owner: "app/[company]/[slug].test.tsx",
    kind: "structural",
    rationale:
      "Owns route and LiveKit state while JoinScreen and ActiveRoom own the visuals.",
  },
  {
    contractId: "a11y:app/[company]/index.tsx",
    source: "app/[company]/index.tsx",
    owner: "app/[company]/index.test.tsx",
    kind: "structural",
    rationale:
      "Normalizes the company route and delegates visuals to HomeScreen.",
  },
  {
    contractId: "a11y:screens/HomeScreen.tsx",
    source: "screens/HomeScreen.tsx",
    owner: "screens/HomeScreen.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:screens/JoinScreen.tsx",
    source: "screens/JoinScreen.tsx",
    owner: "screens/JoinScreen.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/participant/ParticipantTile.tsx",
    source: "components/participant/ParticipantTile.tsx",
    owner: "components/participant/ParticipantTile.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/ActiveRoom.tsx",
    source: "components/room/ActiveRoom.tsx",
    owner: "tests/accessibility/componentContracts.test.tsx",
    kind: "structural",
    rationale:
      "Provides the room surface while covered VideoConference and ControlBar children own its interactive visuals.",
  },
  {
    contractId: "a11y:components/room/MeetingInfoBanner.tsx",
    source: "components/room/MeetingInfoBanner.tsx",
    owner: "components/room/ActiveRoom.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/ConfirmDisconnectModal.tsx",
    source: "components/room/ConfirmDisconnectModal.tsx",
    owner: "components/room/ConfirmDisconnectModal.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/ControlBar.tsx",
    source: "components/room/ControlBar.tsx",
    owner: "components/room/ControlBar.integration.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/CompanyIcon.tsx",
    source: "components/room/CompanyIcon.tsx",
    owner: "components/room/CompanyIcon.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/VideoConference.tsx",
    source: "components/room/VideoConference.tsx",
    owner: "components/room/VideoConference.integration.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/controls/CameraControl.tsx",
    source: "components/room/controls/CameraControl.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/controls/DeviceDropdown.tsx",
    source: "components/room/controls/DeviceDropdown.tsx",
    owner: "components/room/controls/DeviceDropdown.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/controls/MediaDeviceButton.tsx",
    source: "components/room/controls/MediaDeviceButton.tsx",
    owner: "components/room/controls/MediaDeviceButton.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/controls/MicrophoneControl.tsx",
    source: "components/room/controls/MicrophoneControl.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/grid/ControlBarPreview.tsx",
    source: "components/room/grid/ControlBarPreview.tsx",
    owner: "tests/accessibility/componentContracts.test.tsx",
    kind: "decorative",
    rationale:
      "Development-only noninteractive footprint delegates its imagery to the covered control icons and is hidden from accessibility.",
  },
  {
    contractId: "a11y:components/room/grid/GridPreview.tsx",
    source: "components/room/grid/GridPreview.tsx",
    owner: "tests/accessibility/componentContracts.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/grid/PaginationBar.tsx",
    source: "components/room/grid/PaginationBar.tsx",
    owner: "components/room/grid/PaginationBar.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/room/grid/ParticipantGrid.tsx",
    source: "components/room/grid/ParticipantGrid.tsx",
    owner: "components/room/VideoConference.integration.test.tsx",
    kind: "structural",
    rationale:
      "Lays out covered ParticipantTile children without adding meaningful colors or controls.",
  },
  {
    contractId: "a11y:components/room/spotlight/ParticipantSpotlight.tsx",
    source: "components/room/spotlight/ParticipantSpotlight.tsx",
    owner: "components/room/spotlight/ParticipantSpotlight.test.tsx",
    kind: "contract",
  },
  {
    contractId: "a11y:components/icons/CameraDisabledIcon.tsx",
    source: "components/icons/CameraDisabledIcon.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "decorative",
    rationale:
      "State is announced by its owning camera button; the SVG has no independent semantics.",
  },
  {
    contractId: "a11y:components/icons/CameraIcon.tsx",
    source: "components/icons/CameraIcon.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "decorative",
    rationale:
      "State is announced by its owning camera button; the SVG has no independent semantics.",
  },
  {
    contractId: "a11y:components/icons/ChevronLeftIcon.tsx",
    source: "components/icons/ChevronLeftIcon.tsx",
    owner: "components/room/grid/PaginationBar.test.tsx",
    kind: "decorative",
    rationale:
      "Direction is announced by the owning labeled button; the SVG has no independent semantics.",
  },
  {
    contractId: "a11y:components/icons/ChevronRightIcon.tsx",
    source: "components/icons/ChevronRightIcon.tsx",
    owner: "components/room/grid/PaginationBar.test.tsx",
    kind: "decorative",
    rationale:
      "Direction is announced by the owning labeled button; the SVG has no independent semantics.",
  },
  {
    contractId: "a11y:components/icons/CollapseIcon.tsx",
    source: "components/icons/CollapseIcon.tsx",
    owner: "components/participant/ParticipantTile.test.tsx",
    kind: "decorative",
    rationale:
      "State is announced by the owning spotlight button; the SVG has no independent semantics.",
  },
  {
    contractId: "a11y:components/icons/ExpandIcon.tsx",
    source: "components/icons/ExpandIcon.tsx",
    owner: "components/participant/ParticipantTile.test.tsx",
    kind: "decorative",
    rationale:
      "State is announced by the owning spotlight button; the SVG has no independent semantics.",
  },
  {
    contractId: "a11y:components/icons/DisconnectIcon.tsx",
    source: "components/icons/DisconnectIcon.tsx",
    owner: "components/room/ControlBar.integration.test.tsx",
    kind: "decorative",
    rationale:
      "Action is announced by the owning disconnect button; the SVG has no independent semantics.",
  },
  {
    contractId: "a11y:components/icons/MicDisabledIcon.tsx",
    source: "components/icons/MicDisabledIcon.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "decorative",
    rationale:
      "State is announced by its owning microphone button; the SVG has no independent semantics.",
  },
  {
    contractId: "a11y:components/icons/MicIcon.tsx",
    source: "components/icons/MicIcon.tsx",
    owner: "components/room/controls/mediaDevices.integration.test.tsx",
    kind: "decorative",
    rationale:
      "State is announced by its owning microphone button; the SVG has no independent semantics.",
  },
  {
    contractId: "a11y:components/icons/NKolosovIcon.tsx",
    source: "components/icons/NKolosovIcon.tsx",
    owner: "components/room/CompanyIcon.test.tsx",
    kind: "decorative",
    rationale:
      "Rendered inside CompanyIcon, which owns the accessible label; the SVG has no independent semantics.",
  },
  {
    contractId: "a11y:components/icons/ParticipantPlaceholderIcon.tsx",
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
  const invalidContractIds = VISUAL_COMPONENT_CONTRACTS.filter(
    entry => entry.contractId !== `a11y:${entry.source}`,
  ).map(entry => `${entry.source} -> ${entry.contractId}`)
  const unregisteredContracts = VISUAL_COMPONENT_CONTRACTS.filter(entry => {
    if (!existsSync(path.join(repositoryRoot, entry.owner))) return true

    const registration = `// ${entry.contractId}`
    return !readFileSync(path.join(repositoryRoot, entry.owner), "utf8")
      .split(/\r?\n/)
      .some(line => line.trim() === registration)
  }).map(entry => `${entry.contractId} -> ${entry.owner}`)

  expect(uncoveredVisualComponents).toEqual([])
  expect(staleInventoryEntries).toEqual([])
  expect(duplicateInventoryEntries).toEqual([])
  expect(missingOwnerTests).toEqual([])
  expect(unexplainedExceptions).toEqual([])
  expect(invalidContractIds).toEqual([])
  expect(unregisteredContracts).toEqual([])
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

test("GridPreview moves its visible indicator with preset selection", async () => {
  try {
    const view = await render(<GridPreview />)
    const firstPreset = view.getByRole("button", {
      name: "Show 1 participant",
    })
    const secondPreset = view.getByRole("button", {
      name: "Show 2 participants",
    })

    expect(firstPreset).toHaveStyle({
      borderColor: BORDER_COLORS.selectionIndicator,
      borderWidth: 2,
    })

    await fireEvent.press(secondPreset)

    expect(firstPreset.props.accessibilityState).toEqual({ selected: false })
    expect(secondPreset.props.accessibilityState).toEqual({ selected: true })
    expect(secondPreset).toHaveStyle({
      borderColor: BORDER_COLORS.selectionIndicator,
      borderWidth: 2,
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

    expect(
      view.getByTestId("control-bar-preview-company", {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen()
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
        company="nkolosov"
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

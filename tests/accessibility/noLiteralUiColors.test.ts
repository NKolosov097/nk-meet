import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

const repositoryRoot = path.resolve(__dirname, "../..")
const excludedDirectories = new Set([
  ".claude",
  ".expo",
  ".git",
  ".pnpm",
  ".pnpm-store",
  ".worktrees",
  "__tests__",
  "android",
  "build",
  "coverage",
  "dist",
  "ios",
  "node_modules",
  "tests",
])
const literalUiColorPattern = /#[0-9a-fA-F]{3,8}|rgba?\(/
const testFilePattern = /\.(?:spec|test)\.(?:ts|tsx)$/
const runtimeTypeScriptPattern = /\.(?:ts|tsx)$/
const expoConfigNames = new Set([
  "app.config.cjs",
  "app.config.js",
  "app.config.mjs",
  "app.config.ts",
  "app.config.tsx",
  "app.json",
])

const findRuntimeSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) return []

    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) return findRuntimeSourceFiles(absolutePath)
    const isRootExpoConfig =
      directory === repositoryRoot && expoConfigNames.has(entry.name)
    const isRuntimeTypeScript =
      runtimeTypeScriptPattern.test(entry.name) && !entry.name.endsWith(".d.ts")

    if (
      (!isRuntimeTypeScript && !isRootExpoConfig) ||
      testFilePattern.test(entry.name)
    ) {
      return []
    }

    return [absolutePath]
  })

test("runtime TypeScript and Expo config contain no literal UI colors", () => {
  const literalUiColorViolations = findRuntimeSourceFiles(
    repositoryRoot,
  ).flatMap(absolutePath => {
    const relativePath = path
      .relative(repositoryRoot, absolutePath)
      .replaceAll("\\", "/")

    if (relativePath === "constants/colors.ts") return []

    return readFileSync(absolutePath, "utf8")
      .split(/\r?\n/)
      .flatMap((line, index) =>
        literalUiColorPattern.test(line)
          ? [`${relativePath}:${index + 1}: ${line.trim()}`]
          : [],
      )
  })

  expect(literalUiColorViolations).toEqual([])
})

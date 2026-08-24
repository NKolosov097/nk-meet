import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

const repositoryRoot = path.resolve(__dirname, "../..")
const excludedDirectories = new Set([
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
  "ios",
  "node_modules",
  "tests",
])
const literalUiColorPattern = /#[0-9a-fA-F]{3,8}|rgba?\(/
const testFilePattern = /\.(?:spec|test)\.tsx$/

const findRuntimeTsxFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) return []

    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) return findRuntimeTsxFiles(absolutePath)
    if (!entry.name.endsWith(".tsx") || testFilePattern.test(entry.name)) {
      return []
    }

    return [absolutePath]
  })

test("runtime TSX sources contain no literal UI colors", () => {
  const literalUiColorViolations = findRuntimeTsxFiles(repositoryRoot).flatMap(
    absolutePath => {
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
    },
  )

  expect(literalUiColorViolations).toEqual([])
})

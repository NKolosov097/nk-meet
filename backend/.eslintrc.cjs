module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { node: true, es2022: true },
  // Project conventions require every await to remain inside try/catch.
  rules: { "no-useless-catch": "off" },
  ignorePatterns: ["dist/"],
}

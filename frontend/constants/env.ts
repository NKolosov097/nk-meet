export interface Env {
  // Backend URL for registration and authorized entry
  backendUrl: string
}
const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim() ?? ""
const validBackendUrl = (): boolean => {
  try {
    const url = new URL(backendUrl)
    return (
      (url.protocol === "https:" || (__DEV__ && url.protocol === "http:")) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}
export const configError = !backendUrl
  ? "Missing environment variables: EXPO_PUBLIC_BACKEND_URL"
  : validBackendUrl()
    ? null
    : "Invalid EXPO_PUBLIC_BACKEND_URL"
export const env: Env = { backendUrl }

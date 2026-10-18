import AsyncStorage from "@react-native-async-storage/async-storage"

const DEVICE_IDENTITY_KEY = "nk-meet.device-identity"

const randomChunk = (): string => Math.random().toString(36).slice(2, 10)

const createDeviceIdentity = (): string =>
  `device-${randomChunk()}${randomChunk()}`

let cachedIdentity: string | null = null

export const getDeviceIdentity = async (): Promise<string> => {
  if (cachedIdentity !== null) {
    return cachedIdentity
  }

  try {
    const storedIdentity = await AsyncStorage.getItem(DEVICE_IDENTITY_KEY)

    if (storedIdentity) {
      cachedIdentity = storedIdentity
      return storedIdentity
    }
  } catch (cause) {
    console.error("Failed to read the device identity: ", cause)
  }

  const identity = createDeviceIdentity()
  cachedIdentity = identity

  try {
    await AsyncStorage.setItem(DEVICE_IDENTITY_KEY, identity)
  } catch (cause) {
    console.error("Failed to persist the device identity: ", cause)
  }

  return identity
}

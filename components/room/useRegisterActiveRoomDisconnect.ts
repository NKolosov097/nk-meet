import { useEffect } from "react"

import { useRoomContext } from "@livekit/react-native"

import {
  registerActiveRoom,
  unregisterActiveRoom,
  type ActiveRoomRegistration,
} from "@/services/activeRoomConnection"

// Lets app/_layout.tsx disconnect this room from outside the LiveKit context
// tree when a deep link arrives for a different room, and calls
// `onForcedDisconnect` so the screen knows the app (not the user) ended it.
export const useRegisterActiveRoomDisconnect = (
  company: string,
  slug: string,
  onForcedDisconnect: VoidFunction,
): void => {
  const room = useRoomContext()

  useEffect(() => {
    const registration: ActiveRoomRegistration = {
      company,
      slug,
      disconnect: () => room.disconnect(),
      onForcedDisconnect,
    }

    registerActiveRoom(registration)

    return () => unregisterActiveRoom(registration)
  }, [room, company, slug, onForcedDisconnect])
}

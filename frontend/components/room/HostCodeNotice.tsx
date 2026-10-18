import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"

import { setStringAsync } from "expo-clipboard"

import { useRoomContext } from "@livekit/react-native"
import {
  ConnectionState,
  RoomEvent,
  type RemoteParticipant,
} from "livekit-client"

import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"
import { formatHostCode } from "@/services/hostCode"
import {
  getHostCodeVersion,
  revealHostCode,
  type MeetingEntry,
  type RevealedHostCode,
} from "@/services/livekitToken"

interface HostCodeNoticeProps {
  // Company owning this meeting
  company: string
  // Registered meeting slug
  slug: string
  // Memory-only authorized entry
  entry: MeetingEntry
}
export const HostCodeNotice = ({
  company,
  slug,
  entry,
}: HostCodeNoticeProps) => {
  const room = useRoomContext()
  const confirmed = useRef(entry.codeVersion ?? 0)
  const alive = useRef(true)
  const checking = useRef(false)
  const pending = useRef(false)
  const [changed, setChanged] = useState(false)
  const [displayed, setDisplayed] = useState<RevealedHostCode>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [copyFailed, setCopyFailed] = useState(false)
  const [connected, setConnected] = useState(
    room.state === ConnectionState.Connected,
  )
  const acceptVersion = useCallback((version: number): void => {
    if (version <= confirmed.current) return
    confirmed.current = version
    setDisplayed(undefined)
    setCopyFailed(false)
    setChanged(true)
  }, [])
  const reconcile = useCallback(async (): Promise<void> => {
    if (
      checking.current ||
      room.state !== ConnectionState.Connected ||
      !entry.hostAccess
    )
      return
    checking.current = true
    try {
      const result = await getHostCodeVersion(company, slug, entry.hostAccess)
      if (alive.current) {
        acceptVersion(result.codeVersion)
        setError(undefined)
      }
    } catch {
      if (alive.current)
        setError(
          "Host code status is unavailable. Please retry when connected.",
        )
    } finally {
      checking.current = false
    }
  }, [room, entry.hostAccess, company, slug, acceptVersion])
  useEffect(() => {
    alive.current = true
    const onState = (): void => {
      const active = room.state === ConnectionState.Connected
      setConnected(active)
      if (active) reconcile()
    }
    const onData = (
      _payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ): void => {
      if (!participant && topic === "nk.host-code.changed") reconcile()
    }
    room.on(RoomEvent.ConnectionStateChanged, onState)
    room.on(RoomEvent.Reconnected, onState)
    room.on(RoomEvent.Connected, onState)
    room.on(RoomEvent.DataReceived, onData)
    const foreground = AppState.addEventListener("change", state => {
      if (state === "active") reconcile()
    })
    const interval = setInterval(() => {
      reconcile()
    }, 30000)
    reconcile()
    return () => {
      alive.current = false
      clearInterval(interval)
      foreground.remove()
      room.off(RoomEvent.ConnectionStateChanged, onState)
      room.off(RoomEvent.Reconnected, onState)
      room.off(RoomEvent.Connected, onState)
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room, reconcile])
  const copy = async (result: RevealedHostCode): Promise<void> => {
    try {
      const success = await setStringAsync(formatHostCode(result.hostCode))
      if (alive.current && result.codeVersion >= confirmed.current) {
        setCopyFailed(!success)
        setError(
          success ? undefined : "Could not copy host code. Retry copying.",
        )
      }
    } catch {
      if (alive.current && result.codeVersion >= confirmed.current) {
        setCopyFailed(true)
        setError("Could not copy host code. Retry copying.")
      }
    }
  }
  const show = async (): Promise<void> => {
    if (pending.current || !connected || !entry.hostAccess) return
    pending.current = true
    setBusy(true)
    setError(undefined)
    try {
      const result = await revealHostCode(company, slug, entry.hostAccess)
      if (
        !alive.current ||
        room.state !== ConnectionState.Connected ||
        result.codeVersion < confirmed.current
      )
        return
      acceptVersion(result.codeVersion)
      setDisplayed(result)
      await copy(result)
    } catch {
      if (alive.current) setError("Could not retrieve host code. Please retry.")
    } finally {
      pending.current = false
      if (alive.current) setBusy(false)
    }
  }
  const retryCopy = async (): Promise<void> => {
    if (
      pending.current ||
      !connected ||
      !displayed ||
      displayed.codeVersion < confirmed.current
    )
      return
    pending.current = true
    setBusy(true)
    try {
      await copy(displayed)
    } catch {
      setError("Could not copy host code. Retry copying.")
    } finally {
      pending.current = false
      if (alive.current) setBusy(false)
    }
  }
  if (!changed && !error) return null
  const actionState = { disabled: busy || !connected, busy }
  return (
    <View style={styles.container}>
      {changed && (
        <Text style={styles.text} accessibilityLiveRegion="polite">
          Host code changed
        </Text>
      )}
      {displayed && (
        <Text style={styles.text} selectable>
          {formatHostCode(displayed.hostCode)}
        </Text>
      )}
      {error && (
        <Text style={styles.text} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {busy && (
        <ActivityIndicator
          color={TEXT_COLORS.light}
          accessibilityLabel="Retrieving host code"
        />
      )}
      {changed && (
        <TouchableOpacity
          onPress={() => {
            show()
          }}
          disabled={actionState.disabled}
          accessibilityState={actionState}
          accessibilityRole="button"
          accessibilityLabel="Show new host code and copy to clipboard"
        >
          <Text style={styles.text}>Show new host code</Text>
        </TouchableOpacity>
      )}
      {copyFailed && displayed && (
        <TouchableOpacity
          onPress={retryCopy}
          disabled={actionState.disabled}
          accessibilityState={actionState}
          accessibilityRole="button"
        >
          <Text style={styles.text}>Retry copying</Text>
        </TouchableOpacity>
      )}
      {!changed && error && (
        <TouchableOpacity
          onPress={reconcile}
          disabled={actionState.disabled}
          accessibilityState={actionState}
          accessibilityRole="button"
        >
          <Text style={styles.text}>Retry host code status</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
const styles = StyleSheet.create({
  container: {
    backgroundColor: BACKGROUND_COLORS.lightBackground,
    padding: 12,
    gap: 8,
  },
  text: { color: TEXT_COLORS.light, fontSize: 16 },
})

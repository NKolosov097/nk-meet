import {
  AccessToken,
  DataPacket_Kind,
  ParticipantInfo_State,
  RoomServiceClient,
  ServerError,
} from "livekit-server-sdk"

export interface LiveParticipant {
  // Server-reported participant identity.
  identity: string
  // Whether the provider reports ACTIVE rather than reconnecting.
  active: boolean
}

export interface LiveKit {
  // Client-facing LiveKit WebSocket URL.
  serverUrl: string
  // Issue a room-scoped token with media and own metadata permissions.
  token: (room: string, identity: string, name: string) => Promise<string>
  // Find provider-verified current presence; missing participants return undefined.
  participant: (
    room: string,
    identity: string,
  ) => Promise<LiveParticipant | undefined>
  // List provider-reported room participants.
  participants: (room: string) => Promise<LiveParticipant[]>
  // Send reliable code-free data only to the explicit host identities.
  notify: (room: string, identities: string[], version: number) => Promise<void>
}

export function roomName(company: string, slug: string): string {
  return `${company}--${slug}`
}

export function liveKit(
  serverUrl: string,
  serviceUrl: string,
  apiKey: string,
  apiSecret: string,
): LiveKit {
  const client = new RoomServiceClient(serviceUrl, apiKey, apiSecret, {
    requestTimeout: 5,
    failover: false,
  })
  return {
    serverUrl,
    async token(room, identity, name) {
      const token = new AccessToken(apiKey, apiSecret, {
        identity,
        name,
        ttl: "5m",
      })
      token.addGrant({
        roomJoin: true,
        room,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canUpdateOwnMetadata: true,
      })
      try {
        return await token.toJwt()
      } catch (error) {
        throw error
      }
    },
    async participant(room, identity) {
      try {
        const participant = await client.getParticipant(room, identity)
        return {
          identity: participant.identity,
          active: participant.state === ParticipantInfo_State.ACTIVE,
        }
      } catch (error) {
        if (error instanceof ServerError && error.status === 404)
          return undefined
        throw error
      }
    },
    async participants(room) {
      try {
        return (await client.listParticipants(room)).map(participant => ({
          identity: participant.identity,
          active: participant.state === ParticipantInfo_State.ACTIVE,
        }))
      } catch (error) {
        throw error
      }
    },
    async notify(room, identities, version) {
      if (!identities.length) return
      try {
        await client.sendData(
          room,
          Buffer.from(JSON.stringify({ codeVersion: version })),
          DataPacket_Kind.RELIABLE,
          { destinationIdentities: identities, topic: "nk.host-code.changed" },
        )
      } catch (error) {
        throw error
      }
    },
  }
}

export async function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Service timeout")), 5000)
  })
  try {
    return await Promise.race([operation, timeout])
  } catch (error) {
    throw error
  } finally {
    clearTimeout(timer)
  }
}

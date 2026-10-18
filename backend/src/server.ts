import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createHttpServer } from "./http.ts"
import { liveKit } from "./livekit.ts"
import { createMeetings } from "./meetings.ts"
import { openStore } from "./store.ts"

export function configuration(env: NodeJS.ProcessEnv) {
  const development = env.NODE_ENV === "development"
  const required = (name: string): string => {
    const value = env[name]
    if (!value?.trim()) throw new Error(`Missing ${name}`)
    return value
  }
  const url = new URL(required("LIVEKIT_URL"))
  if (
    !["wss:", "https:", ...(development ? ["ws:", "http:"] : [])].includes(
      url.protocol,
    ) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Invalid LIVEKIT_URL")
  url.protocol =
    url.protocol === "wss:" || url.protocol === "https:" ? "https:" : "http:"
  const serviceUrl = url.origin
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  const serverUrl = url.origin
  const encodedKey = required("HOST_CODE_ENCRYPTION_KEY")
  const key = Buffer.from(encodedKey, "base64")
  if (key.length !== 32 || key.toString("base64") !== encodedKey)
    throw new Error("Invalid HOST_CODE_ENCRYPTION_KEY")
  const port = Number(env.PORT ?? "3000")
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT")
  if (
    env.TRUST_LOCAL_PROXY &&
    !["true", "false"].includes(env.TRUST_LOCAL_PROXY)
  )
    throw new Error("Invalid TRUST_LOCAL_PROXY")
  const host = env.HOST ?? "127.0.0.1"
  if (!development && !["127.0.0.1", "::1", "localhost"].includes(host))
    throw new Error("Production backend must bind to loopback")
  const origins = (env.WEB_ORIGINS ?? "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)
  for (const origin of origins) {
    const parsed = new URL(origin)
    if (
      parsed.origin !== origin ||
      !["https:", ...(development ? ["http:"] : [])].includes(parsed.protocol)
    )
      throw new Error("Invalid WEB_ORIGINS")
  }
  return {
    serverUrl,
    serviceUrl,
    apiKey: required("LIVEKIT_API_KEY"),
    apiSecret: required("LIVEKIT_API_SECRET"),
    key,
    databasePath: required("DATABASE_PATH"),
    host,
    port,
    origins,
    trustLocalProxy: env.TRUST_LOCAL_PROXY === "true",
  }
}

export function start(env: NodeJS.ProcessEnv = process.env) {
  const config = configuration(env)
  mkdirSync(dirname(config.databasePath), { recursive: true })
  const store = openStore(config.databasePath)
  const meetings = createMeetings(
    store,
    config.key,
    liveKit(
      config.serverUrl,
      config.serviceUrl,
      config.apiKey,
      config.apiSecret,
    ),
  )
  const server = createHttpServer(meetings, config)
  server.listen(config.port, config.host, () => {
    console.info(`Backend listening on ${config.host}:${config.port}`)
  })
  return server
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    start()
  } catch {
    console.error("Backend startup failed. Check configuration and storage.")
    process.exitCode = 1
  }
}

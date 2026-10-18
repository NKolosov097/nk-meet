import { test } from "node:test"
import { equal, throws } from "node:assert/strict"
import { configuration } from "../src/server.ts"

const env = {
  LIVEKIT_URL: "wss://meet.example",
  LIVEKIT_API_KEY: "key",
  LIVEKIT_API_SECRET: "secret",
  HOST_CODE_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  DATABASE_PATH: "./data/meetings.sqlite",
}

test("configuration fails fast on secrets, key, URLs, origin and production binding", () => {
  const config = configuration(env)
  equal(config.host, "127.0.0.1")
  equal(config.trustLocalProxy, false)
  equal(config.serverUrl, "wss://meet.example")
  equal(config.serviceUrl, "https://meet.example")
  equal(
    configuration({ ...env, LIVEKIT_URL: "https://meet.example" }).serverUrl,
    "wss://meet.example",
  )
  equal(
    configuration({
      ...env,
      NODE_ENV: "development",
      LIVEKIT_URL: "http://localhost:7880",
      HOST: "0.0.0.0",
    }).serverUrl,
    "ws://localhost:7880",
  )
  for (const change of [
    { LIVEKIT_API_SECRET: "" },
    { HOST_CODE_ENCRYPTION_KEY: "short" },
    { LIVEKIT_URL: "ws://meet.example" },
    { LIVEKIT_URL: "wss://user:password@meet.example" },
    { LIVEKIT_URL: "wss://meet.example/path" },
    { WEB_ORIGINS: "*" },
    { WEB_ORIGINS: "https://web.example/path" },
    { HOST: "0.0.0.0" },
    { PORT: "0" },
    { PORT: "NaN" },
    { TRUST_LOCAL_PROXY: "yes" },
    { DATABASE_PATH: "" },
  ])
    throws(() => configuration({ ...env, ...change }))
})

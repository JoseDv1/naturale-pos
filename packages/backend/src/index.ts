import { Hono } from 'hono'
import { logger } from "hono/logger"
import { cors } from "hono/cors"
import { apiRoutes } from './router'
import { errorHandler } from './lib/errors'
import { existsSync } from 'fs'
import { serveStatic } from 'hono/bun'

const PORT = Bun.env.PORT ?? 3000

const app =
  new Hono()
    .use(logger())
    .use(cors())
    .onError(errorHandler)
    .notFound((ctx) => ctx.text(` 404 Not Found route ${ctx.req.url}`))

const rpc = app.route("/api", apiRoutes)

// SSR
// -------Frontend------
if (existsSync("../frontend/dist/server/entry.mjs")) {
  //@ts-expect-error
  const { handler: ssrHandler } = await import("../../frontend/dist/server/entry.mjs") // Relative to file
  app.use("/*", serveStatic({ root: "../frontend/dist/client/" })) // Relative to root
  app.use((ctx) => {
    console.log("SSR")
    return ssrHandler(ctx)
  })
} else {
  console.error("Frontend not founds")
}




export type Apptype = typeof rpc

const server = Bun.serve({
  fetch: app.fetch,
  port: PORT,
})

console.log(`Server running on http://localhost:${server.port}`)
import { Hono } from 'hono'
import { logger } from "hono/logger"
import { cors } from "hono/cors"
import { apiRoutes } from './router'
import { errorHandler } from './lib/errors'

const PORT = Bun.env.PORT ?? 3000

const app =
  new Hono()
    .use(logger())
    .use(cors())
    .onError(errorHandler)
    .notFound((ctx) => ctx.text(` 404 Not Found route ${ctx.req.url}`))

const rpc = app.route("/api", apiRoutes)
export type Apptype = typeof rpc

const server = Bun.serve({
  fetch: app.fetch,
  port: PORT,
})

console.log(`Server running on http://localhost:${server.port}`)
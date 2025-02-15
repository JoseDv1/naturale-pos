import { Hono } from 'hono'
import { logger } from "hono/logger"
import { cors } from "hono/cors"
import { apiRoutes } from './router'

const PORT = process.env.PORT ?? 3000
const app = new Hono()
  .use(logger())
  .use(cors())

const rpc = app.route("/api", apiRoutes)
export type Apptype = typeof rpc

const server = Bun.serve({
  fetch: app.fetch,
  port: PORT
})

console.log(`Server running on http://localhost:${server.port}`)
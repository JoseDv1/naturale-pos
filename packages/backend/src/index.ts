import { Hono } from 'hono'
import { logger } from "hono/logger"
import { cors } from "hono/cors"
import { apiRoutes } from './router'

const PORT = process.env.PORT ?? 3000
const app = new Hono()

app.use(logger())
app.use(cors())
const routes = app.route("/api", apiRoutes)


Bun.serve({
  fetch: app.fetch,
  port: PORT
})
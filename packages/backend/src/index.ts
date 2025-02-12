import { Hono } from 'hono'

const app = new Hono()
const PORT = process.env.PORT ?? 3000





Bun.serve({
  fetch: app.fetch
})
import { hc } from "hono/client"
import type { Apptype } from "@backend/index"

export const apiClient = hc<Apptype>('/')
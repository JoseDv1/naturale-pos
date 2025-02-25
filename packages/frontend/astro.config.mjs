// @ts-check
import { defineConfig } from "astro/config";

import svelte from "@astrojs/svelte";

//@ts-expect-error
import honoadapter from "hono-astro-adapter";

// https://astro.build/config
export default defineConfig({
	output: "server",
	adapter: honoadapter(),
	integrations: [svelte()],
	experimental: {
		svg: true,
	},
	vite: {
		server: {
			proxy: {
				"/api": "http://localhost:3000",
			},
		},
	},
});

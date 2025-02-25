//@ts-ignore
const result = await Bun.build({
	entrypoints: ["./src/index.ts"],
	external: ["../frontend/dist/server/entry.mjs"],
	root: "./src",
	outdir: "./dist",
	target: "bun",
	sourcemap: "external",
	minify: true,
	env: "disable",
	footer: `
// Created by JoseDv1
// Build Time ${new Date().toLocaleString()}
	`
})

if (!result.success) {
	console.error("Failed to build")
	for (const error of result.logs) {
		console.error(error)
	}
}

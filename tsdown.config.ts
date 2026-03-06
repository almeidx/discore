import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	format: "esm",
	dts: true,
	sourcemap: true,
	clean: true,
	platform: "node",
	target: "esnext",
	deps: {
		neverBundle: [/^@discordjs\//, /^discord-api-types/],
	},
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBot } from "../../src/bot.ts";
import { createMockREST } from "../fixtures/mock-api.ts";
import { createMockGateway } from "../fixtures/mock-gateway.ts";

describe("bot lifecycle", () => {
	it("creates a bot with api and gateway", () => {
		const gateway = createMockGateway();
		const rest = createMockREST();

		const bot = createBot({ rest, gateway: gateway as any });

		assert.ok(bot.api);
		assert.strictEqual(bot.gateway, gateway);
	});
});

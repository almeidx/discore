import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { GatewayDispatchEvents } from "discord-api-types/v10";
import { createBot } from "../../src/bot.ts";
import { defineCommandGroup } from "../../src/definitions/command-group.ts";
import { defineCommand } from "../../src/definitions/command.ts";
import type { SubcommandGroup } from "../../src/types/definitions.ts";
import { subcommandGroupInteraction } from "../fixtures/interactions.ts";
import { createMockREST } from "../fixtures/mock-api.ts";
import { createMockGateway } from "../fixtures/mock-gateway.ts";

describe("subcommand group flow integration", () => {
	it("routes subcommand group interaction to correct handler", async () => {
		const addHandler = mock.fn(async () => {});
		const removeHandler = mock.fn(async () => {});

		const add = defineCommand({
			data: { name: "add", description: "Add a role" },
			handler: addHandler,
		});

		const remove = defineCommand({
			data: { name: "remove", description: "Remove a role" },
			handler: removeHandler,
		});

		const roleGroup: SubcommandGroup = {
			name: "role",
			description: "Role management",
			subcommands: [add, remove],
		};

		const group = defineCommandGroup({
			data: { name: "manage", description: "Management" },
			subcommands: [roleGroup],
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			commands: [group],
		});

		gateway.dispatch(GatewayDispatchEvents.InteractionCreate, subcommandGroupInteraction("manage", "role", "add"));

		await new Promise((r) => setTimeout(r, 50));

		assert.strictEqual(addHandler.mock.callCount(), 1);
		assert.strictEqual(removeHandler.mock.callCount(), 0);
	});

	it("routes second subcommand in group correctly", async () => {
		const addHandler = mock.fn(async () => {});
		const removeHandler = mock.fn(async () => {});

		const add = defineCommand({
			data: { name: "add", description: "Add" },
			handler: addHandler,
		});

		const remove = defineCommand({
			data: { name: "remove", description: "Remove" },
			handler: removeHandler,
		});

		const roleGroup: SubcommandGroup = {
			name: "role",
			description: "Role management",
			subcommands: [add, remove],
		};

		const group = defineCommandGroup({
			data: { name: "manage", description: "Management" },
			subcommands: [roleGroup],
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			commands: [group],
		});

		gateway.dispatch(GatewayDispatchEvents.InteractionCreate, subcommandGroupInteraction("manage", "role", "remove"));

		await new Promise((r) => setTimeout(r, 50));

		assert.strictEqual(addHandler.mock.callCount(), 0);
		assert.strictEqual(removeHandler.mock.callCount(), 1);
	});
});

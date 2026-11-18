import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	defineCommand,
	defineCommandGroup,
	type AnyInteractionContext,
	type CommandContext,
	type CommandHooks,
	type GlobalHooks,
} from "../../src/index.ts";
import { chatInputInteraction, subcommandInteraction } from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

type Layer = "global" | "group" | "command";

interface LayerResults {
	before?: false;
	onError?: false;
}

function recordingHooks(layer: Layer, order: string[], results: LayerResults = {}) {
	return {
		beforeCommand: () => {
			order.push(`${layer} before`);
			return results.before;
		},
		afterCommand: () => {
			order.push(`${layer} after`);
		},
		onError: () => {
			order.push(`${layer} onError`);
			return results.onError;
		},
	};
}

/** A bot with one subcommand ("manage run") whose global, group and command layers all record their hooks. */
function createLayeredBot(options: {
	results?: Partial<Record<Layer, LayerResults>>;
	beforeInteraction?: GlobalHooks["beforeInteraction"];
	handlerError?: Error;
}) {
	const order: string[] = [];
	const results = options.results ?? {};
	const run = defineCommand({
		data: { name: "run", description: "d" },
		hooks: recordingHooks("command", order, results.command),
		handler: () => {
			order.push("handler");
			if (options.handlerError) throw options.handlerError;
		},
	});
	const group = defineCommandGroup({
		data: { name: "manage", description: "d" },
		hooks: recordingHooks("group", order, results.group),
		subcommands: [run],
	});
	const testBot = createTestBot({
		commands: [group],
		hooks: {
			...recordingHooks("global", order, results.global),
			beforeInteraction:
				options.beforeInteraction ??
				(() => {
					order.push("beforeInteraction");
				}),
			afterInteraction: () => {
				order.push("afterInteraction");
			},
		},
	});
	testBot.api.interactions.reply.mock.mockImplementation(async () => {
		order.push("error response");
	});
	return { ...testBot, order, run: () => testBot.interact(subcommandInteraction("manage", "run")) };
}

describe("command hooks", () => {
	it("runs before hooks global → group → command and after hooks command → group → global", async () => {
		const { order, run } = createLayeredBot({});

		await run();

		assert.deepStrictEqual(order, [
			"beforeInteraction",
			"global before",
			"group before",
			"command before",
			"handler",
			"command after",
			"group after",
			"global after",
			"afterInteraction",
		]);
	});

	it("composes global and command hooks for a command outside a group", async () => {
		const order: string[] = [];
		const command = defineCommand({
			data: { name: "ping", description: "d" },
			hooks: recordingHooks("command", order),
			handler: () => {
				order.push("handler");
			},
		});
		const { interact } = createTestBot({ commands: [command], hooks: recordingHooks("global", order) });

		await interact(chatInputInteraction("ping"));

		assert.deepStrictEqual(order, ["global before", "command before", "handler", "command after", "global after"]);
	});

	it("passes the handler's context to every hook", async () => {
		const seen = new Map<string, AnyInteractionContext>();
		const record =
			(name: string) =>
			(ctx: AnyInteractionContext): void => {
				seen.set(name, ctx);
			};
		const layerHooks = (layer: Layer): Pick<CommandHooks, "beforeCommand" | "afterCommand"> => ({
			beforeCommand: record(`${layer} before`),
			afterCommand: record(`${layer} after`),
		});
		let handlerContext: CommandContext | undefined;
		const run = defineCommand({
			data: { name: "run", description: "d" },
			hooks: layerHooks("command"),
			handler: (ctx) => {
				handlerContext = ctx;
			},
		});
		const group = defineCommandGroup({
			data: { name: "manage", description: "d" },
			hooks: layerHooks("group"),
			subcommands: [run],
		});
		const { interact } = createTestBot({
			commands: [group],
			hooks: {
				...layerHooks("global"),
				beforeInteraction: record("beforeInteraction"),
				afterInteraction: record("afterInteraction"),
			},
		});

		await interact(subcommandInteraction("manage", "run"));

		assert.ok(handlerContext);
		assert.strictEqual(seen.size, 8);
		for (const [name, ctx] of seen) assert.strictEqual(ctx, handlerContext, name);
	});

	for (const cancelling of ["global", "group", "command"] as const) {
		it(`${cancelling} beforeCommand returning false skips later before hooks, the handler and every afterCommand`, async () => {
			const { order, run } = createLayeredBot({ results: { [cancelling]: { before: false } } });

			await run();

			const befores = ["global before", "group before", "command before"];
			assert.deepStrictEqual(order, [
				"beforeInteraction",
				...befores.slice(0, befores.indexOf(`${cancelling} before`) + 1),
				"afterInteraction",
			]);
		});
	}

	it("beforeInteraction returning false skips command hooks, the handler and afterInteraction", async () => {
		const { order, run } = createLayeredBot({ beforeInteraction: () => false });

		await run();

		assert.deepStrictEqual(order, []);
	});

	it("runs onError command → group → global, responds, runs after hooks, then rethrows", async () => {
		const { order, run } = createLayeredBot({ handlerError: new Error("boom") });

		await assert.rejects(run(), { message: "boom" });

		assert.deepStrictEqual(order, [
			"beforeInteraction",
			"global before",
			"group before",
			"command before",
			"handler",
			"command onError",
			"group onError",
			"global onError",
			"error response",
			"command after",
			"group after",
			"global after",
			"afterInteraction",
		]);
	});

	it("passes the context and the thrown error to onError", async () => {
		const error = new Error("boom");
		const received: unknown[][] = [];
		let handlerContext: CommandContext | undefined;
		const command = defineCommand({
			data: { name: "ping", description: "d" },
			hooks: { onError: (...args) => void received.push(args) },
			handler: (ctx) => {
				handlerContext = ctx;
				throw error;
			},
		});
		const { interact } = createTestBot({
			commands: [command],
			hooks: { onError: (...args) => void received.push(args) },
		});

		await assert.rejects(interact(chatInputInteraction("ping")), error);

		assert.ok(handlerContext);
		assert.deepStrictEqual(received, [
			[handlerContext, error],
			[handlerContext, error],
		]);
	});

	for (const suppressing of ["command", "group", "global"] as const) {
		it(`${suppressing} onError returning false stops later onError hooks, the error response and the rethrow`, async () => {
			const { order, api, run } = createLayeredBot({
				handlerError: new Error("boom"),
				results: { [suppressing]: { onError: false } },
			});

			await run();

			const onErrors = ["command onError", "group onError", "global onError"];
			assert.deepStrictEqual(order, [
				"beforeInteraction",
				"global before",
				"group before",
				"command before",
				"handler",
				...onErrors.slice(0, onErrors.indexOf(`${suppressing} onError`) + 1),
				"command after",
				"group after",
				"global after",
				"afterInteraction",
			]);
			assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
		});
	}
});

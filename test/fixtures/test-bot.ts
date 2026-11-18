import { EventEmitter } from "node:events";
import type { REST } from "@discordjs/rest";
import { WebSocketShardEvents, type WebSocketManager } from "@discordjs/ws";
import { GatewayDispatchEvents, type APIInteraction, type GatewayDispatchPayload } from "discord-api-types/v10";
import { createBot, type Bot, type CreateBotOptions } from "../../src/index.ts";
import { asAPI, createMockAPI, type MockAPI } from "./mock-api.ts";

export type TestBotOptions = Omit<CreateBotOptions, "rest" | "gateway">;

export interface TestBot {
	bot: Bot;
	/** Spies installed as `bot.api`. */
	api: MockAPI;
	gateway: EventEmitter;
	/** Delivers a gateway dispatch and resolves once every handler settles; rejects with the dispatch error. */
	dispatch(event: string, data: unknown, shardId?: number): Promise<void>;
	/** Dispatches `INTERACTION_CREATE` with the given payload. */
	interact(interaction: APIInteraction): Promise<void>;
}

/** Creates a real bot wired to a mock gateway, with `bot.api` replaced by spies. */
export function createTestBot(options: TestBotOptions = {}): TestBot {
	const gateway = new EventEmitter();
	const rest = {} as REST; // only handed to new API(), whose result createTestBot replaces
	const bot = createBot({ ...options, rest, gateway: gateway as unknown as WebSocketManager });
	const api = createMockAPI();
	bot.api = asAPI(api);

	async function dispatch(event: string, data: unknown, shardId = 0): Promise<void> {
		const payload = { t: event, d: data, op: 0, s: 1 } as GatewayDispatchPayload;
		for (const listener of gateway.listeners(WebSocketShardEvents.Dispatch)) {
			await (listener as (payload: GatewayDispatchPayload, shardId: number) => Promise<void>)(payload, shardId);
		}
	}

	return {
		bot,
		api,
		gateway,
		dispatch,
		interact: (interaction) => dispatch(GatewayDispatchEvents.InteractionCreate, interaction),
	};
}

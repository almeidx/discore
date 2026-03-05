import { API, type CreateInteractionResponseOptions } from "@discordjs/core";
import type { REST } from "@discordjs/rest";
import { WebSocketShardEvents, type WebSocketManager } from "@discordjs/ws";
import { GatewayDispatchEvents, type APIInteraction, type GatewayDispatchPayload } from "discord-api-types/v10";
import { createCollectorStore } from "./collectors/collector-store.ts";
import { createModalCollectorStore } from "./collectors/modal-collector-store.ts";
import { createComponentRouter } from "./routing/component-router.ts";
import { createEventRouter } from "./routing/event-router.ts";
import { createInteractionRouter } from "./routing/interaction-router.ts";
import {
	DefinitionType,
	type AnyCommandDefinition,
	type CommandDefinition,
	type CommandGroupDefinition,
	type UserCommandDefinition,
	type MessageCommandDefinition,
	type EventDefinition,
	type InteractionDefinition,
	type ButtonDefinition,
	type SelectMenuDefinition,
	type ModalDefinition,
	type AutocompleteDefinition,
} from "./types/definitions.ts";
import type { GlobalHooks } from "./types/hooks.ts";

/** Configuration for {@link createBot}. */
export interface CreateBotOptions {
	rest: REST;
	gateway: WebSocketManager;
	commands?: AnyCommandDefinition[];
	events?: EventDefinition<any>[];
	interactions?: InteractionDefinition[];
	hooks?: GlobalHooks;
	errorResponse?:
		| CreateInteractionResponseOptions
		| ((ctx: { interaction: APIInteraction }, error: unknown) => CreateInteractionResponseOptions)
		| null;
}

export interface Bot {
	api: API;
	gateway: WebSocketManager;
}

/**
 * Creates a bot instance that wires gateway events to routers.
 * Call this after defining your commands, events, and interactions.
 */
export function createBot(options: CreateBotOptions): Bot {
	const api = new API(options.rest);
	const { gateway } = options;

	const commandMap = new Map<string, CommandDefinition>();
	const commandGroupMap = new Map<string, CommandGroupDefinition>();
	const userCommandMap = new Map<string, UserCommandDefinition>();
	const messageCommandMap = new Map<string, MessageCommandDefinition>();

	for (const cmd of options.commands ?? []) {
		switch (cmd.type) {
			case DefinitionType.CommandGroup:
				commandGroupMap.set(cmd.data.name, cmd);
				break;
			case DefinitionType.UserCommand:
				userCommandMap.set(cmd.data.name, cmd);
				break;
			case DefinitionType.MessageCommand:
				messageCommandMap.set(cmd.data.name, cmd);
				break;
			default:
				commandMap.set(cmd.data.name, cmd);
				break;
		}
	}

	const buttons: ButtonDefinition[] = [];
	const selectMenus: SelectMenuDefinition[] = [];
	const modals: ModalDefinition[] = [];
	const autocompletes: AutocompleteDefinition[] = [];

	for (const def of options.interactions ?? []) {
		switch (def.type) {
			case DefinitionType.Button:
				buttons.push(def);
				break;
			case DefinitionType.SelectMenu:
				selectMenus.push(def);
				break;
			case DefinitionType.Modal:
				modals.push(def);
				break;
			case DefinitionType.Autocomplete:
				autocompletes.push(def);
				break;
		}
	}

	const collectorStore = createCollectorStore();
	const modalCollectorStore = createModalCollectorStore();
	const componentRouter = createComponentRouter(buttons, selectMenus, modals);
	const eventRouter = createEventRouter(options.events ?? [], options.hooks ?? {});
	const interactionRouter = createInteractionRouter({
		commands: commandMap,
		commandGroups: commandGroupMap,
		userCommands: userCommandMap,
		messageCommands: messageCommandMap,
		autocompletes,
		componentRouter,
		collectorStore,
		modalCollectorStore,
		hooks: options.hooks ?? {},
		errorResponse: options.errorResponse,
	});

	gateway.on(WebSocketShardEvents.Dispatch, async (payload: GatewayDispatchPayload, shardId: number) => {
		if (payload.t === GatewayDispatchEvents.InteractionCreate) {
			const interaction = payload.d as APIInteraction;
			await interactionRouter.handle(api, gateway, interaction);
		}

		await eventRouter.dispatch(payload.t, payload.d, api, gateway, shardId);
	});

	return { api, gateway };
}

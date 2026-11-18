import { Collection } from "@discordjs/collection";
import { API } from "@discordjs/core";
import type { REST } from "@discordjs/rest";
import { WebSocketShardEvents, type WebSocketManager } from "@discordjs/ws";
import {
	GatewayDispatchEvents,
	InteractionType,
	type APIInteraction,
	type GatewayDispatchPayload,
} from "discord-api-types/v10";
import type { AutocompleteDefinition } from "./autocomplete/autocomplete.ts";
import { createAutocompleteRouter } from "./autocomplete/router.ts";
import { createCollectors } from "./collectors/collectors.ts";
import type { CommandDefinition } from "./commands/chat-input.ts";
import type { CommandGroupDefinition } from "./commands/command-group.ts";
import type { MessageCommandDefinition, UserCommandDefinition } from "./commands/context-menu.ts";
import type { MissingPermissionsResponseOption } from "./commands/permissions.ts";
import { createCommandRouter, type AnyCommandDefinition } from "./commands/router.ts";
import { createComponentRouter, type ComponentDefinition } from "./components/router.ts";
import { DefinitionType } from "./definition-type.ts";
import type { EventDefinition } from "./events/event.ts";
import { createEventRouter } from "./events/router.ts";
import type { GlobalHooks } from "./hooks.ts";
import type { ErrorResponseOption } from "./interaction/pipeline.ts";
import { throwCollected } from "./throw-collected.ts";

export type InteractionDefinition = ComponentDefinition | AutocompleteDefinition;

/** Configuration for {@link createBot}. */
export interface CreateBotOptions {
	rest: REST;
	gateway: WebSocketManager;
	commands?: AnyCommandDefinition[];
	events?: EventDefinition[];
	interactions?: InteractionDefinition[];
	hooks?: GlobalHooks;
	errorResponse?: Exclude<ErrorResponseOption, undefined>;
	missingPermissionsResponse?: Exclude<MissingPermissionsResponseOption, undefined>;
}

export interface Bot {
	api: API;
	gateway: WebSocketManager;
	/** Average heartbeat latency across all shards in milliseconds, or `undefined` if no heartbeats have been received yet. */
	readonly ping: number | undefined;
	readonly commands: Collection<string, CommandDefinition>;
	readonly commandGroups: Collection<string, CommandGroupDefinition>;
	readonly userCommands: Collection<string, UserCommandDefinition>;
	readonly messageCommands: Collection<string, MessageCommandDefinition>;
	addCommand(cmd: AnyCommandDefinition): void;
	removeCommand(name: string): boolean;
	addEvent(event: EventDefinition): void;
	removeEvent(event: EventDefinition): boolean;
	addInteraction(interaction: InteractionDefinition): void;
	removeInteraction(interaction: InteractionDefinition): boolean;
	destroy(): void;
}

/**
 * Creates a bot instance that wires gateway events to routers.
 * Call this after defining your commands, events, and interactions.
 */
export function createBot(options: CreateBotOptions): Bot {
	const { gateway, errorResponse, missingPermissionsResponse } = options;
	const hooks = options.hooks ?? {};
	const pings = new Collection<number, number>();

	const bot: Bot = {
		api: new API(options.rest),
		gateway,
		get ping() {
			if (!pings.size) return undefined;
			return pings.reduce((sum, latency) => sum + latency, 0) / pings.size;
		},
		get commands() {
			return commandRouter.commands;
		},
		get commandGroups() {
			return commandRouter.commandGroups;
		},
		get userCommands() {
			return commandRouter.userCommands;
		},
		get messageCommands() {
			return commandRouter.messageCommands;
		},

		addCommand: (cmd) => commandRouter.add(cmd),
		removeCommand: (name) => commandRouter.remove(name),
		addEvent: (event) => eventRouter.add(event),
		removeEvent: (event) => eventRouter.remove(event),

		addInteraction(interaction) {
			if (interaction.type === DefinitionType.Autocomplete) autocompleteRouter.add(interaction);
			else componentRouter.add(interaction);
		},

		removeInteraction(interaction) {
			return interaction.type === DefinitionType.Autocomplete
				? autocompleteRouter.remove(interaction)
				: componentRouter.remove(interaction);
		},

		destroy() {
			gateway.off(WebSocketShardEvents.HeartbeatComplete, heartbeatCompleteListener);
			gateway.off(WebSocketShardEvents.Dispatch, dispatchListener);
		},
	};

	const collectors = createCollectors();
	const commandRouter = createCommandRouter({ bot, hooks, collectors, errorResponse, missingPermissionsResponse });
	const componentRouter = createComponentRouter({ bot, hooks, collectors, errorResponse });
	const autocompleteRouter = createAutocompleteRouter({ bot, hooks });
	const eventRouter = createEventRouter({ bot, hooks });

	for (const cmd of options.commands ?? []) bot.addCommand(cmd);
	for (const event of options.events ?? []) bot.addEvent(event);
	for (const interaction of options.interactions ?? []) bot.addInteraction(interaction);

	async function handleInteraction(interaction: APIInteraction): Promise<void> {
		switch (interaction.type) {
			case InteractionType.ApplicationCommand:
				return commandRouter.handle(interaction);
			case InteractionType.MessageComponent:
				return componentRouter.handleComponent(interaction);
			case InteractionType.ModalSubmit:
				return componentRouter.handleModal(interaction);
			case InteractionType.ApplicationCommandAutocomplete:
				return autocompleteRouter.handle(interaction);
		}
	}

	async function dispatchListener(payload: GatewayDispatchPayload, shardId: number) {
		const errors: unknown[] = [];

		if (payload.t === GatewayDispatchEvents.InteractionCreate) {
			try {
				await handleInteraction(payload.d);
			} catch (error) {
				errors.push(error);
			}
		}

		try {
			await eventRouter.dispatch(payload.t, payload.d, shardId);
		} catch (error) {
			errors.push(error);
		}

		throwCollected(errors, "Dispatch failed");
	}

	function heartbeatCompleteListener({ latency }: { latency: number }, shardId: number) {
		pings.set(shardId, latency);
	}

	gateway.on(WebSocketShardEvents.HeartbeatComplete, heartbeatCompleteListener);
	gateway.on(WebSocketShardEvents.Dispatch, dispatchListener);

	return bot;
}

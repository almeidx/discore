import type { API } from "@discordjs/core";
import type { CreateInteractionResponseOptions } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import {
	InteractionType,
	ApplicationCommandType,
	type APIInteraction,
	type APIChatInputApplicationCommandInteraction,
	type APIMessageComponentInteraction,
	type APIModalSubmitInteraction,
	type APIApplicationCommandAutocompleteInteraction,
	MessageFlags,
} from "discord-api-types/v10";
import type { CommandDefinition, CommandGroupDefinition, AutocompleteDefinition } from "../types/definitions.ts";
import type { GlobalHooks } from "../types/hooks.ts";
import type { CollectorStore } from "../collectors/collector-store.ts";
import type { ModalCollectorStore } from "../collectors/modal-collector-store.ts";
import type { ComponentRouter } from "./component-router.ts";
import { createCommandContext } from "../context/command.ts";
import { createAutocompleteContext } from "../context/autocomplete.ts";
import { createButtonContext } from "../context/button.ts";
import { createSelectMenuContext } from "../context/select-menu.ts";
import { createModalContext } from "../context/modal.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import { ComponentType } from "discord-api-types/v10";

export type ErrorResponseOption =
	| CreateInteractionResponseOptions
	| ((ctx: { interaction: APIInteraction }, error: unknown) => CreateInteractionResponseOptions)
	| null
	| undefined;

export interface InteractionRouter {
	handle(api: API, gateway: WebSocketManager, interaction: APIInteraction): Promise<void>;
}

export function createInteractionRouter(config: {
	commands: Map<string, CommandDefinition>;
	commandGroups: Map<string, CommandGroupDefinition>;
	autocompletes: AutocompleteDefinition[];
	componentRouter: ComponentRouter;
	collectorStore: CollectorStore;
	modalCollectorStore: ModalCollectorStore;
	hooks: GlobalHooks;
	errorResponse: ErrorResponseOption;
}): InteractionRouter {
	const {
		commands,
		commandGroups,
		autocompletes,
		componentRouter,
		collectorStore,
		modalCollectorStore,
		hooks,
		errorResponse,
	} = config;

	const defaultErrorResponse: CreateInteractionResponseOptions = {
		content: "Something went wrong.",
		flags: MessageFlags.Ephemeral,
	};

	async function sendErrorResponse(api: API, interaction: APIInteraction, error: unknown): Promise<void> {
		const response = errorResponse === undefined ? defaultErrorResponse : errorResponse;
		if (response === null) return;

		const data = typeof response === "function" ? response({ interaction }, error) : response;

		try {
			await api.interactions.reply(interaction.id, interaction.token, data);
		} catch {
			try {
				await api.interactions.followUp(interaction.application_id, interaction.token, data);
			} catch {
				// exhausted all response methods
			}
		}
	}

	async function handleCommand(
		api: API,
		gateway: WebSocketManager,
		interaction: APIChatInputApplicationCommandInteraction,
	): Promise<void> {
		const commandName = interaction.data.name;

		let def: CommandDefinition | undefined;

		const group = commandGroups.get(commandName);
		if (group) {
			const subName = interaction.data.options?.[0];
			if (subName && "options" in subName) {
				def = group.subcommands.find((s) => s.data.name === subName.name);
			}
		} else {
			def = commands.get(commandName);
		}

		if (!def) return;

		const ctx = createCommandContext(api, gateway, interaction, collectorStore, modalCollectorStore);

		const activeHooks = {
			beforeCommand: def.hooks?.beforeCommand ?? hooks.beforeCommand,
			afterCommand: def.hooks?.afterCommand ?? hooks.afterCommand,
			onError: def.hooks?.onError ?? hooks.onError,
		};

		try {
			if (activeHooks.beforeCommand) {
				const result = await activeHooks.beforeCommand(ctx);
				if (result === false) return;
			}

			await def.handler(ctx as never);
		} catch (error) {
			let suppressed = false;
			if (activeHooks.onError) {
				const result = await activeHooks.onError(ctx, error);
				if (result === false) suppressed = true;
			}
			if (!suppressed) {
				await sendErrorResponse(api, interaction, error);
			}
		} finally {
			if (activeHooks.afterCommand) {
				try {
					await activeHooks.afterCommand(ctx);
				} catch {
					// afterCommand errors are swallowed
				}
			}
		}
	}

	async function handleAutocomplete(
		api: API,
		gateway: WebSocketManager,
		interaction: APIApplicationCommandAutocompleteInteraction,
	): Promise<void> {
		const commandName = interaction.data.name;

		const ctx = createAutocompleteContext(api, gateway, interaction);

		for (const def of autocompletes) {
			if (def.command === commandName && def.option === ctx.focused.name) {
				await def.handler(ctx);
				return;
			}
		}
	}

	function handleComponentForCollectors(
		api: API,
		gateway: WebSocketManager,
		interaction: APIMessageComponentInteraction,
	): boolean {
		const isButton = interaction.data.component_type === ComponentType.Button;

		let ctx: ComponentInteractionContext;
		if (isButton) {
			ctx = createButtonContext(api, gateway, interaction, {});
		} else {
			ctx = createSelectMenuContext(api, gateway, interaction, {});
		}

		return collectorStore.dispatch(ctx);
	}

	function handleModalForCollectors(
		api: API,
		gateway: WebSocketManager,
		interaction: APIModalSubmitInteraction,
	): boolean {
		const ctx = createModalContext(api, gateway, interaction, {});
		return modalCollectorStore.dispatch(ctx);
	}

	return {
		async handle(api, gateway, interaction) {
			switch (interaction.type) {
				case InteractionType.ApplicationCommand: {
					const cmdInteraction = interaction as APIChatInputApplicationCommandInteraction;
					if (cmdInteraction.data.type === ApplicationCommandType.ChatInput) {
						await handleCommand(api, gateway, cmdInteraction);
					}
					break;
				}

				case InteractionType.MessageComponent: {
					const compInteraction = interaction as APIMessageComponentInteraction;
					const handledByCollector = handleComponentForCollectors(api, gateway, compInteraction);
					if (!handledByCollector) {
						await componentRouter.handleComponent(api, gateway, compInteraction);
					}
					break;
				}

				case InteractionType.ModalSubmit: {
					const modalInteraction = interaction as APIModalSubmitInteraction;
					const handledByCollector = handleModalForCollectors(api, gateway, modalInteraction);
					if (!handledByCollector) {
						await componentRouter.handleModal(api, gateway, modalInteraction);
					}
					break;
				}

				case InteractionType.ApplicationCommandAutocomplete: {
					const acInteraction = interaction as APIApplicationCommandAutocompleteInteraction;
					await handleAutocomplete(api, gateway, acInteraction);
					break;
				}
			}
		},
	};
}

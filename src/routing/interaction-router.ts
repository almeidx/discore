import type { API } from "@discordjs/core";
import type { CreateInteractionResponseOptions } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import {
	InteractionType,
	ApplicationCommandType,
	type APIInteraction,
	type APIApplicationCommandInteraction,
	type APIChatInputApplicationCommandInteraction,
	type APIUserApplicationCommandInteraction,
	type APIMessageApplicationCommandInteraction,
	type APIMessageComponentInteraction,
	type APIModalSubmitInteraction,
	type APIApplicationCommandAutocompleteInteraction,
	MessageFlags,
	ComponentType,
} from "discord-api-types/v10";
import type { CollectorStore } from "../collectors/collector-store.ts";
import type { ModalCollectorStore } from "../collectors/modal-collector-store.ts";
import { createAutocompleteContext } from "../context/autocomplete.ts";
import { createButtonContext } from "../context/button.ts";
import { createCommandContext } from "../context/command.ts";
import { createMessageCommandContext } from "../context/message-command.ts";
import { createModalContext } from "../context/modal.ts";
import { createSelectMenuContext } from "../context/select-menu.ts";
import { createUserCommandContext } from "../context/user-command.ts";
import { parseOptions } from "../options-parser.ts";
import type {
	CommandDefinition,
	CommandGroupDefinition,
	AutocompleteDefinition,
	UserCommandDefinition,
	MessageCommandDefinition,
	SubcommandGroup,
} from "../types/definitions.ts";
import type { GlobalHooks, AnyInteractionContext } from "../types/hooks.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import type { ComponentRouter } from "./component-router.ts";

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
	userCommands: Map<string, UserCommandDefinition>;
	messageCommands: Map<string, MessageCommandDefinition>;
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
		userCommands,
		messageCommands,
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

	async function runBeforeInteraction(ctx: AnyInteractionContext): Promise<boolean> {
		if (!hooks.beforeInteraction) return true;
		const result = await hooks.beforeInteraction(ctx);
		return result !== false;
	}

	async function runAfterInteraction(ctx: AnyInteractionContext): Promise<void> {
		if (!hooks.afterInteraction) return;
		try {
			await hooks.afterInteraction(ctx);
		} catch {
			// afterInteraction errors are swallowed
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
			const parsed = parseOptions(interaction);
			if (parsed.subcommandGroup) {
				const subGroup = group.subcommands.find(
					(s): s is SubcommandGroup => !("type" in s) && s.name === parsed.subcommandGroup,
				);
				def = subGroup?.subcommands.find((s) => s.data.name === parsed.subcommand);
			} else if (parsed.subcommand) {
				def = group.subcommands.find((s): s is CommandDefinition => "type" in s && s.data.name === parsed.subcommand);
			}
		} else {
			def = commands.get(commandName);
		}

		if (!def) return;

		const ctx = createCommandContext(api, gateway, interaction, collectorStore, modalCollectorStore);

		if (!(await runBeforeInteraction(ctx))) return;

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

			await def.handler(ctx);
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
			await runAfterInteraction(ctx);
		}
	}

	async function handleUserCommand(
		api: API,
		gateway: WebSocketManager,
		interaction: APIUserApplicationCommandInteraction,
	): Promise<void> {
		const def = userCommands.get(interaction.data.name);
		if (!def) return;

		const ctx = createUserCommandContext(api, gateway, interaction, collectorStore, modalCollectorStore);

		if (!(await runBeforeInteraction(ctx))) return;

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

			await def.handler(ctx);
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
			await runAfterInteraction(ctx);
		}
	}

	async function handleMessageCommand(
		api: API,
		gateway: WebSocketManager,
		interaction: APIMessageApplicationCommandInteraction,
	): Promise<void> {
		const def = messageCommands.get(interaction.data.name);
		if (!def) return;

		const ctx = createMessageCommandContext(api, gateway, interaction, collectorStore, modalCollectorStore);

		if (!(await runBeforeInteraction(ctx))) return;

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

			await def.handler(ctx);
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
			await runAfterInteraction(ctx);
		}
	}

	async function handleAutocomplete(
		api: API,
		gateway: WebSocketManager,
		interaction: APIApplicationCommandAutocompleteInteraction,
	): Promise<void> {
		const ctx = createAutocompleteContext(api, gateway, interaction);

		if (!(await runBeforeInteraction(ctx))) return;

		try {
			for (const def of autocompletes) {
				if (matchesAutocomplete(def, ctx) && def.option === ctx.focused.name) {
					await def.handler(ctx);
					return;
				}
			}
		} finally {
			await runAfterInteraction(ctx);
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
					if (isChatInputCommand(interaction)) {
						await handleCommand(api, gateway, interaction);
					} else if (isUserAppCommand(interaction)) {
						await handleUserCommand(api, gateway, interaction);
					} else if (isMessageAppCommand(interaction)) {
						await handleMessageCommand(api, gateway, interaction);
					}
					break;
				}

				case InteractionType.MessageComponent: {
					const handledByCollector = handleComponentForCollectors(api, gateway, interaction);
					if (!handledByCollector) {
						await componentRouter.handleComponent(api, gateway, interaction);
					}
					break;
				}

				case InteractionType.ModalSubmit: {
					const handledByCollector = handleModalForCollectors(api, gateway, interaction);
					if (!handledByCollector) {
						await componentRouter.handleModal(api, gateway, interaction);
					}
					break;
				}

				case InteractionType.ApplicationCommandAutocomplete: {
					await handleAutocomplete(api, gateway, interaction);
					break;
				}
			}
		},
	};
}

function matchesAutocomplete(
	def: AutocompleteDefinition,
	ctx: {
		interaction: APIApplicationCommandAutocompleteInteraction;
		subcommand: string | undefined;
		subcommandGroup: string | undefined;
	},
): boolean {
	const commandName = ctx.interaction.data.name;

	if (typeof def.command === "string") {
		return def.command === commandName;
	}

	const parts = def.command;
	if (parts.length === 2) {
		return parts[0] === commandName && parts[1] === ctx.subcommand;
	}

	return parts[0] === commandName && parts[1] === ctx.subcommandGroup && parts[2] === ctx.subcommand;
}

function isChatInputCommand(
	interaction: APIApplicationCommandInteraction,
): interaction is APIChatInputApplicationCommandInteraction {
	return interaction.data.type === ApplicationCommandType.ChatInput;
}

function isUserAppCommand(
	interaction: APIApplicationCommandInteraction,
): interaction is APIUserApplicationCommandInteraction {
	return interaction.data.type === ApplicationCommandType.User;
}

function isMessageAppCommand(
	interaction: APIApplicationCommandInteraction,
): interaction is APIMessageApplicationCommandInteraction {
	return interaction.data.type === ApplicationCommandType.Message;
}

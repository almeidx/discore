import type { API } from "@discordjs/core";
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
	ComponentType,
} from "discord-api-types/v10";
import type { CollectorStore } from "../collectors/collector-store.ts";
import { createManagedAutocompleteContext } from "../context/autocomplete.ts";
import { createButtonContext } from "../context/button.ts";
import { createCommandContext } from "../context/command.ts";
import { createMessageCommandContext } from "../context/message-command.ts";
import { createModalContext } from "../context/modal.ts";
import { createSelectMenuContext } from "../context/select-menu.ts";
import { createUserCommandContext } from "../context/user-command.ts";
import { parseOptions } from "../options-parser.ts";
import type { MissingPermissionsResponseOption } from "../types/bot-options.ts";
import type { InteractionContext, ModalContext } from "../types/contexts.ts";
import type {
	CommandDefinition,
	CommandGroupDefinition,
	AutocompleteDefinition,
	UserCommandDefinition,
	MessageCommandDefinition,
	SubcommandGroup,
} from "../types/definitions.ts";
import type { GlobalHooks, AnyCommandContext, CommandHooks } from "../types/hooks.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import type { ComponentRouter } from "./component-router.ts";
import { sendErrorResponse, runBeforeInteraction, runAfterInteraction, type ErrorResponseOption } from "./shared.ts";
export type { MissingPermissionsResponseOption } from "../types/bot-options.ts";

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
	collectorStore: CollectorStore<ComponentInteractionContext>;
	modalCollectorStore: CollectorStore<ModalContext>;
	hooks: GlobalHooks;
	errorResponse: ErrorResponseOption;
	missingPermissionsResponse: MissingPermissionsResponseOption;
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
		missingPermissionsResponse,
	} = config;

	async function checkBotPermissions(
		ctx: AnyCommandContext,
		requiredPerms: bigint,
		appPermissions: string | undefined,
		commandHooks: CommandHooks | undefined,
		groupHooks: CommandHooks | undefined,
	): Promise<boolean> {
		if (!requiredPerms || appPermissions === undefined) return true;

		const granted = BigInt(appPermissions);
		const missing = requiredPerms & ~granted;
		if (!missing) return true;

		let bypass = false;
		let handledByHook = false;

		if (hooks.onMissingBotPermissions) {
			handledByHook = true;
			if ((await hooks.onMissingBotPermissions(ctx, missing)) === true) {
				bypass = true;
			}
		}
		if (groupHooks?.onMissingBotPermissions) {
			handledByHook = true;
			if ((await groupHooks.onMissingBotPermissions(ctx, missing)) === true) {
				bypass = true;
			}
		}
		if (commandHooks?.onMissingBotPermissions) {
			handledByHook = true;
			if ((await commandHooks.onMissingBotPermissions(ctx, missing)) === true) {
				bypass = true;
			}
		}

		if (bypass) return true;
		if (handledByHook) return false;

		if (missingPermissionsResponse !== undefined && missingPermissionsResponse !== null) {
			const data =
				typeof missingPermissionsResponse === "function"
					? missingPermissionsResponse(ctx, missing)
					: missingPermissionsResponse;
			await ctx.reply(data);
		}
		return false;
	}

	async function runCommandPipeline(
		ctx: AnyCommandContext & InteractionContext,
		handler: () => void | Promise<void>,
		requiredPerms: bigint,
		appPermissions: string | undefined,
		commandHooks?: CommandHooks,
		groupHooks?: CommandHooks,
	): Promise<void> {
		if (!(await checkBotPermissions(ctx, requiredPerms, appPermissions, commandHooks, groupHooks))) return;
		if (!(await runBeforeInteraction(hooks, ctx))) return;

		let handlerRan = false;

		try {
			if (hooks.beforeCommand && (await hooks.beforeCommand(ctx)) === false) return;
			if (groupHooks?.beforeCommand && (await groupHooks.beforeCommand(ctx)) === false) return;
			if (commandHooks?.beforeCommand && (await commandHooks.beforeCommand(ctx)) === false) return;

			handlerRan = true;
			await handler();
		} catch (error) {
			let suppressed = false;
			if (commandHooks?.onError && (await commandHooks.onError(ctx, error)) === false) suppressed = true;
			if (!suppressed && groupHooks?.onError && (await groupHooks.onError(ctx, error)) === false) suppressed = true;
			if (!suppressed && hooks.onError && (await hooks.onError(ctx, error)) === false) suppressed = true;
			if (!suppressed) {
				await sendErrorResponse(errorResponse, ctx, error);
			}
		} finally {
			if (handlerRan) {
				await commandHooks?.afterCommand?.(ctx);
				await groupHooks?.afterCommand?.(ctx);
				await hooks.afterCommand?.(ctx);
			}
			await runAfterInteraction(hooks, ctx);
		}
	}

	async function handleCommand(
		api: API,
		gateway: WebSocketManager,
		interaction: APIChatInputApplicationCommandInteraction,
	): Promise<void> {
		const commandName = interaction.data.name;

		let def: CommandDefinition | undefined;
		let groupHooks: CommandHooks | undefined;

		const group = commandGroups.get(commandName);
		if (group) {
			groupHooks = group.hooks;
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
		const requiredPerms = (group?.requiredBotPermissions ?? 0n) | (def.requiredBotPermissions ?? 0n);
		await runCommandPipeline(
			ctx,
			() => def.handler(ctx),
			requiredPerms,
			interaction.app_permissions,
			def.hooks,
			groupHooks,
		);
	}

	async function handleUserCommand(
		api: API,
		gateway: WebSocketManager,
		interaction: APIUserApplicationCommandInteraction,
	): Promise<void> {
		const def = userCommands.get(interaction.data.name);
		if (!def) return;

		const ctx = createUserCommandContext(api, gateway, interaction, collectorStore, modalCollectorStore);
		await runCommandPipeline(
			ctx,
			() => def.handler(ctx),
			def.requiredBotPermissions ?? 0n,
			interaction.app_permissions,
			def.hooks,
		);
	}

	async function handleMessageCommand(
		api: API,
		gateway: WebSocketManager,
		interaction: APIMessageApplicationCommandInteraction,
	): Promise<void> {
		const def = messageCommands.get(interaction.data.name);
		if (!def) return;

		const ctx = createMessageCommandContext(api, gateway, interaction, collectorStore, modalCollectorStore);
		await runCommandPipeline(
			ctx,
			() => def.handler(ctx),
			def.requiredBotPermissions ?? 0n,
			interaction.app_permissions,
			def.hooks,
		);
	}

	async function handleAutocomplete(
		api: API,
		gateway: WebSocketManager,
		interaction: APIApplicationCommandAutocompleteInteraction,
	): Promise<void> {
		const { context: ctx, hasResponded } = createManagedAutocompleteContext(api, gateway, interaction);

		if (!(await runBeforeInteraction(hooks, ctx))) return;

		try {
			for (const def of autocompletes) {
				if (matchesAutocomplete(def, ctx) && def.option === ctx.focused.name) {
					try {
						await def.handler(ctx);
					} catch (error) {
						let suppressed = false;
						if (hooks.onError) {
							const result = await hooks.onError(ctx, error);
							if (result === false) suppressed = true;
						}
						if (!suppressed && !hasResponded()) {
							await ctx.respond([]);
						}
					}
					return;
				}
			}
		} finally {
			await runAfterInteraction(hooks, ctx);
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

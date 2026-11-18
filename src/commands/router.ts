import { Collection } from "@discordjs/collection";
import {
	ApplicationCommandType,
	type APIApplicationCommandInteraction,
	type APIChatInputApplicationCommandInteraction,
	type APIMessageApplicationCommandInteraction,
	type APIUserApplicationCommandInteraction,
} from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import type { Collectors } from "../collectors/collectors.ts";
import { DefinitionType } from "../definition-type.ts";
import type { AnyCommandContext, GlobalHooks } from "../hooks.ts";
import { runInteraction, sendErrorResponse, type ErrorResponseOption } from "../interaction/pipeline.ts";
import { createCommandContext, type CommandDefinition } from "./chat-input.ts";
import type { ExecutableCommand } from "./command-base.ts";
import { findSubcommand, type CommandGroupDefinition } from "./command-group.ts";
import {
	createMessageCommandContext,
	createUserCommandContext,
	type MessageCommandDefinition,
	type UserCommandDefinition,
} from "./context-menu.ts";
import { parseCommandPath, resolveOptions } from "./options.ts";
import { hasRequiredBotPermissions, type MissingPermissionsResponseOption } from "./permissions.ts";

export type AnyCommandDefinition =
	| CommandDefinition
	| CommandGroupDefinition
	| UserCommandDefinition
	| MessageCommandDefinition;

export interface CommandRouter {
	commands: Collection<string, CommandDefinition>;
	commandGroups: Collection<string, CommandGroupDefinition>;
	userCommands: Collection<string, UserCommandDefinition>;
	messageCommands: Collection<string, MessageCommandDefinition>;
	add(def: AnyCommandDefinition): void;
	remove(name: string): boolean;
	handle(interaction: APIApplicationCommandInteraction): Promise<void>;
}

export function createCommandRouter(config: {
	bot: Bot;
	hooks: GlobalHooks;
	collectors: Collectors;
	errorResponse: ErrorResponseOption;
	missingPermissionsResponse: MissingPermissionsResponseOption;
}): CommandRouter {
	const { bot, hooks, collectors, errorResponse, missingPermissionsResponse } = config;
	const registries = {
		[DefinitionType.Command]: new Collection<string, CommandDefinition>(),
		[DefinitionType.CommandGroup]: new Collection<string, CommandGroupDefinition>(),
		[DefinitionType.UserCommand]: new Collection<string, UserCommandDefinition>(),
		[DefinitionType.MessageCommand]: new Collection<string, MessageCommandDefinition>(),
	};

	async function run<TContext extends AnyCommandContext>(
		ctx: TContext,
		def: ExecutableCommand<TContext>,
		group?: CommandGroupDefinition,
	): Promise<void> {
		const required = (group?.requiredBotPermissions ?? 0n) | (def.requiredBotPermissions ?? 0n);
		const permissionHooks = [hooks, group?.hooks, def.hooks];
		if (!(await hasRequiredBotPermissions(ctx, required, permissionHooks, missingPermissionsResponse))) return;

		await runInteraction(
			ctx,
			hooks,
			[
				{ before: hooks.beforeCommand, after: hooks.afterCommand },
				...[group?.hooks, def.hooks].map(
					(layer) => layer && { before: layer.beforeCommand, after: layer.afterCommand, onError: layer.onError },
				),
			],
			() => def.handler(ctx),
			(error) => sendErrorResponse(errorResponse, ctx, error),
		);
	}

	async function handleChatInput(interaction: APIChatInputApplicationCommandInteraction): Promise<void> {
		const { name, options, resolved } = interaction.data;
		const path = parseCommandPath(options);
		const group = registries[DefinitionType.CommandGroup].get(name);
		const def = group
			? findSubcommand(group, path.subcommandGroup, path.subcommand)
			: registries[DefinitionType.Command].get(name);
		if (!def) return;

		const ctx = createCommandContext(bot, interaction, resolveOptions(path.options, resolved), collectors);
		await run(ctx, def, group);
	}

	return {
		commands: registries[DefinitionType.Command],
		commandGroups: registries[DefinitionType.CommandGroup],
		userCommands: registries[DefinitionType.UserCommand],
		messageCommands: registries[DefinitionType.MessageCommand],

		add(def) {
			(registries[def.type] as Collection<string, AnyCommandDefinition>).set(def.data.name, def);
		},

		remove(name) {
			return Object.values(registries).some((registry) => registry.delete(name));
		},

		async handle(interaction) {
			switch (interaction.data.type) {
				case ApplicationCommandType.ChatInput:
					return handleChatInput(interaction as APIChatInputApplicationCommandInteraction);
				case ApplicationCommandType.User: {
					const def = registries[DefinitionType.UserCommand].get(interaction.data.name);
					if (!def) return;
					const userInteraction = interaction as APIUserApplicationCommandInteraction;
					return run(createUserCommandContext(bot, userInteraction, collectors), def);
				}
				case ApplicationCommandType.Message: {
					const def = registries[DefinitionType.MessageCommand].get(interaction.data.name);
					if (!def) return;
					const messageInteraction = interaction as APIMessageApplicationCommandInteraction;
					return run(createMessageCommandContext(bot, messageInteraction, collectors), def);
				}
			}
		},
	};
}

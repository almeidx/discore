import type {
	APIInteractionDataResolvedGuildMember,
	APIMessage,
	APIMessageApplicationCommandInteraction,
	APIUser,
	APIUserApplicationCommandInteraction,
	RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import { createCollectorMethods, type CollectorMethods, type Collectors } from "../collectors/collectors.ts";
import { DefinitionType } from "../definition-type.ts";
import { createInteractionContext, type InteractionContext } from "../interaction/context.ts";
import type { ExecutableCommand } from "./command-base.ts";

export type ContextMenuCommandData = Omit<RESTPostAPIContextMenuApplicationCommandsJSONBody, "type">;

export interface UserCommandContext extends InteractionContext, CollectorMethods {
	interaction: APIUserApplicationCommandInteraction;
	targetUser: APIUser;
	targetMember: APIInteractionDataResolvedGuildMember | undefined;
}

export interface MessageCommandContext extends InteractionContext, CollectorMethods {
	interaction: APIMessageApplicationCommandInteraction;
	targetMessage: APIMessage;
}

export interface UserCommandDefinition extends ExecutableCommand<UserCommandContext> {
	type: typeof DefinitionType.UserCommand;
	data: ContextMenuCommandData;
}

export interface MessageCommandDefinition extends ExecutableCommand<MessageCommandContext> {
	type: typeof DefinitionType.MessageCommand;
	data: ContextMenuCommandData;
}

export type DefineUserCommandConfig = Omit<UserCommandDefinition, "type">;

export type DefineMessageCommandConfig = Omit<MessageCommandDefinition, "type">;

export function defineUserCommand(config: DefineUserCommandConfig): UserCommandDefinition {
	return { ...config, type: DefinitionType.UserCommand };
}

export function defineMessageCommand(config: DefineMessageCommandConfig): MessageCommandDefinition {
	return { ...config, type: DefinitionType.MessageCommand };
}

export function createUserCommandContext(
	bot: Bot,
	interaction: APIUserApplicationCommandInteraction,
	collectors: Collectors,
): UserCommandContext {
	const { context } = createInteractionContext(bot, interaction);
	const { target_id: targetId, resolved } = interaction.data;

	return Object.assign(context, {
		interaction,
		targetUser: resolved.users[targetId]!,
		targetMember: resolved.members?.[targetId],
		...createCollectorMethods(collectors),
	});
}

export function createMessageCommandContext(
	bot: Bot,
	interaction: APIMessageApplicationCommandInteraction,
	collectors: Collectors,
): MessageCommandContext {
	const { context } = createInteractionContext(bot, interaction);
	const { target_id: targetId, resolved } = interaction.data;

	return Object.assign(context, {
		interaction,
		targetMessage: resolved.messages[targetId]!,
		...createCollectorMethods(collectors),
	});
}

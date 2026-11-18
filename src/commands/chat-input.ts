import type {
	APIApplicationCommandBasicOption,
	APIChatInputApplicationCommandInteraction,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import { createCollectorMethods, type CollectorMethods, type Collectors } from "../collectors/collectors.ts";
import { DefinitionType } from "../definition-type.ts";
import { createInteractionContext, type InteractionContext } from "../interaction/context.ts";
import type { ExecutableCommand } from "./command-base.ts";
import type { InferOptions } from "./options.ts";

/** Context passed to command handlers with typed options and collector methods. */
export interface CommandContext<TOptions = Record<string, unknown>> extends InteractionContext, CollectorMethods {
	interaction: APIChatInputApplicationCommandInteraction;
	options: TOptions;
}

export type CommandData<
	TOptions extends readonly APIApplicationCommandBasicOption[] = readonly APIApplicationCommandBasicOption[],
> = Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, "type" | "options"> & { options: TOptions };

export interface CommandDefinition extends ExecutableCommand<CommandContext> {
	type: typeof DefinitionType.Command;
	data: CommandData;
}

export interface DefineCommandConfig<
	TOptions extends readonly APIApplicationCommandBasicOption[] = readonly [],
> extends ExecutableCommand<CommandContext<InferOptions<TOptions>>> {
	data: Omit<CommandData<TOptions>, "options"> & { options?: TOptions };
}

/**
 * Defines a slash command with type-safe options.
 *
 * Option types are inferred from the `data.options` array — required options are non-nullable
 * in the handler's `ctx.options`, optional ones include `| undefined`.
 *
 * @example
 * ```ts
 * const ban = defineCommand({
 *   data: {
 *     name: 'ban',
 *     description: 'Ban a member',
 *     options: [
 *       { name: 'user', type: ApplicationCommandOptionType.User, description: 'Target', required: true },
 *     ],
 *   },
 *   handler: async (ctx) => {
 *     ctx.options.user.user.id; // string (Snowflake)
 *   },
 * });
 * ```
 */
export function defineCommand<const TOptions extends readonly APIApplicationCommandBasicOption[] = readonly []>(
	config: DefineCommandConfig<TOptions>,
): CommandDefinition {
	return {
		...config,
		type: DefinitionType.Command,
		data: { ...config.data, options: config.data.options ?? [] },
		handler: config.handler as CommandDefinition["handler"],
	};
}

export function createCommandContext(
	bot: Bot,
	interaction: APIChatInputApplicationCommandInteraction,
	options: Record<string, unknown>,
	collectors: Collectors,
): CommandContext {
	const { context } = createInteractionContext(bot, interaction);
	return Object.assign(context, { interaction, options, ...createCollectorMethods(collectors) });
}

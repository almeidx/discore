import type {
	APIApplicationCommandBasicOption,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import type { CommandContext } from "../types/contexts.ts";
import { DefinitionType, type CommandDefinition } from "../types/definitions.ts";
import type { CommandHooks } from "../types/hooks.ts";
import type { InferOptions } from "../types/options.ts";

export interface DefineCommandConfig<TOptions extends readonly APIApplicationCommandBasicOption[] = readonly []> {
	data: Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, "type" | "options"> & { options?: TOptions };
	hooks?: CommandHooks;
	handler: (ctx: CommandContext<InferOptions<TOptions>>) => void | Promise<void>;
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
 *     ctx.options.user; // string (Snowflake)
 *   },
 * });
 * ```
 */
export function defineCommand<const TOptions extends readonly APIApplicationCommandBasicOption[] = readonly []>(
	config: DefineCommandConfig<TOptions>,
): CommandDefinition {
	return {
		type: DefinitionType.Command,
		data: {
			...config.data,
			options: config.data.options ?? [],
		},
		hooks: config.hooks,
		handler: config.handler as CommandDefinition["handler"],
	};
}

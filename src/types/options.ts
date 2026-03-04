import { ApplicationCommandOptionType } from "discord-api-types/v10";
import type { APIApplicationCommandBasicOption, APIAttachment, Snowflake } from "discord-api-types/v10";

/** Maps each {@link ApplicationCommandOptionType} to its resolved TypeScript type. */
export interface OptionTypeMap {
	[ApplicationCommandOptionType.String]: string;
	[ApplicationCommandOptionType.Integer]: number;
	[ApplicationCommandOptionType.Boolean]: boolean;
	[ApplicationCommandOptionType.User]: Snowflake;
	[ApplicationCommandOptionType.Channel]: Snowflake;
	[ApplicationCommandOptionType.Role]: Snowflake;
	[ApplicationCommandOptionType.Mentionable]: Snowflake;
	[ApplicationCommandOptionType.Number]: number;
	[ApplicationCommandOptionType.Attachment]: APIAttachment;
}

/**
 * Infers a typed options record from a tuple of {@link APIApplicationCommandBasicOption}.
 * Required options are non-nullable; optional ones include `| undefined`.
 */
export type InferOptions<T extends readonly APIApplicationCommandBasicOption[]> = {
	[K in T[number] as K["name"]]: K["required"] extends true
		? OptionTypeMap[K["type"]]
		: OptionTypeMap[K["type"]] | undefined;
};

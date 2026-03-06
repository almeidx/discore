import { ApplicationCommandOptionType } from "discord-api-types/v10";
import type {
	APIApplicationCommandBasicOption,
	APIAttachment,
	APIInteractionDataResolvedChannel,
	APIInteractionDataResolvedGuildMember,
	APIRole,
	APIUser,
} from "discord-api-types/v10";

export interface ResolvedUser {
	user: APIUser;
	member: APIInteractionDataResolvedGuildMember | undefined;
}

/** Maps each {@link ApplicationCommandOptionType} to its resolved TypeScript type. */
export interface OptionTypeMap {
	[ApplicationCommandOptionType.String]: string;
	[ApplicationCommandOptionType.Integer]: number;
	[ApplicationCommandOptionType.Boolean]: boolean;
	[ApplicationCommandOptionType.User]: ResolvedUser;
	[ApplicationCommandOptionType.Channel]: APIInteractionDataResolvedChannel;
	[ApplicationCommandOptionType.Role]: APIRole;
	[ApplicationCommandOptionType.Mentionable]: ResolvedUser | APIRole;
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

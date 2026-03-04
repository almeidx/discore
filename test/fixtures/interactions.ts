import {
	InteractionType,
	ApplicationCommandType,
	ComponentType,
	ApplicationCommandOptionType,
	type APIChatInputApplicationCommandInteraction,
	type APIMessageComponentInteraction,
	type APIModalSubmitInteraction,
	type APIApplicationCommandAutocompleteInteraction,
} from "discord-api-types/v10";

const BASE = {
	id: "111111111111111111",
	application_id: "222222222222222222",
	token: "test-token",
	version: 1,
	app_permissions: "0",
	entitlements: [],
	authorizing_integration_owners: {},
	channel: { id: "333333333333333333", type: 0 },
	channel_id: "333333333333333333",
	locale: "en-US",
	attachment_size_limit: 25_000_000,
};

export function chatInputInteraction(
	name: string,
	options: Array<{ name: string; type: number; value: unknown }> = [],
): APIChatInputApplicationCommandInteraction {
	return {
		...BASE,
		type: InteractionType.ApplicationCommand,
		data: {
			id: "444444444444444444",
			name,
			type: ApplicationCommandType.ChatInput,
			options: options as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- test fixture
			resolved: {},
		},
	} as unknown as APIChatInputApplicationCommandInteraction;
}

export function subcommandInteraction(
	groupName: string,
	subName: string,
	options: Array<{ name: string; type: number; value: unknown }> = [],
): APIChatInputApplicationCommandInteraction {
	return {
		...BASE,
		type: InteractionType.ApplicationCommand,
		data: {
			id: "444444444444444444",
			name: groupName,
			type: ApplicationCommandType.ChatInput,
			options: [
				{
					name: subName,
					type: ApplicationCommandOptionType.Subcommand,
					options,
				},
			] as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- test fixture
			resolved: {},
		},
	} as unknown as APIChatInputApplicationCommandInteraction;
}

export function buttonInteraction(customId: string): APIMessageComponentInteraction {
	return {
		...BASE,
		type: InteractionType.MessageComponent,
		data: {
			custom_id: customId,
			component_type: ComponentType.Button,
		},
		message: {
			id: "555555555555555555",
			channel_id: "333333333333333333",
			author: { id: "666666666666666666", username: "test", discriminator: "0", avatar: null, global_name: null },
			content: "",
			timestamp: "2024-01-01T00:00:00.000Z",
			edited_timestamp: null,
			tts: false,
			mention_everyone: false,
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			pinned: false,
			type: 0,
		},
	} as unknown as APIMessageComponentInteraction;
}

export function selectMenuInteraction(customId: string, values: string[]): APIMessageComponentInteraction {
	return {
		...BASE,
		type: InteractionType.MessageComponent,
		data: {
			custom_id: customId,
			component_type: ComponentType.StringSelect,
			values,
		},
		message: {
			id: "555555555555555555",
			channel_id: "333333333333333333",
			author: { id: "666666666666666666", username: "test", discriminator: "0", avatar: null, global_name: null },
			content: "",
			timestamp: "2024-01-01T00:00:00.000Z",
			edited_timestamp: null,
			tts: false,
			mention_everyone: false,
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			pinned: false,
			type: 0,
		},
	} as unknown as APIMessageComponentInteraction;
}

export function modalSubmitInteraction(
	customId: string,
	fields: Array<{ custom_id: string; value: string }>,
): APIModalSubmitInteraction {
	return {
		...BASE,
		type: InteractionType.ModalSubmit,
		data: {
			custom_id: customId,
			components: fields.map((f) => ({
				type: ComponentType.ActionRow,
				components: [{ type: ComponentType.TextInput, custom_id: f.custom_id, value: f.value }],
			})),
		},
	} as unknown as APIModalSubmitInteraction;
}

export function autocompleteInteraction(
	commandName: string,
	focusedOption: { name: string; value: string | number; type: number },
): APIApplicationCommandAutocompleteInteraction {
	return {
		...BASE,
		type: InteractionType.ApplicationCommandAutocomplete,
		data: {
			id: "444444444444444444",
			name: commandName,
			type: ApplicationCommandType.ChatInput,
			options: [
				{
					...focusedOption,
					focused: true,
				},
			] as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- test fixture
		},
	} as unknown as APIApplicationCommandAutocompleteInteraction;
}

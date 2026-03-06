import type { API, CreateInteractionUpdateMessageResponseOptions } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import type { SelectMenuContext } from "../types/contexts.ts";
import { createInteractionContext } from "./interaction.ts";

export function createSelectMenuContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIMessageComponentInteraction,
	params: Record<string, string>,
): SelectMenuContext {
	const base = createInteractionContext(api, gateway, interaction);

	return {
		...base,
		interaction,
		customId: interaction.data.custom_id,
		params,
		values: "values" in interaction.data ? (interaction.data.values ?? []) : [],

		async update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void> {
			await api.interactions.updateMessage(interaction.id, interaction.token, data);
		},

		async deferUpdate(): Promise<void> {
			await api.interactions.deferMessageUpdate(interaction.id, interaction.token);
		},
	};
}

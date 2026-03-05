import type { API, CreateInteractionUpdateMessageResponseOptions } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import type { ButtonContext } from "../types/contexts.ts";
import { createInteractionContext } from "./interaction.ts";

export function createButtonContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIMessageComponentInteraction,
	params: Record<string, string>,
): ButtonContext {
	const base = createInteractionContext(api, gateway, interaction);

	return {
		...base,
		interaction,
		customId: interaction.data.custom_id,
		params,

		async update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void> {
			await api.interactions.updateMessage(interaction.id, interaction.token, data);
		},
	};
}

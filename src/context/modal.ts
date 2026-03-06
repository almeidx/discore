import type { API, CreateInteractionUpdateMessageResponseOptions } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIModalSubmitInteraction } from "discord-api-types/v10";
import { createModalFields } from "../modal-fields.ts";
import type { ModalContext } from "../types/contexts.ts";
import { createInteractionContext } from "./interaction.ts";

export function createModalContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIModalSubmitInteraction,
	params: Record<string, string>,
): ModalContext {
	const base = createInteractionContext(api, gateway, interaction);

	return {
		...base,
		interaction,
		customId: interaction.data.custom_id,
		params,
		fields: createModalFields(interaction),

		async update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void> {
			await api.interactions.updateMessage(interaction.id, interaction.token, data);
		},

		async deferUpdate(): Promise<void> {
			await api.interactions.deferMessageUpdate(interaction.id, interaction.token);
		},
	};
}

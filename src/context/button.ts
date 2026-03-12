import type { API, CreateInteractionUpdateMessageResponseOptions } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import type { ButtonContext } from "../types/contexts.ts";
import { createManagedInteractionContext } from "./interaction.ts";

export function createButtonContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIMessageComponentInteraction,
	params: Record<string, string>,
): ButtonContext {
	const { context: base, controller } = createManagedInteractionContext(api, gateway, interaction);

	return Object.assign(base, {
		interaction,
		customId: interaction.data.custom_id,
		params,

		async update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void> {
			await api.interactions.updateMessage(interaction.id, interaction.token, data);
			controller.markReplied();
		},

		async deferUpdate(): Promise<void> {
			await api.interactions.deferMessageUpdate(interaction.id, interaction.token);
			controller.markDeferred();
		},
	}) as ButtonContext;
}

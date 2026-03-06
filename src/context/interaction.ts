import type { API } from "@discordjs/core";
import type {
	CreateInteractionResponseOptions,
	CreateInteractionDeferResponseOptions,
	CreateInteractionFollowUpResponseOptions,
	EditInteractionResponseOptions,
	CreateModalResponseOptions,
} from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIInteraction, APIMessage } from "discord-api-types/v10";
import type { InteractionContext } from "../types/contexts.ts";

export function createInteractionContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIInteraction,
): InteractionContext {
	let replied = false;
	let deferred = false;

	return {
		api,
		gateway,
		interaction,

		get replied() {
			return replied;
		},

		get deferred() {
			return deferred;
		},

		async reply(data: CreateInteractionResponseOptions): Promise<void> {
			if (replied) {
				await api.interactions.followUp(interaction.application_id, interaction.token, data);
				return;
			}
			await api.interactions.reply(interaction.id, interaction.token, data);
			replied = true;
		},

		async defer(data?: CreateInteractionDeferResponseOptions): Promise<void> {
			await api.interactions.defer(interaction.id, interaction.token, data);
			deferred = true;
			replied = true;
		},

		async followUp(data: CreateInteractionFollowUpResponseOptions): Promise<APIMessage> {
			return api.interactions.followUp(interaction.application_id, interaction.token, data);
		},

		async editReply(data: EditInteractionResponseOptions): Promise<APIMessage> {
			return api.interactions.editReply(interaction.application_id, interaction.token, data);
		},

		async deleteReply(): Promise<void> {
			await api.interactions.deleteReply(interaction.application_id, interaction.token);
		},

		async fetchReply(): Promise<APIMessage> {
			return api.interactions.getOriginalReply(interaction.application_id, interaction.token);
		},

		async showModal(data: CreateModalResponseOptions): Promise<void> {
			await api.interactions.createModal(interaction.id, interaction.token, data);
			replied = true;
		},
	};
}

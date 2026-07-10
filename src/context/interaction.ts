import type { API } from "@discordjs/core";
import type {
	CreateInteractionResponseOptions,
	CreateInteractionDeferResponseOptions,
	CreateInteractionFollowUpResponseOptions,
	EditInteractionResponseOptions,
	CreateModalResponseOptions,
	CreateInteractionUpdateMessageResponseOptions,
} from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIInteraction, APIMessage } from "discord-api-types/v10";
import type { InteractionCallbackResponse, InteractionContext } from "../types/contexts.ts";

interface InteractionStateController {
	isReplied(): boolean;
	markReplied(): void;
	markDeferred(): void;
	rollback(): void;
}

export interface ManagedInteractionContext {
	context: InteractionContext;
	controller: InteractionStateController;
}

export function createManagedInteractionContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIInteraction,
): ManagedInteractionContext {
	let replied = false;
	let deferred = false;

	const controller: InteractionStateController = {
		isReplied() {
			return replied;
		},

		markReplied() {
			replied = true;
		},

		markDeferred() {
			deferred = true;
			replied = true;
		},

		rollback() {
			replied = false;
			deferred = false;
		},
	};

	async function defer(
		data: CreateInteractionDeferResponseOptions & { with_response: true },
	): Promise<InteractionCallbackResponse>;
	async function defer(data?: CreateInteractionDeferResponseOptions & { with_response?: false }): Promise<undefined>;
	async function defer(data?: CreateInteractionDeferResponseOptions): Promise<InteractionCallbackResponse | undefined>;
	async function defer(data?: CreateInteractionDeferResponseOptions): Promise<InteractionCallbackResponse | undefined> {
		if (replied) {
			throw new Error("Interaction was already acknowledged; defer() must be the first response");
		}
		controller.markDeferred();
		try {
			return await api.interactions.defer(interaction.id, interaction.token, data);
		} catch (error) {
			replied = false;
			deferred = false;
			throw error;
		}
	}

	const context: InteractionContext = {
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
			controller.markReplied();
			try {
				await api.interactions.reply(interaction.id, interaction.token, data);
			} catch (error) {
				replied = false;
				throw error;
			}
		},

		defer,

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
			if (replied) {
				throw new Error("Interaction was already acknowledged; showModal() must be the first response");
			}
			controller.markReplied();
			try {
				await api.interactions.createModal(interaction.id, interaction.token, data);
			} catch (error) {
				replied = false;
				throw error;
			}
		},
	};

	return { context, controller };
}

export function createComponentUpdateMethods(
	api: API,
	interaction: Pick<APIInteraction, "id" | "token">,
	controller: InteractionStateController,
) {
	return {
		async update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void> {
			if (controller.isReplied()) {
				throw new Error("Interaction was already acknowledged; update() must be the first response");
			}
			controller.markReplied();
			try {
				await api.interactions.updateMessage(interaction.id, interaction.token, data);
			} catch (error) {
				controller.rollback();
				throw error;
			}
		},

		async deferUpdate(): Promise<void> {
			if (controller.isReplied()) {
				throw new Error("Interaction was already acknowledged; deferUpdate() must be the first response");
			}
			controller.markDeferred();
			try {
				await api.interactions.deferMessageUpdate(interaction.id, interaction.token);
			} catch (error) {
				controller.rollback();
				throw error;
			}
		},
	};
}

export function createInteractionContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIInteraction,
): InteractionContext {
	return createManagedInteractionContext(api, gateway, interaction).context;
}

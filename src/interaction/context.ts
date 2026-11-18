import type {
	CreateInteractionDeferResponseOptions,
	CreateInteractionFollowUpResponseOptions,
	CreateInteractionResponseOptions,
	CreateModalResponseOptions,
	EditInteractionResponseOptions,
} from "@discordjs/core";
import type {
	APIInteraction,
	APIMessage,
	RESTPostAPIInteractionCallbackWithResponseResult,
} from "discord-api-types/v10";
import { createBaseContext, type BaseContext } from "../base-context.ts";
import type { Bot } from "../bot.ts";

export type InteractionCallbackResponse = RESTPostAPIInteractionCallbackWithResponseResult;

export interface InteractionContext extends BaseContext {
	interaction: APIInteraction;
	replied: boolean;
	deferred: boolean;
	reply(data: CreateInteractionResponseOptions): Promise<void>;
	defer(data: CreateInteractionDeferResponseOptions & { with_response: true }): Promise<InteractionCallbackResponse>;
	defer(data?: CreateInteractionDeferResponseOptions & { with_response?: false }): Promise<undefined>;
	defer(data?: CreateInteractionDeferResponseOptions): Promise<InteractionCallbackResponse | undefined>;
	followUp(data: CreateInteractionFollowUpResponseOptions): Promise<APIMessage>;
	editReply(data: EditInteractionResponseOptions): Promise<APIMessage>;
	deleteReply(): Promise<void>;
	fetchReply(): Promise<APIMessage>;
	showModal(data: CreateModalResponseOptions): Promise<void>;
}

/**
 * Sends the interaction's initial response. Throws if the interaction was already acknowledged;
 * the acknowledged state is rolled back if the request fails.
 */
export type Acknowledge = <T>(method: string, deferred: boolean, send: () => Promise<T>) => Promise<T>;

export interface ManagedInteractionContext {
	context: InteractionContext;
	acknowledge: Acknowledge;
}

export function createInteractionContext(bot: Bot, interaction: APIInteraction): ManagedInteractionContext {
	const { api } = bot;
	let replied = false;
	let deferred = false;

	const acknowledge: Acknowledge = async (method, defers, send) => {
		if (replied) {
			throw new Error(`Interaction was already acknowledged; ${method}() must be the first response`);
		}
		replied = true;
		deferred = defers;
		try {
			return await send();
		} catch (error) {
			replied = false;
			deferred = false;
			throw error;
		}
	};

	async function defer(
		data: CreateInteractionDeferResponseOptions & { with_response: true },
	): Promise<InteractionCallbackResponse>;
	async function defer(data?: CreateInteractionDeferResponseOptions & { with_response?: false }): Promise<undefined>;
	async function defer(data?: CreateInteractionDeferResponseOptions): Promise<InteractionCallbackResponse | undefined>;
	async function defer(data?: CreateInteractionDeferResponseOptions): Promise<InteractionCallbackResponse | undefined> {
		return acknowledge("defer", true, () => api.interactions.defer(interaction.id, interaction.token, data));
	}

	const context: InteractionContext = {
		...createBaseContext(bot),
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
			await acknowledge("reply", false, () => api.interactions.reply(interaction.id, interaction.token, data));
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
			await acknowledge("showModal", false, () =>
				api.interactions.createModal(interaction.id, interaction.token, data),
			);
		},
	};

	return { context, acknowledge };
}

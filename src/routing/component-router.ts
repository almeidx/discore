import type { API, CreateInteractionResponseOptions } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIInteraction, APIMessageComponentInteraction, APIModalSubmitInteraction } from "discord-api-types/v10";
import { ComponentType, MessageFlags } from "discord-api-types/v10";
import { createButtonContext } from "../context/button.ts";
import { createModalContext } from "../context/modal.ts";
import { createSelectMenuContext } from "../context/select-menu.ts";
import type { InteractionContext } from "../types/contexts.ts";
import type { ButtonDefinition, SelectMenuDefinition, ModalDefinition } from "../types/definitions.ts";
import type { GlobalHooks } from "../types/hooks.ts";
import type { ErrorResponseOption } from "./interaction-router.ts";

export interface ComponentRouter {
	handleComponent(api: API, gateway: WebSocketManager, interaction: APIMessageComponentInteraction): Promise<void>;
	handleModal(api: API, gateway: WebSocketManager, interaction: APIModalSubmitInteraction): Promise<void>;
}

export function createComponentRouter(
	buttons: ButtonDefinition[],
	selectMenus: SelectMenuDefinition[],
	modals: ModalDefinition[],
	hooks: GlobalHooks,
	errorResponse: ErrorResponseOption,
): ComponentRouter {
	const defaultErrorResponse: CreateInteractionResponseOptions = {
		content: "Something went wrong.",
		flags: MessageFlags.Ephemeral,
	};

	async function sendErrorResponse(api: API, interaction: APIInteraction, error: unknown): Promise<void> {
		const response = errorResponse === undefined ? defaultErrorResponse : errorResponse;
		if (response === null) return;

		const data = typeof response === "function" ? response({ interaction }, error) : response;

		try {
			await api.interactions.reply(interaction.id, interaction.token, data);
		} catch {
			try {
				await api.interactions.followUp(interaction.application_id, interaction.token, data);
			} catch {
				// exhausted all response methods
			}
		}
	}

	async function runHandler(
		api: API,
		interaction: APIInteraction,
		ctx: InteractionContext,
		handler: () => Promise<void>,
	): Promise<void> {
		try {
			await handler();
		} catch (error) {
			let suppressed = false;
			if (hooks.onError) {
				const result = await hooks.onError(ctx, error);
				if (result === false) suppressed = true;
			}
			if (!suppressed) {
				await sendErrorResponse(api, interaction, error);
			}
		}
	}

	return {
		async handleComponent(api, gateway, interaction) {
			const customId = interaction.data.custom_id;
			const isButton = interaction.data.component_type === ComponentType.Button;

			if (isButton) {
				for (const def of buttons) {
					const match = def.customId.exec(customId);
					if (match) {
						const params = match.groups ?? {};
						const ctx = createButtonContext(api, gateway, interaction, params);
						await runHandler(api, interaction, ctx, () => def.handler(ctx));
					}
				}
			} else {
				for (const def of selectMenus) {
					const match = def.customId.exec(customId);
					if (match) {
						const params = match.groups ?? {};
						const ctx = createSelectMenuContext(api, gateway, interaction, params);
						await runHandler(api, interaction, ctx, () => def.handler(ctx));
					}
				}
			}
		},

		async handleModal(api, gateway, interaction) {
			const customId = interaction.data.custom_id;

			for (const def of modals) {
				const match = def.customId.exec(customId);
				if (match) {
					const params = match.groups ?? {};
					const ctx = createModalContext(api, gateway, interaction, params);
					await runHandler(api, interaction, ctx, () => def.handler(ctx));
				}
			}
		},
	};
}

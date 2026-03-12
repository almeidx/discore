import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIMessageComponentInteraction, APIModalSubmitInteraction } from "discord-api-types/v10";
import { ComponentType } from "discord-api-types/v10";
import { createButtonContext } from "../context/button.ts";
import { createModalContext } from "../context/modal.ts";
import { createSelectMenuContext } from "../context/select-menu.ts";
import type { InteractionContext } from "../types/contexts.ts";
import type { ButtonDefinition, SelectMenuDefinition, ModalDefinition } from "../types/definitions.ts";
import type { GlobalHooks, AnyInteractionContext } from "../types/hooks.ts";
import { sendErrorResponse, runBeforeInteraction, runAfterInteraction, type ErrorResponseOption } from "./shared.ts";

export interface ComponentRouter {
	handleComponent(api: API, gateway: WebSocketManager, interaction: APIMessageComponentInteraction): Promise<void>;
	handleModal(api: API, gateway: WebSocketManager, interaction: APIModalSubmitInteraction): Promise<void>;
}

function matchCustomId(pattern: string | RegExp, customId: string): Record<string, string> | null {
	if (typeof pattern === "string") {
		return pattern === customId ? {} : null;
	}
	pattern.lastIndex = 0;
	const match = pattern.exec(customId);
	return match ? (match.groups ?? {}) : null;
}

export function createComponentRouter(
	buttons: ButtonDefinition[],
	selectMenus: SelectMenuDefinition[],
	modals: ModalDefinition[],
	hooks: GlobalHooks,
	errorResponse: ErrorResponseOption,
): ComponentRouter {
	async function runHandler<TContext extends AnyInteractionContext & InteractionContext>(
		ctx: TContext,
		handler: () => void | Promise<void>,
		onError?: (ctx: TContext, error: unknown) => Promise<boolean | void> | boolean | void,
	): Promise<void> {
		try {
			await handler();
		} catch (error) {
			let suppressed = false;
			if (onError) {
				const result = await onError(ctx, error);
				if (result === false) suppressed = true;
			}
			if (!suppressed && hooks.onError) {
				const result = await hooks.onError(ctx, error);
				if (result === false) suppressed = true;
			}
			if (!suppressed) {
				await sendErrorResponse(errorResponse, ctx, error);
			}
		}
	}

	return {
		async handleComponent(api, gateway, interaction) {
			const customId = interaction.data.custom_id;
			const isButton = interaction.data.component_type === ComponentType.Button;

			if (isButton) {
				for (const def of buttons) {
					const params = matchCustomId(def.customId, customId);
					if (params) {
						const ctx = createButtonContext(api, gateway, interaction, params);
						if (!(await runBeforeInteraction(hooks, ctx))) return;
						await runHandler(ctx, () => def.handler(ctx), def.hooks?.onError);
						await runAfterInteraction(hooks, ctx);
						return;
					}
				}
			} else {
				for (const def of selectMenus) {
					const params = matchCustomId(def.customId, customId);
					if (params) {
						const ctx = createSelectMenuContext(api, gateway, interaction, params);
						if (!(await runBeforeInteraction(hooks, ctx))) return;
						await runHandler(ctx, () => def.handler(ctx), def.hooks?.onError);
						await runAfterInteraction(hooks, ctx);
						return;
					}
				}
			}
		},

		async handleModal(api, gateway, interaction) {
			const customId = interaction.data.custom_id;

			for (const def of modals) {
				const params = matchCustomId(def.customId, customId);
				if (params) {
					const ctx = createModalContext(api, gateway, interaction, params);
					if (!(await runBeforeInteraction(hooks, ctx))) return;
					await runHandler(ctx, () => def.handler(ctx), def.hooks?.onError);
					await runAfterInteraction(hooks, ctx);
					return;
				}
			}
		},
	};
}

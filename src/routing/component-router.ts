import type { API, CreateInteractionResponseOptions } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIMessageComponentInteraction, APIModalSubmitInteraction } from "discord-api-types/v10";
import { ComponentType, MessageFlags } from "discord-api-types/v10";
import { createButtonContext } from "../context/button.ts";
import { createModalContext } from "../context/modal.ts";
import { createSelectMenuContext } from "../context/select-menu.ts";
import type { InteractionContext } from "../types/contexts.ts";
import type { ButtonDefinition, SelectMenuDefinition, ModalDefinition } from "../types/definitions.ts";
import type { GlobalHooks, AnyInteractionContext } from "../types/hooks.ts";
import type { ErrorResponseOption } from "./interaction-router.ts";

export interface ComponentRouter {
	handleComponent(api: API, gateway: WebSocketManager, interaction: APIMessageComponentInteraction): Promise<void>;
	handleModal(api: API, gateway: WebSocketManager, interaction: APIModalSubmitInteraction): Promise<void>;
}

function matchCustomId(pattern: string | RegExp, customId: string): Record<string, string> | null {
	if (typeof pattern === "string") {
		return pattern === customId ? {} : null;
	}
	const match = new RegExp(pattern.source, pattern.flags).exec(customId);
	return match ? (match.groups ?? {}) : null;
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

	async function sendErrorResponse(api: API, ctx: InteractionContext, error: unknown): Promise<void> {
		const response = errorResponse === undefined ? defaultErrorResponse : errorResponse;
		if (response === null) return;

		const data = typeof response === "function" ? response(ctx, error) : response;

		await ctx.reply(data);
	}

	async function runHandler<TContext extends AnyInteractionContext & InteractionContext>(
		api: API,
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
				await sendErrorResponse(api, ctx, error);
			}
		}
	}

	async function runBeforeInteraction(ctx: AnyInteractionContext): Promise<boolean> {
		if (!hooks.beforeInteraction) return true;
		const result = await hooks.beforeInteraction(ctx);
		return result !== false;
	}

	async function runAfterInteraction(ctx: AnyInteractionContext): Promise<void> {
		if (!hooks.afterInteraction) return;
		await hooks.afterInteraction(ctx);
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
						if (!(await runBeforeInteraction(ctx))) return;
						await runHandler(api, ctx, () => def.handler(ctx), def.hooks?.onError);
						await runAfterInteraction(ctx);
						return;
					}
				}
			} else {
				for (const def of selectMenus) {
					const params = matchCustomId(def.customId, customId);
					if (params) {
						const ctx = createSelectMenuContext(api, gateway, interaction, params);
						if (!(await runBeforeInteraction(ctx))) return;
						await runHandler(api, ctx, () => def.handler(ctx), def.hooks?.onError);
						await runAfterInteraction(ctx);
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
					if (!(await runBeforeInteraction(ctx))) return;
					await runHandler(api, ctx, () => def.handler(ctx), def.hooks?.onError);
					await runAfterInteraction(ctx);
					return;
				}
			}
		},
	};
}

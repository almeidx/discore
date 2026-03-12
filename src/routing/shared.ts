import type { CreateInteractionResponseOptions } from "@discordjs/core";
import { MessageFlags } from "discord-api-types/v10";
import type { InteractionContext } from "../types/contexts.ts";
import type { GlobalHooks, AnyInteractionContext } from "../types/hooks.ts";
export type { ErrorResponseOption } from "../types/bot-options.ts";
import type { ErrorResponseOption } from "../types/bot-options.ts";

const defaultErrorResponse: CreateInteractionResponseOptions = {
	content: "Something went wrong.",
	flags: MessageFlags.Ephemeral,
};

export async function sendErrorResponse(
	errorResponse: ErrorResponseOption,
	ctx: InteractionContext,
	error: unknown,
): Promise<void> {
	const response = errorResponse === undefined ? defaultErrorResponse : errorResponse;
	if (response === null) return;

	const data = typeof response === "function" ? response(ctx, error) : response;

	await ctx.reply(data);
}

export async function runBeforeInteraction(hooks: GlobalHooks, ctx: AnyInteractionContext): Promise<boolean> {
	if (!hooks.beforeInteraction) return true;
	return (await hooks.beforeInteraction(ctx)) !== false;
}

export async function runAfterInteraction(hooks: GlobalHooks, ctx: AnyInteractionContext): Promise<void> {
	await hooks.afterInteraction?.(ctx);
}

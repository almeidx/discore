import type { CreateInteractionResponseOptions } from "@discordjs/core";
import { MessageFlags } from "discord-api-types/v10";
import type { AnyInteractionContext, GlobalHooks, MaybePromise } from "../hooks.ts";
import type { InteractionContext } from "./context.ts";

export type ErrorResponseOption =
	| CreateInteractionResponseOptions
	| ((ctx: InteractionContext, error: unknown) => CreateInteractionResponseOptions)
	| null
	| undefined;

const defaultErrorResponse: CreateInteractionResponseOptions = {
	content: "Something went wrong.",
	flags: MessageFlags.Ephemeral,
};

export async function sendErrorResponse(
	option: ErrorResponseOption,
	ctx: InteractionContext,
	error: unknown,
): Promise<void> {
	const response = option === undefined ? defaultErrorResponse : option;
	if (response === null) return;
	await ctx.reply(typeof response === "function" ? response(ctx, error) : response);
}

/** One level of handler hooks below the global hooks; levels are ordered outermost to innermost (handler). */
export interface HookLayer<TContext> {
	before?: ((ctx: TContext) => MaybePromise<boolean | void>) | undefined;
	after?: ((ctx: TContext) => MaybePromise<void>) | undefined;
	onError?: ((ctx: TContext, error: unknown) => MaybePromise<boolean | void>) | undefined;
}

/**
 * Runs an interaction handler between the global interaction hooks.
 * `before` hooks run outermost first and cancel on `false`; `onError` hooks run innermost first, then the
 * global `onError`, and suppress the error on `false`; otherwise `respondToError` answers the user and the
 * error is rethrown.
 */
export async function runInteraction<TContext extends AnyInteractionContext>(
	ctx: TContext,
	hooks: GlobalHooks,
	layers: readonly (HookLayer<TContext> | undefined)[],
	handler: () => MaybePromise<void>,
	respondToError: (error: unknown) => Promise<void>,
): Promise<void> {
	if (hooks.beforeInteraction && (await hooks.beforeInteraction(ctx)) === false) return;

	const innermostFirst = layers.toReversed();
	let handlerRan = false;

	try {
		for (const layer of layers) {
			if (layer?.before && (await layer.before(ctx)) === false) return;
		}
		handlerRan = true;
		await handler();
	} catch (error) {
		for (const layer of innermostFirst) {
			if (layer?.onError && (await layer.onError(ctx, error)) === false) return;
		}
		if (hooks.onError && (await hooks.onError(ctx, error)) === false) return;
		try {
			await respondToError(error);
		} catch {
			// the handler's error is what gets rethrown; a failed fallback response is secondary
		}
		throw error;
	} finally {
		if (handlerRan) {
			for (const layer of innermostFirst) await layer?.after?.(ctx);
		}
		await hooks.afterInteraction?.(ctx);
	}
}

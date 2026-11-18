import type { CreateInteractionResponseOptions } from "@discordjs/core";
import type { AnyCommandContext, CommandHooks } from "../hooks.ts";

export type MissingPermissionsResponseOption =
	| CreateInteractionResponseOptions
	| ((ctx: AnyCommandContext, missing: bigint) => CreateInteractionResponseOptions)
	| null
	| undefined;

/**
 * Checks the bot's permissions in the invoking channel. Every `onMissingBotPermissions` hook runs
 * (outermost first); any returning `true` bypasses the check. Without hooks, `response` is sent.
 */
export async function hasRequiredBotPermissions(
	ctx: AnyCommandContext,
	required: bigint,
	layers: readonly (CommandHooks | undefined)[],
	response: MissingPermissionsResponseOption,
): Promise<boolean> {
	const granted = ctx.interaction.app_permissions;
	if (!required || granted === undefined) return true;

	const missing = required & ~BigInt(granted);
	if (!missing) return true;

	let handledByHook = false;
	let bypass = false;
	for (const layer of layers) {
		if (!layer?.onMissingBotPermissions) continue;
		handledByHook = true;
		if ((await layer.onMissingBotPermissions(ctx, missing)) === true) bypass = true;
	}

	if (bypass) return true;
	if (!handledByHook && response != null) {
		await ctx.reply(typeof response === "function" ? response(ctx, missing) : response);
	}
	return false;
}

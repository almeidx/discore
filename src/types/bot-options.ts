import type { CreateInteractionResponseOptions } from "@discordjs/core";
import type { InteractionContext } from "./contexts.ts";
import type { AnyCommandContext } from "./hooks.ts";

export type ErrorResponseOption =
	| CreateInteractionResponseOptions
	| ((ctx: InteractionContext, error: unknown) => CreateInteractionResponseOptions)
	| null
	| undefined;

export type MissingPermissionsResponseOption =
	| CreateInteractionResponseOptions
	| ((ctx: AnyCommandContext, missing: bigint) => CreateInteractionResponseOptions)
	| null
	| undefined;

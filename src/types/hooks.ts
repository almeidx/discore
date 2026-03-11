import type {
	EventContext,
	InteractionContext,
	ButtonContext,
	SelectMenuContext,
	ModalContext,
	AutocompleteContext,
	UserCommandContext,
	MessageCommandContext,
	CommandContext,
} from "./contexts.ts";

export type AnyInteractionContext =
	| CommandContext
	| ButtonContext
	| SelectMenuContext
	| ModalContext
	| UserCommandContext
	| MessageCommandContext
	| AutocompleteContext;

export type AnyCommandContext = CommandContext | UserCommandContext | MessageCommandContext;

/**
 * Per-handler hooks for component interaction handlers (buttons, select menus, modals).
 */
export interface HandlerHooks<TContext> {
	/** Runs when the handler throws. Return `false` to suppress the default error response. */
	onError?: (ctx: TContext, error: unknown) => Promise<boolean | void> | boolean | void;
}

/**
 * Per-command lifecycle hooks. Both global and per-command hooks run — global first, then per-command.
 */
export interface CommandHooks {
	/** Runs before the handler. Return `false` to cancel execution. */
	beforeCommand?: (ctx: AnyCommandContext) => Promise<boolean | void> | boolean | void;
	/** Runs after the handler completes (even if it threw). */
	afterCommand?: (ctx: AnyCommandContext) => Promise<void> | void;
	/** Runs when the handler throws. Return `false` to suppress the default error response. */
	onError?: (ctx: AnyCommandContext, error: unknown) => Promise<boolean | void> | boolean | void;
	/** Runs when the bot is missing required permissions. Return `true` to bypass and run the command anyway. */
	onMissingBotPermissions?: (ctx: AnyCommandContext, missing: bigint) => Promise<boolean | void> | boolean | void;
}

/**
 * Global lifecycle hooks applied to all interactions and events.
 * For commands, these compose with per-command hooks (global fires first).
 */
export interface GlobalHooks {
	beforeCommand?: (ctx: AnyCommandContext) => Promise<boolean | void> | boolean | void;
	afterCommand?: (ctx: AnyCommandContext) => Promise<void> | void;
	onError?: (ctx: InteractionContext, error: unknown) => Promise<boolean | void> | boolean | void;
	onEventError?: (ctx: EventContext, error: unknown) => Promise<void> | void;
	/** Runs before any interaction handler (commands, components, modals, autocomplete). Return `false` to cancel. */
	beforeInteraction?: (ctx: AnyInteractionContext) => Promise<boolean | void> | boolean | void;
	/** Runs after any interaction handler completes. */
	afterInteraction?: (ctx: AnyInteractionContext) => Promise<void> | void;
	/** Runs when the bot is missing required permissions. Return `true` to bypass and run the command anyway. */
	onMissingBotPermissions?: (ctx: AnyCommandContext, missing: bigint) => Promise<boolean | void> | boolean | void;
}

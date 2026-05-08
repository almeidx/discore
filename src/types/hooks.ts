import type {
	EventContext,
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
	/** Runs when the handler throws. Return `false` after handling the error to skip the default response and prevent rethrow. */
	onError?: (ctx: TContext, error: unknown) => Promise<boolean | void> | boolean | void;
}

/**
 * Per-command lifecycle hooks.
 * before hooks run global, group, then command.
 * after and error hooks run command, group, then global.
 */
export interface CommandHooks {
	/** Runs before the handler. Return `false` to cancel execution. */
	beforeCommand?: (ctx: AnyCommandContext) => Promise<boolean | void> | boolean | void;
	/** Runs after the handler completes (even if it threw). */
	afterCommand?: (ctx: AnyCommandContext) => Promise<void> | void;
	/** Runs when the handler throws. Return `false` after handling the error to skip the default response and prevent rethrow. */
	onError?: (ctx: AnyCommandContext, error: unknown) => Promise<boolean | void> | boolean | void;
	/**
	 * Runs when the bot is missing required permissions.
	 * Missing-permission hooks run global first, then group, then command.
	 * Return `true` to bypass the check and run the command anyway.
	 */
	onMissingBotPermissions?: (ctx: AnyCommandContext, missing: bigint) => Promise<boolean | void> | boolean | void;
}

/**
 * Global lifecycle hooks applied to all interactions and events.
 * For commands, these compose with command and group hooks.
 */
export interface GlobalHooks {
	beforeCommand?: (ctx: AnyCommandContext) => Promise<boolean | void> | boolean | void;
	afterCommand?: (ctx: AnyCommandContext) => Promise<void> | void;
	/** Runs when an interaction handler throws. Return `false` after handling the error to skip the default response and prevent rethrow. */
	onError?: (ctx: AnyInteractionContext, error: unknown) => Promise<boolean | void> | boolean | void;
	onEventError?: (ctx: EventContext, error: unknown) => Promise<void> | void;
	/** Runs before any interaction handler (commands, components, modals, autocomplete). Return `false` to cancel. */
	beforeInteraction?: (ctx: AnyInteractionContext) => Promise<boolean | void> | boolean | void;
	/** Runs after any interaction handler settles, including when it throws. */
	afterInteraction?: (ctx: AnyInteractionContext) => Promise<void> | void;
	/**
	 * Runs when the bot is missing required permissions.
	 * Missing-permission hooks run global first, then group, then command.
	 * Return `true` to bypass the check and run the command anyway.
	 */
	onMissingBotPermissions?: (ctx: AnyCommandContext, missing: bigint) => Promise<boolean | void> | boolean | void;
}

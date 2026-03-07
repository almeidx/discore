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
 * Per-command lifecycle hooks. When set on a command, these override global hooks entirely.
 */
export interface CommandHooks {
	/** Runs before the handler. Return `false` to cancel execution. */
	beforeCommand?: (ctx: AnyCommandContext) => Promise<boolean | void> | boolean | void;
	/** Runs after the handler completes (even if it threw). */
	afterCommand?: (ctx: AnyCommandContext) => Promise<void> | void;
	/** Runs when the handler throws. Return `false` to suppress the default error response. */
	onError?: (ctx: AnyCommandContext, error: unknown) => Promise<boolean | void> | boolean | void;
}

/**
 * Global lifecycle hooks applied to all commands that don't define their own.
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
}

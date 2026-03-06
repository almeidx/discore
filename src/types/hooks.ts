import type {
	CommandContext,
	EventContext,
	InteractionContext,
	ButtonContext,
	SelectMenuContext,
	ModalContext,
	AutocompleteContext,
	UserCommandContext,
	MessageCommandContext,
} from "./contexts.ts";

export type AnyInteractionContext =
	| CommandContext
	| ButtonContext
	| SelectMenuContext
	| ModalContext
	| UserCommandContext
	| MessageCommandContext
	| AutocompleteContext;

/**
 * Per-command lifecycle hooks. When set on a command, these override global hooks entirely.
 */
export interface CommandHooks {
	/** Runs before the handler. Return `false` to cancel execution. */
	beforeCommand?: (ctx: CommandContext) => Promise<boolean | void> | boolean | void;
	/** Runs after the handler completes (even if it threw). */
	afterCommand?: (ctx: CommandContext) => Promise<void> | void;
	/** Runs when the handler throws. Return `false` to suppress the default error response. */
	onError?: (ctx: CommandContext, error: unknown) => Promise<boolean | void> | boolean | void;
}

/**
 * Global lifecycle hooks applied to all commands that don't define their own.
 */
export interface GlobalHooks {
	beforeCommand?: (ctx: CommandContext) => Promise<boolean | void> | boolean | void;
	afterCommand?: (ctx: CommandContext) => Promise<void> | void;
	onError?: (ctx: InteractionContext, error: unknown) => Promise<boolean | void> | boolean | void;
	onEventError?: (ctx: EventContext, error: unknown) => Promise<void> | void;
	/** Runs before any interaction handler (commands, components, modals, autocomplete). Return `false` to cancel. */
	beforeInteraction?: (ctx: AnyInteractionContext) => Promise<boolean | void> | boolean | void;
	/** Runs after any interaction handler completes. */
	afterInteraction?: (ctx: AnyInteractionContext) => Promise<void> | void;
}

import type { AutocompleteContext } from "./autocomplete/autocomplete.ts";
import type { CommandContext } from "./commands/chat-input.ts";
import type { MessageCommandContext, UserCommandContext } from "./commands/context-menu.ts";
import type { ButtonContext } from "./components/button.ts";
import type { ModalContext } from "./components/modal.ts";
import type { SelectMenuContext } from "./components/select-menu.ts";
import type { EventContext } from "./events/event.ts";

export type MaybePromise<T> = Promise<T> | T;

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
 * Per-handler hooks for component, event, and autocomplete handlers.
 */
export interface HandlerHooks<TContext> {
	/** Runs when the handler throws. Return `false` after handling the error to skip the default response and prevent rethrow. For events, returning false marks the error handled and skips the global onEventError hook and rethrow. */
	onError?: (ctx: TContext, error: unknown) => MaybePromise<boolean | void>;
}

/**
 * Per-command lifecycle hooks.
 * before hooks run global, group, then command.
 * after and error hooks run command, group, then global.
 */
export interface CommandHooks {
	/** Runs before the handler. Return `false` to cancel execution. */
	beforeCommand?: (ctx: AnyCommandContext) => MaybePromise<boolean | void>;
	/** Runs after the handler completes (even if it threw). */
	afterCommand?: (ctx: AnyCommandContext) => MaybePromise<void>;
	/** Runs when the handler throws. Return `false` after handling the error to skip the default response and prevent rethrow. */
	onError?: (ctx: AnyCommandContext, error: unknown) => MaybePromise<boolean | void>;
	/**
	 * Runs when the bot is missing required permissions.
	 * Missing-permission hooks run global first, then group, then command.
	 * Return `true` to bypass the check and run the command anyway.
	 */
	onMissingBotPermissions?: (ctx: AnyCommandContext, missing: bigint) => MaybePromise<boolean | void>;
}

/**
 * Global lifecycle hooks applied to all interactions and events.
 * For commands, these compose with command and group hooks.
 */
export interface GlobalHooks extends CommandHooks {
	/** Runs when an interaction handler throws. Return `false` after handling the error to skip the default response and prevent rethrow. */
	onError?: (ctx: AnyInteractionContext, error: unknown) => MaybePromise<boolean | void>;
	onEventError?: (ctx: EventContext, error: unknown) => MaybePromise<void>;
	/** Runs before any interaction handler (commands, components, modals, autocomplete). Return `false` to cancel. */
	beforeInteraction?: (ctx: AnyInteractionContext) => MaybePromise<boolean | void>;
	/** Runs after any interaction handler settles, including when it throws. */
	afterInteraction?: (ctx: AnyInteractionContext) => MaybePromise<void>;
}

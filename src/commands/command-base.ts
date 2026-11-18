import type { CommandHooks } from "../hooks.ts";

/** Members shared by every command kind, including command groups. */
export interface CommandBase {
	requiredBotPermissions?: bigint;
	hooks?: CommandHooks;
}

/** A command that runs a handler: slash commands, subcommands, and context-menu commands. */
export interface ExecutableCommand<TContext> extends CommandBase {
	handler: (ctx: TContext) => void | Promise<void>;
}

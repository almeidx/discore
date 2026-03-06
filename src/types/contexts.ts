import type { API } from "@discordjs/core";
import type {
	CreateInteractionResponseOptions,
	CreateInteractionDeferResponseOptions,
	CreateInteractionFollowUpResponseOptions,
	EditInteractionResponseOptions,
	CreateModalResponseOptions,
	CreateInteractionUpdateMessageResponseOptions,
} from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type {
	APIChatInputApplicationCommandInteraction,
	APIUserApplicationCommandInteraction,
	APIMessageApplicationCommandInteraction,
	APIMessageComponentInteraction,
	APIModalSubmitInteraction,
	APIApplicationCommandAutocompleteInteraction,
	APIInteraction,
	APIApplicationCommandOptionChoice,
	APIMessage,
	APIUser,
	APIInteractionDataResolvedGuildMember,
} from "discord-api-types/v10";
import type { ModalFields } from "../modal-fields.ts";
import type { ComponentInteractionContext } from "./internal.ts";

export interface BaseContext {
	api: API;
	gateway: WebSocketManager;
}

export interface InteractionContext extends BaseContext {
	interaction: APIInteraction;
	replied: boolean;
	deferred: boolean;
	reply(data: CreateInteractionResponseOptions): Promise<void>;
	defer(data?: CreateInteractionDeferResponseOptions): Promise<void>;
	followUp(data: CreateInteractionFollowUpResponseOptions): Promise<APIMessage>;
	editReply(data: EditInteractionResponseOptions): Promise<APIMessage>;
	deleteReply(): Promise<void>;
	fetchReply(): Promise<APIMessage>;
	showModal(data: CreateModalResponseOptions): Promise<void>;
}

/** Options for {@link CommandContext.awaitComponent}. */
export interface AwaitComponentOptions {
	filter: (ctx: ComponentInteractionContext) => boolean;
	timeout: number;
}

/** Options for {@link CommandContext.awaitModal}. */
export interface AwaitModalOptions {
	filter: (ctx: ModalContext) => boolean;
	timeout: number;
}

/** Options for {@link CommandContext.collectComponents}. */
export interface CollectComponentsOptions {
	filter: (ctx: ComponentInteractionContext) => boolean;
	timeout: number;
	max?: number;
	onEnd?: (collected: ComponentInteractionContext[], reason: "timeout" | "max" | "manual") => void;
}

/** Async iterator that yields component interactions. Call {@link stop} to end collection early. */
export interface ComponentCollector extends AsyncIterableIterator<ComponentInteractionContext> {
	stop(): void;
}

/** Context passed to command handlers with typed options and collector methods. */
export interface CommandContext<TOptions = Record<string, unknown>> extends InteractionContext {
	interaction: APIChatInputApplicationCommandInteraction;
	options: TOptions;
	awaitComponent(options: AwaitComponentOptions): Promise<ComponentInteractionContext>;
	awaitModal(options: AwaitModalOptions): Promise<ModalContext>;
	collectComponents(options: CollectComponentsOptions): ComponentCollector;
}

export interface EventContext<TEvent = unknown> extends BaseContext {
	event: TEvent;
	shardId: number;
}

/** Context passed to button interaction handlers. Named capture groups from the regex are in {@link params}. */
export interface ButtonContext extends InteractionContext {
	interaction: APIMessageComponentInteraction;
	customId: string;
	params: Record<string, string>;
	update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void>;
	deferUpdate(): Promise<void>;
}

/** Context passed to select menu interaction handlers. Selected values are in {@link values}. */
export interface SelectMenuContext extends InteractionContext {
	interaction: APIMessageComponentInteraction;
	customId: string;
	params: Record<string, string>;
	values: string[];
	update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void>;
	deferUpdate(): Promise<void>;
}

/** Context passed to modal submission handlers. Access submitted values via {@link fields}. */
export interface ModalContext extends InteractionContext {
	interaction: APIModalSubmitInteraction;
	customId: string;
	params: Record<string, string>;
	fields: ModalFields;
	update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void>;
	deferUpdate(): Promise<void>;
}

export interface UserCommandContext extends InteractionContext {
	interaction: APIUserApplicationCommandInteraction;
	targetUser: APIUser;
	targetMember: APIInteractionDataResolvedGuildMember | undefined;
	awaitComponent(options: AwaitComponentOptions): Promise<ComponentInteractionContext>;
	awaitModal(options: AwaitModalOptions): Promise<ModalContext>;
	collectComponents(options: CollectComponentsOptions): ComponentCollector;
}

export interface MessageCommandContext extends InteractionContext {
	interaction: APIMessageApplicationCommandInteraction;
	targetMessage: APIMessage;
	awaitComponent(options: AwaitComponentOptions): Promise<ComponentInteractionContext>;
	awaitModal(options: AwaitModalOptions): Promise<ModalContext>;
	collectComponents(options: CollectComponentsOptions): ComponentCollector;
}

/** Context passed to autocomplete handlers. */
export interface AutocompleteContext extends BaseContext {
	interaction: APIApplicationCommandAutocompleteInteraction;
	focused: { name: string; value: string | number };
	options: Record<string, unknown>;
	subcommand: string | undefined;
	subcommandGroup: string | undefined;
	respond(choices: APIApplicationCommandOptionChoice[]): Promise<void>;
}

import type { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import { awaitComponent } from "../collectors/await-component.ts";
import { awaitModal } from "../collectors/await-modal.ts";
import { collectComponents } from "../collectors/collect-components.ts";
import type { CollectorStore } from "../collectors/collector-store.ts";
import { parseOptions } from "../options-parser.ts";
import type {
	CommandContext,
	ModalContext,
	AwaitComponentOptions,
	AwaitModalOptions,
	CollectComponentsOptions,
	ComponentCollector,
} from "../types/contexts.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import { createManagedInteractionContext } from "./interaction.ts";

export function createCommandContext(
	bot: Bot,
	interaction: APIChatInputApplicationCommandInteraction,
	collectorStore: CollectorStore<ComponentInteractionContext>,
	modalCollectorStore: CollectorStore<ModalContext>,
): CommandContext {
	const { context: base } = createManagedInteractionContext(bot, interaction);
	const { options } = parseOptions(interaction);

	return Object.assign(base, {
		interaction,
		options,

		awaitComponent(opts: AwaitComponentOptions): Promise<ComponentInteractionContext> {
			return awaitComponent(collectorStore, opts);
		},

		awaitModal(opts: AwaitModalOptions): Promise<ModalContext> {
			return awaitModal(modalCollectorStore, opts);
		},

		collectComponents(opts: CollectComponentsOptions): ComponentCollector {
			return collectComponents(collectorStore, opts);
		},
	}) as CommandContext;
}

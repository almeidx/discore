import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import type {
	CommandContext,
	ModalContext,
	AwaitComponentOptions,
	AwaitModalOptions,
	CollectComponentsOptions,
	ComponentCollector,
} from "../types/contexts.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import type { CollectorStore } from "../collectors/collector-store.ts";
import type { ModalCollectorStore } from "../collectors/modal-collector-store.ts";
import { createInteractionContext } from "./interaction.ts";
import { parseOptions } from "../options-parser.ts";
import { awaitComponent } from "../collectors/await-component.ts";
import { awaitModal } from "../collectors/await-modal.ts";
import { collectComponents } from "../collectors/collect-components.ts";

export function createCommandContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIChatInputApplicationCommandInteraction,
	collectorStore: CollectorStore,
	modalCollectorStore: ModalCollectorStore,
): CommandContext {
	const base = createInteractionContext(api, gateway, interaction);
	const { options } = parseOptions(interaction);

	return {
		...base,
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
	};
}

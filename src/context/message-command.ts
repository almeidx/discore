import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIMessageApplicationCommandInteraction } from "discord-api-types/v10";
import { awaitComponent } from "../collectors/await-component.ts";
import { awaitModal } from "../collectors/await-modal.ts";
import { collectComponents } from "../collectors/collect-components.ts";
import type { CollectorStore } from "../collectors/collector-store.ts";
import type {
	MessageCommandContext,
	ModalContext,
	AwaitComponentOptions,
	AwaitModalOptions,
	CollectComponentsOptions,
	ComponentCollector,
} from "../types/contexts.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import { createManagedInteractionContext } from "./interaction.ts";

export function createMessageCommandContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIMessageApplicationCommandInteraction,
	collectorStore: CollectorStore<ComponentInteractionContext>,
	modalCollectorStore: CollectorStore<ModalContext>,
): MessageCommandContext {
	const { context: base } = createManagedInteractionContext(api, gateway, interaction);
	const targetId = interaction.data.target_id;
	const targetMessage = interaction.data.resolved.messages[targetId]!;

	return Object.assign(base, {
		interaction,
		targetMessage,

		awaitComponent(opts: AwaitComponentOptions): Promise<ComponentInteractionContext> {
			return awaitComponent(collectorStore, opts);
		},

		awaitModal(opts: AwaitModalOptions): Promise<ModalContext> {
			return awaitModal(modalCollectorStore, opts);
		},

		collectComponents(opts: CollectComponentsOptions): ComponentCollector {
			return collectComponents(collectorStore, opts);
		},
	}) as MessageCommandContext;
}

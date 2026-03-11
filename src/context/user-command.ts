import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIUserApplicationCommandInteraction } from "discord-api-types/v10";
import { awaitComponent } from "../collectors/await-component.ts";
import { awaitModal } from "../collectors/await-modal.ts";
import { collectComponents } from "../collectors/collect-components.ts";
import type { CollectorStore } from "../collectors/collector-store.ts";
import type { ModalCollectorStore } from "../collectors/modal-collector-store.ts";
import type {
	UserCommandContext,
	ModalContext,
	AwaitComponentOptions,
	AwaitModalOptions,
	CollectComponentsOptions,
	ComponentCollector,
} from "../types/contexts.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import { createManagedInteractionContext } from "./interaction.ts";

export function createUserCommandContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIUserApplicationCommandInteraction,
	collectorStore: CollectorStore,
	modalCollectorStore: ModalCollectorStore,
): UserCommandContext {
	const { context: base } = createManagedInteractionContext(api, gateway, interaction);
	const targetId = interaction.data.target_id;
	const targetUser = interaction.data.resolved.users[targetId]!;
	const targetMember = interaction.data.resolved.members?.[targetId];

	return Object.assign(Object.create(base), {
		interaction,
		targetUser,
		targetMember,

		awaitComponent(opts: AwaitComponentOptions): Promise<ComponentInteractionContext> {
			return awaitComponent(collectorStore, opts);
		},

		awaitModal(opts: AwaitModalOptions): Promise<ModalContext> {
			return awaitModal(modalCollectorStore, opts);
		},

		collectComponents(opts: CollectComponentsOptions): ComponentCollector {
			return collectComponents(collectorStore, opts);
		},
	}) as UserCommandContext;
}

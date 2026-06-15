import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIModalSubmitInteraction } from "discord-api-types/v10";
import { createModalFields } from "../modal-fields.ts";
import type { ModalContext } from "../types/contexts.ts";
import { createComponentUpdateMethods, createManagedInteractionContext } from "./interaction.ts";

export function createModalContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIModalSubmitInteraction,
	params: Record<string, string>,
): ModalContext {
	const { context: base, controller } = createManagedInteractionContext(api, gateway, interaction);

	return Object.assign(base, {
		interaction,
		customId: interaction.data.custom_id,
		params,
		fields: createModalFields(interaction),
		...createComponentUpdateMethods(api, interaction, controller),
	}) as ModalContext;
}

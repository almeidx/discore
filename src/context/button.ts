import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import type { ButtonContext } from "../types/contexts.ts";
import { createComponentUpdateMethods, createManagedInteractionContext } from "./interaction.ts";

export function createButtonContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIMessageComponentInteraction,
	params: Record<string, string>,
): ButtonContext {
	const { context: base, controller } = createManagedInteractionContext(api, gateway, interaction);

	return Object.assign(base, {
		interaction,
		customId: interaction.data.custom_id,
		params,
		...createComponentUpdateMethods(api, interaction, controller),
	}) as ButtonContext;
}

import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import type { SelectMenuContext } from "../types/contexts.ts";
import { createInteractionContext } from "./interaction.ts";

export function createSelectMenuContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIMessageComponentInteraction,
	params: Record<string, string>,
): SelectMenuContext {
	const base = createInteractionContext(api, gateway, interaction);

	return {
		...base,
		interaction,
		customId: interaction.data.custom_id,
		params,
		values: "values" in interaction.data ? (interaction.data.values ?? []) : [],
	};
}

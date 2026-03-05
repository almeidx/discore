import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIMessageApplicationCommandInteraction } from "discord-api-types/v10";
import type { MessageCommandContext } from "../types/contexts.ts";
import { createInteractionContext } from "./interaction.ts";

export function createMessageCommandContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIMessageApplicationCommandInteraction,
): MessageCommandContext {
	const base = createInteractionContext(api, gateway, interaction);
	const targetId = interaction.data.target_id;
	const targetMessage = interaction.data.resolved.messages[targetId]!;

	return {
		...base,
		interaction,
		targetMessage,
	};
}

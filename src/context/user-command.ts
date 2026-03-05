import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIUserApplicationCommandInteraction } from "discord-api-types/v10";
import type { UserCommandContext } from "../types/contexts.ts";
import { createInteractionContext } from "./interaction.ts";

export function createUserCommandContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIUserApplicationCommandInteraction,
): UserCommandContext {
	const base = createInteractionContext(api, gateway, interaction);
	const targetId = interaction.data.target_id;
	const targetUser = interaction.data.resolved.users[targetId]!;
	const targetMember = interaction.data.resolved.members?.[targetId];

	return {
		...base,
		interaction,
		targetUser,
		targetMember,
	};
}

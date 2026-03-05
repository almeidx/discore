import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { APIMessageComponentInteraction, APIModalSubmitInteraction } from "discord-api-types/v10";
import { ComponentType } from "discord-api-types/v10";
import { createButtonContext } from "../context/button.ts";
import { createModalContext } from "../context/modal.ts";
import { createSelectMenuContext } from "../context/select-menu.ts";
import type { ButtonDefinition, SelectMenuDefinition, ModalDefinition } from "../types/definitions.ts";

export interface ComponentRouter {
	handleComponent(api: API, gateway: WebSocketManager, interaction: APIMessageComponentInteraction): Promise<void>;
	handleModal(api: API, gateway: WebSocketManager, interaction: APIModalSubmitInteraction): Promise<void>;
}

export function createComponentRouter(
	buttons: ButtonDefinition[],
	selectMenus: SelectMenuDefinition[],
	modals: ModalDefinition[],
): ComponentRouter {
	return {
		async handleComponent(api, gateway, interaction) {
			const customId = interaction.data.custom_id;
			const isButton = interaction.data.component_type === ComponentType.Button;

			if (isButton) {
				for (const def of buttons) {
					const match = def.customId.exec(customId);
					if (match) {
						const params = match.groups ?? {};
						const ctx = createButtonContext(api, gateway, interaction, params);
						await def.handler(ctx);
					}
				}
			} else {
				for (const def of selectMenus) {
					const match = def.customId.exec(customId);
					if (match) {
						const params = match.groups ?? {};
						const ctx = createSelectMenuContext(api, gateway, interaction, params);
						await def.handler(ctx);
					}
				}
			}
		},

		async handleModal(api, gateway, interaction) {
			const customId = interaction.data.custom_id;

			for (const def of modals) {
				const match = def.customId.exec(customId);
				if (match) {
					const params = match.groups ?? {};
					const ctx = createModalContext(api, gateway, interaction, params);
					await def.handler(ctx);
				}
			}
		},
	};
}

import type { APIModalSubmitInteraction } from "discord-api-types/v10";
import { ComponentType } from "discord-api-types/v10";

/** Typed accessor for modal submission field values. */
export interface ModalFields {
	/** Returns the field value, or `undefined` if not present. */
	get(customId: string): string | undefined;
	/** Returns the field value, or throws if not present. */
	getRequired(customId: string): string;
}

export function createModalFields(interaction: APIModalSubmitInteraction): ModalFields {
	const fieldMap = new Map<string, string>();

	for (const component of interaction.data.components) {
		if (component.type === ComponentType.ActionRow) {
			for (const child of component.components) {
				fieldMap.set(child.custom_id, child.value);
			}
		}
	}

	return {
		get(customId: string): string | undefined {
			return fieldMap.get(customId);
		},
		getRequired(customId: string): string {
			const value = fieldMap.get(customId);
			if (value === undefined) {
				throw new Error(`Required modal field "${customId}" not found`);
			}
			return value;
		},
	};
}

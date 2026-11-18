import {
	ComponentType,
	type APIMessageComponentInteraction,
	type APIModalSubmitInteraction,
} from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import type { CollectorStore } from "../collectors/collector-store.ts";
import type { Collectors } from "../collectors/collectors.ts";
import { DefinitionType } from "../definition-type.ts";
import type { GlobalHooks } from "../hooks.ts";
import { runInteraction, sendErrorResponse, type ErrorResponseOption } from "../interaction/pipeline.ts";
import { removeItem } from "../remove-item.ts";
import { createButtonContext, type ButtonContext, type ButtonDefinition } from "./button.ts";
import type { CustomIdHandler } from "./context.ts";
import { createModalContext, type ModalContext, type ModalDefinition } from "./modal.ts";
import { createSelectMenuContext, type SelectMenuContext, type SelectMenuDefinition } from "./select-menu.ts";

export type ComponentDefinition = ButtonDefinition | SelectMenuDefinition | ModalDefinition;

export interface ComponentRouter {
	add(def: ComponentDefinition): void;
	remove(def: ComponentDefinition): boolean;
	handleComponent(interaction: APIMessageComponentInteraction): Promise<void>;
	handleModal(interaction: APIModalSubmitInteraction): Promise<void>;
}

function matchCustomId(pattern: string | RegExp, customId: string): Record<string, string> | null {
	if (typeof pattern === "string") {
		return pattern === customId ? {} : null;
	}
	pattern.lastIndex = 0;
	const match = pattern.exec(customId);
	return match ? (match.groups ?? {}) : null;
}

export function createComponentRouter(config: {
	bot: Bot;
	hooks: GlobalHooks;
	collectors: Collectors;
	errorResponse: ErrorResponseOption;
}): ComponentRouter {
	const { bot, hooks, collectors, errorResponse } = config;
	const definitions = {
		[DefinitionType.Button]: [] as ButtonDefinition[],
		[DefinitionType.SelectMenu]: [] as SelectMenuDefinition[],
		[DefinitionType.Modal]: [] as ModalDefinition[],
	};

	async function route<TContext extends ButtonContext | SelectMenuContext | ModalContext>(
		createContext: (params: Record<string, string>) => TContext,
		collector: Pick<CollectorStore<TContext>, "dispatch">,
		handlers: readonly CustomIdHandler<TContext>[],
		customId: string,
	): Promise<void> {
		if (collector.dispatch(createContext({}))) return;

		for (const def of handlers) {
			const params = matchCustomId(def.customId, customId);
			if (!params) continue;

			const ctx = createContext(params);
			await runInteraction(
				ctx,
				hooks,
				[def.hooks],
				() => def.handler(ctx),
				(error) => sendErrorResponse(errorResponse, ctx, error),
			);
			return;
		}
	}

	return {
		add(def) {
			(definitions[def.type] as ComponentDefinition[]).push(def);
		},

		remove(def) {
			return removeItem<ComponentDefinition>(definitions[def.type], def);
		},

		async handleComponent(interaction) {
			const customId = interaction.data.custom_id;
			if (interaction.data.component_type === ComponentType.Button) {
				await route(
					(params) => createButtonContext(bot, interaction, params),
					collectors.components,
					definitions[DefinitionType.Button],
					customId,
				);
			} else {
				await route(
					(params) => createSelectMenuContext(bot, interaction, params),
					collectors.components,
					definitions[DefinitionType.SelectMenu],
					customId,
				);
			}
		},

		async handleModal(interaction) {
			await route(
				(params) => createModalContext(bot, interaction, params),
				collectors.modals,
				definitions[DefinitionType.Modal],
				interaction.data.custom_id,
			);
		},
	};
}

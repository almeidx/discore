import type { AwaitComponentOptions } from "../types/contexts.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import { awaitFromStore } from "./await-from-store.ts";
import type { CollectorStore } from "./collector-store.ts";

export function awaitComponent(
	store: CollectorStore<ComponentInteractionContext>,
	options: AwaitComponentOptions,
): Promise<ComponentInteractionContext> {
	return awaitFromStore(store, options);
}

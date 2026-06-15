import type { AwaitModalOptions, ModalContext } from "../types/contexts.ts";
import { awaitFromStore } from "./await-from-store.ts";
import type { CollectorStore } from "./collector-store.ts";

export function awaitModal(store: CollectorStore<ModalContext>, options: AwaitModalOptions): Promise<ModalContext> {
	return awaitFromStore(store, options);
}

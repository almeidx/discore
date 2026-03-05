import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createComponentRouter } from "../../src/routing/component-router.ts";
import type { ButtonContext, SelectMenuContext, ModalContext } from "../../src/types/contexts.ts";
import {
	DefinitionType,
	type ButtonDefinition,
	type SelectMenuDefinition,
	type ModalDefinition,
} from "../../src/types/definitions.ts";
import { buttonInteraction, selectMenuInteraction, modalSubmitInteraction } from "../fixtures/interactions.ts";
import { createMockAPI } from "../fixtures/mock-api.ts";

describe("createComponentRouter", () => {
	it("matches button by regex and extracts params", async () => {
		const handler = mock.fn<(ctx: ButtonContext) => Promise<void>>(async () => {});
		const buttons: ButtonDefinition[] = [{ type: DefinitionType.Button, customId: /^verify:(?<userId>\d+)$/, handler }];

		const router = createComponentRouter(buttons, [], []);
		const api = createMockAPI();

		await router.handleComponent(api, {} as any, buttonInteraction("verify:12345"));

		assert.strictEqual(handler.mock.callCount(), 1);
		const ctx = handler.mock.calls[0]!.arguments[0];
		assert.strictEqual(ctx.params.userId, "12345");
		assert.strictEqual(ctx.customId, "verify:12345");
	});

	it("does not match non-matching button", async () => {
		const handler = mock.fn<(ctx: ButtonContext) => Promise<void>>(async () => {});
		const buttons: ButtonDefinition[] = [{ type: DefinitionType.Button, customId: /^verify:/, handler }];

		const router = createComponentRouter(buttons, [], []);
		await router.handleComponent(createMockAPI(), {} as any, buttonInteraction("other:123"));

		assert.strictEqual(handler.mock.callCount(), 0);
	});

	it("matches select menu and provides values", async () => {
		const handler = mock.fn<(ctx: SelectMenuContext) => Promise<void>>(async () => {});
		const selects: SelectMenuDefinition[] = [
			{ type: DefinitionType.SelectMenu, customId: /^role-select:(?<panel>\w+)$/, handler },
		];

		const router = createComponentRouter([], selects, []);
		await router.handleComponent(
			createMockAPI(),
			{} as any,
			selectMenuInteraction("role-select:main", ["role1", "role2"]),
		);

		assert.strictEqual(handler.mock.callCount(), 1);
		const ctx = handler.mock.calls[0]!.arguments[0];
		assert.strictEqual(ctx.params.panel, "main");
		assert.deepStrictEqual(ctx.values, ["role1", "role2"]);
	});

	it("matches modal by regex", async () => {
		const handler = mock.fn<(ctx: ModalContext) => Promise<void>>(async () => {});
		const modals: ModalDefinition[] = [{ type: DefinitionType.Modal, customId: /^feedback:(?<type>\w+)$/, handler }];

		const router = createComponentRouter([], [], modals);
		await router.handleModal(
			createMockAPI(),
			{} as any,
			modalSubmitInteraction("feedback:bug", [{ custom_id: "desc", value: "It broke" }]),
		);

		assert.strictEqual(handler.mock.callCount(), 1);
		const ctx = handler.mock.calls[0]!.arguments[0];
		assert.strictEqual(ctx.params.type, "bug");
		assert.strictEqual(ctx.fields.getRequired("desc"), "It broke");
	});

	it("broadcasts to all matching handlers", async () => {
		const handler1 = mock.fn<(ctx: ButtonContext) => Promise<void>>(async () => {});
		const handler2 = mock.fn<(ctx: ButtonContext) => Promise<void>>(async () => {});
		const buttons: ButtonDefinition[] = [
			{ type: DefinitionType.Button, customId: /^verify:/, handler: handler1 },
			{ type: DefinitionType.Button, customId: /^verify:\d+$/, handler: handler2 },
		];

		const router = createComponentRouter(buttons, [], []);
		await router.handleComponent(createMockAPI(), {} as any, buttonInteraction("verify:123"));

		assert.strictEqual(handler1.mock.callCount(), 1);
		assert.strictEqual(handler2.mock.callCount(), 1);
	});
});

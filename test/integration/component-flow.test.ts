import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
	defineButton,
	defineModal,
	defineSelectMenu,
	type AnyInteractionContext,
	isButton,
	isModal,
	type ButtonContext,
	type ButtonDefinition,
	type GlobalHooks,
	type ModalContext,
	type SelectMenuContext,
} from "../../src/index.ts";
import { buttonInteraction, modalSubmitInteraction, selectMenuInteraction } from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

type GlobalOnError = NonNullable<GlobalHooks["onError"]>;

function buttonHandler() {
	return mock.fn<(ctx: ButtonContext) => Promise<void>>(async () => {});
}

function failingButton(customId: string, error: Error, hooks?: ButtonDefinition["hooks"]) {
	return defineButton({
		customId,
		hooks,
		handler: async () => {
			throw error;
		},
	});
}

describe("component routing", () => {
	it("routes a button by regex and exposes named groups as params", async () => {
		const handler = buttonHandler();
		const { interact } = createTestBot({
			interactions: [defineButton({ customId: /^verify:(?<userId>\d+)$/, handler })],
		});

		await interact(buttonInteraction("verify:12345"));

		assert.strictEqual(handler.mock.callCount(), 1);
		const ctx = handler.mock.calls[0]!.arguments[0];
		assert.deepStrictEqual({ ...ctx.params }, { userId: "12345" });
		assert.strictEqual(ctx.customId, "verify:12345");
	});

	it("routes a string customId only on an exact match", async () => {
		const handler = buttonHandler();
		const { interact } = createTestBot({ interactions: [defineButton({ customId: "confirm", handler })] });

		await interact(buttonInteraction("confirm:1"));
		await interact(buttonInteraction("confirm"));

		assert.strictEqual(handler.mock.callCount(), 1);
		const ctx = handler.mock.calls[0]!.arguments[0];
		assert.strictEqual(ctx.customId, "confirm");
		assert.deepStrictEqual({ ...ctx.params }, {});
	});

	it("does not route a button whose customId does not match", async () => {
		const handler = buttonHandler();
		const { interact } = createTestBot({ interactions: [defineButton({ customId: /^verify:/, handler })] });

		await interact(buttonInteraction("other:123"));

		assert.strictEqual(handler.mock.callCount(), 0);
	});

	it("matches a global-flag regex on every interaction", async () => {
		const handler = buttonHandler();
		const { interact } = createTestBot({ interactions: [defineButton({ customId: /^verify:\d+$/g, handler })] });

		await interact(buttonInteraction("verify:123"));
		await interact(buttonInteraction("verify:123"));

		assert.strictEqual(handler.mock.callCount(), 2);
	});

	it("runs only the first matching handler", async () => {
		const first = buttonHandler();
		const second = buttonHandler();
		const { interact } = createTestBot({
			interactions: [
				defineButton({ customId: /^verify:/, handler: first }),
				defineButton({ customId: /^verify:\d+$/, handler: second }),
			],
		});

		await interact(buttonInteraction("verify:123"));

		assert.strictEqual(first.mock.callCount(), 1);
		assert.strictEqual(second.mock.callCount(), 0);
	});

	it("routes a select menu to select handlers with its params and values", async () => {
		const button = buttonHandler();
		const select = mock.fn<(ctx: SelectMenuContext) => Promise<void>>(async () => {});
		const { interact } = createTestBot({
			interactions: [
				defineButton({ customId: /^role-select:/, handler: button }),
				defineSelectMenu({ customId: /^role-select:(?<panel>\w+)$/, handler: select }),
			],
		});

		await interact(selectMenuInteraction("role-select:main", ["role1", "role2"]));

		assert.strictEqual(button.mock.callCount(), 0);
		assert.strictEqual(select.mock.callCount(), 1);
		const ctx = select.mock.calls[0]!.arguments[0];
		assert.deepStrictEqual({ ...ctx.params }, { panel: "main" });
		assert.deepStrictEqual(ctx.values, ["role1", "role2"]);
	});

	it("routes a modal submission to modal handlers with its params", async () => {
		const button = buttonHandler();
		const modal = mock.fn<(ctx: ModalContext) => Promise<void>>(async () => {});
		const { interact } = createTestBot({
			interactions: [
				defineButton({ customId: /^feedback:/, handler: button }),
				defineModal({ customId: /^feedback:(?<type>\w+)$/, handler: modal }),
			],
		});

		await interact(modalSubmitInteraction("feedback:bug", [{ custom_id: "desc", value: "It broke" }]));

		assert.strictEqual(button.mock.callCount(), 0);
		assert.strictEqual(modal.mock.callCount(), 1);
		const ctx = modal.mock.calls[0]!.arguments[0];
		assert.strictEqual(ctx.customId, "feedback:bug");
		assert.deepStrictEqual({ ...ctx.params }, { type: "bug" });
	});
});

describe("component error handling", () => {
	it("runs the component onError before the global onError", async () => {
		const error = new Error("button failed");
		const calls: string[] = [];
		const onError = mock.fn<GlobalOnError>(async () => {
			calls.push("global");
			return false;
		});
		const { api, interact } = createTestBot({
			hooks: { onError },
			interactions: [
				failingButton("fail", error, {
					onError: () => {
						calls.push("component");
					},
				}),
			],
		});

		await interact(buttonInteraction("fail"));

		assert.deepStrictEqual(calls, ["component", "global"]);
		const [ctx, received] = onError.mock.calls[0]!.arguments;
		assert.ok(isButton(ctx));
		assert.strictEqual(ctx.customId, "fail");
		assert.strictEqual(received, error);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
	});

	it("skips the global onError and the error response when the component onError returns false", async () => {
		const onError = mock.fn<GlobalOnError>(async () => {});
		const { api, interact } = createTestBot({
			hooks: { onError },
			interactions: [failingButton("fail", new Error("button failed"), { onError: () => false })],
		});

		await interact(buttonInteraction("fail"));

		assert.strictEqual(onError.mock.callCount(), 0);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
	});

	it("sends the default error response and rethrows when no onError suppresses the error", async () => {
		const error = new Error("button failed");
		const onError = mock.fn<GlobalOnError>(async () => {});
		const { api, interact } = createTestBot({ hooks: { onError }, interactions: [failingButton("fail", error)] });

		await assert.rejects(interact(buttonInteraction("fail")), (thrown) => thrown === error);

		assert.strictEqual(onError.mock.callCount(), 1);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
	});

	it("sends no error response when errorResponse is null but still runs afterInteraction", async () => {
		const afterInteraction = mock.fn<(ctx: AnyInteractionContext) => Promise<void>>(async () => {});
		const { api, interact } = createTestBot({
			errorResponse: null,
			hooks: { afterInteraction },
			interactions: [failingButton("fail", new Error("button failed"))],
		});

		await assert.rejects(interact(buttonInteraction("fail")), { message: "button failed" });

		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
		assert.strictEqual(afterInteraction.mock.callCount(), 1);
	});

	it("does not fall through to the next matching handler when the first one throws", async () => {
		const second = buttonHandler();
		const { interact } = createTestBot({
			errorResponse: null,
			interactions: [
				failingButton("test", new Error("first fails")),
				defineButton({ customId: "test", handler: second }),
			],
		});

		await assert.rejects(interact(buttonInteraction("test")), { message: "first fails" });

		assert.strictEqual(second.mock.callCount(), 0);
	});

	it("passes modal handler errors to the global onError", async () => {
		const error = new Error("modal failed");
		const onError = mock.fn<GlobalOnError>(async () => false);
		const { interact } = createTestBot({
			hooks: { onError },
			interactions: [
				defineModal({
					customId: "fail",
					handler: async () => {
						throw error;
					},
				}),
			],
		});

		await interact(modalSubmitInteraction("fail", []));

		assert.strictEqual(onError.mock.callCount(), 1);
		const [ctx, received] = onError.mock.calls[0]!.arguments;
		assert.ok(isModal(ctx));
		assert.strictEqual(ctx.customId, "fail");
		assert.strictEqual(received, error);
	});
});

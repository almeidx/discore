import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineModal, type ModalFields } from "../../src/index.ts";
import { modalSubmitInteraction } from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

async function submitFields(fields: { custom_id: string; value: string }[]): Promise<ModalFields> {
	let received: ModalFields | undefined;
	const { interact } = createTestBot({
		interactions: [
			defineModal({
				customId: "feedback",
				handler: (ctx) => {
					received = ctx.fields;
				},
			}),
		],
	});

	await interact(modalSubmitInteraction("feedback", fields));

	assert.ok(received);
	return received;
}

describe("modal fields", () => {
	it("get returns submitted values by custom_id and undefined for missing fields", async () => {
		const fields = await submitFields([
			{ custom_id: "title", value: "Bug Report" },
			{ custom_id: "description", value: "It broke" },
		]);

		assert.strictEqual(fields.get("title"), "Bug Report");
		assert.strictEqual(fields.get("description"), "It broke");
		assert.strictEqual(fields.get("nonexistent"), undefined);
	});

	it("getRequired returns the value of a submitted field", async () => {
		const fields = await submitFields([{ custom_id: "name", value: "hello" }]);

		assert.strictEqual(fields.getRequired("name"), "hello");
	});

	it("getRequired throws for a missing field", async () => {
		const fields = await submitFields([]);

		assert.throws(() => fields.getRequired("missing"), { message: 'Required modal field "missing" not found' });
	});
});

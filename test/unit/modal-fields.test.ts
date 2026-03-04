import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createModalFields } from "../../src/modal-fields.ts";
import { modalSubmitInteraction } from "../fixtures/interactions.ts";

describe("createModalFields", () => {
	it("extracts field values by custom_id", () => {
		const interaction = modalSubmitInteraction("feedback:bug", [
			{ custom_id: "title", value: "Bug Report" },
			{ custom_id: "description", value: "It broke" },
		]);

		const fields = createModalFields(interaction);

		assert.strictEqual(fields.get("title"), "Bug Report");
		assert.strictEqual(fields.get("description"), "It broke");
		assert.strictEqual(fields.get("nonexistent"), undefined);
	});

	it("getRequired throws for missing field", () => {
		const interaction = modalSubmitInteraction("test", []);
		const fields = createModalFields(interaction);

		assert.throws(() => fields.getRequired("missing"), {
			message: 'Required modal field "missing" not found',
		});
	});

	it("getRequired returns value for existing field", () => {
		const interaction = modalSubmitInteraction("test", [{ custom_id: "name", value: "hello" }]);
		const fields = createModalFields(interaction);

		assert.strictEqual(fields.getRequired("name"), "hello");
	});
});

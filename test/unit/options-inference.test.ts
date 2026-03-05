import { describe, it } from "node:test";
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import type { Snowflake, APIAttachment } from "discord-api-types/v10";
import { defineCommand } from "../../src/definitions/command.ts";

describe("options type inference", () => {
	it("infers required string option", () => {
		defineCommand({
			data: {
				name: "test",
				description: "test",
				options: [
					{ name: "name", type: ApplicationCommandOptionType.String, description: "n", required: true },
				] as const,
			},
			handler: async (ctx) => {
				const _val: string = ctx.options.name;
				// @ts-expect-error -- required string is not undefined
				const _bad: undefined = ctx.options.name;
			},
		});
	});

	it("infers optional string option", () => {
		defineCommand({
			data: {
				name: "test",
				description: "test",
				options: [
					{ name: "name", type: ApplicationCommandOptionType.String, description: "n", required: false },
				] as const,
			},
			handler: async (ctx) => {
				const _val: string | undefined = ctx.options.name;
			},
		});
	});

	it("infers user option as Snowflake", () => {
		defineCommand({
			data: {
				name: "test",
				description: "test",
				options: [{ name: "user", type: ApplicationCommandOptionType.User, description: "u", required: true }] as const,
			},
			handler: async (ctx) => {
				const _val: Snowflake = ctx.options.user;
				// @ts-expect-error -- Snowflake is string, not number
				const _bad: number = ctx.options.user;
			},
		});
	});

	it("infers integer option as number", () => {
		defineCommand({
			data: {
				name: "test",
				description: "test",
				options: [
					{ name: "count", type: ApplicationCommandOptionType.Integer, description: "c", required: true },
				] as const,
			},
			handler: async (ctx) => {
				const _val: number = ctx.options.count;
			},
		});
	});

	it("infers boolean option", () => {
		defineCommand({
			data: {
				name: "test",
				description: "test",
				options: [
					{ name: "flag", type: ApplicationCommandOptionType.Boolean, description: "f", required: true },
				] as const,
			},
			handler: async (ctx) => {
				const _val: boolean = ctx.options.flag;
			},
		});
	});

	it("infers attachment option", () => {
		defineCommand({
			data: {
				name: "test",
				description: "test",
				options: [
					{ name: "file", type: ApplicationCommandOptionType.Attachment, description: "f", required: true },
				] as const,
			},
			handler: async (ctx) => {
				const _val: APIAttachment = ctx.options.file;
			},
		});
	});

	it("infers multiple options", () => {
		defineCommand({
			data: {
				name: "test",
				description: "test",
				options: [
					{ name: "user", type: ApplicationCommandOptionType.User, description: "u", required: true },
					{ name: "reason", type: ApplicationCommandOptionType.String, description: "r", required: false },
					{ name: "days", type: ApplicationCommandOptionType.Integer, description: "d", required: false },
				] as const,
			},
			handler: async (ctx) => {
				const _user: Snowflake = ctx.options.user;
				const _reason: string | undefined = ctx.options.reason;
				const _days: number | undefined = ctx.options.days;
			},
		});
	});

	it("works with no options", () => {
		defineCommand({
			data: { name: "test", description: "test" },
			handler: async (ctx) => {
				void ctx.options;
			},
		});
	});
});

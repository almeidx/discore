import { describe, it } from "node:test";
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import type { APIAttachment, APIInteractionDataResolvedChannel, APIRole } from "discord-api-types/v10";
import { defineCommand } from "../../src/definitions/command.ts";
import type { ResolvedUser } from "../../src/types/options.ts";

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

	it("infers user option as ResolvedUser", () => {
		defineCommand({
			data: {
				name: "test",
				description: "test",
				options: [{ name: "user", type: ApplicationCommandOptionType.User, description: "u", required: true }] as const,
			},
			handler: async (ctx) => {
				const _val: ResolvedUser = ctx.options.user;
				const _username: string = ctx.options.user.user.username;
				// @ts-expect-error -- ResolvedUser is not a number
				const _bad: number = ctx.options.user;
			},
		});
	});

	it("infers channel option as resolved channel", () => {
		defineCommand({
			data: {
				name: "test",
				description: "test",
				options: [
					{ name: "channel", type: ApplicationCommandOptionType.Channel, description: "c", required: true },
				] as const,
			},
			handler: async (ctx) => {
				const _val: APIInteractionDataResolvedChannel = ctx.options.channel;
			},
		});
	});

	it("infers role option as APIRole", () => {
		defineCommand({
			data: {
				name: "test",
				description: "test",
				options: [{ name: "role", type: ApplicationCommandOptionType.Role, description: "r", required: true }] as const,
			},
			handler: async (ctx) => {
				const _val: APIRole = ctx.options.role;
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
				const _user: ResolvedUser = ctx.options.user;
				const _reason: string | undefined = ctx.options.reason;
				const _days: number | undefined = ctx.options.days;
			},
		});
	});

	it("infers mentionable option as ResolvedUser | APIRole", () => {
		defineCommand({
			data: {
				name: "test",
				description: "test",
				options: [
					{ name: "target", type: ApplicationCommandOptionType.Mentionable, description: "t", required: true },
				] as const,
			},
			handler: async (ctx) => {
				const _val: ResolvedUser | APIRole = ctx.options.target;
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

import { mock } from "node:test";

export function createMockAPI() {
	return {
		interactions: {
			reply: mock.fn(async () => undefined),
			defer: mock.fn(async () => undefined),
			followUp: mock.fn(async () => ({
				id: "1",
				channel_id: "1",
				author: {},
				content: "",
				timestamp: "",
				edited_timestamp: null,
				tts: false,
				mention_everyone: false,
				mentions: [],
				mention_roles: [],
				attachments: [],
				embeds: [],
				pinned: false,
				type: 0,
			})),
			editReply: mock.fn(async () => ({
				id: "1",
				channel_id: "1",
				author: {},
				content: "",
				timestamp: "",
				edited_timestamp: null,
				tts: false,
				mention_everyone: false,
				mentions: [],
				mention_roles: [],
				attachments: [],
				embeds: [],
				pinned: false,
				type: 0,
			})),
			createModal: mock.fn(async () => undefined),
			createAutocompleteResponse: mock.fn(async () => undefined),
		},
		applicationCommands: {
			bulkOverwriteGlobalCommands: mock.fn(async () => []),
			bulkOverwriteGuildCommands: mock.fn(async () => []),
		},
		applications: {
			getCurrent: mock.fn(async () => ({ id: "123456789" })),
		},
	} as any;
}

export function createMockREST() {
	return {
		post: mock.fn(async () => undefined),
		get: mock.fn(async () => undefined),
		patch: mock.fn(async () => undefined),
		delete: mock.fn(async () => undefined),
		put: mock.fn(async () => undefined),
		cdn: {},
	} as any;
}

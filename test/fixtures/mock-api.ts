import { mock, type Mock } from "node:test";
import type { API } from "@discordjs/core";
import type { APIMessage } from "discord-api-types/v10";

type Spy = Mock<(...args: unknown[]) => Promise<unknown>>;

export interface MockAPI {
	interactions: Record<
		| "reply"
		| "defer"
		| "updateMessage"
		| "deferMessageUpdate"
		| "followUp"
		| "editReply"
		| "deleteReply"
		| "getOriginalReply"
		| "createModal"
		| "createAutocompleteResponse",
		Spy
	>;
	applicationCommands: Record<"bulkOverwriteGlobalCommands" | "bulkOverwriteGuildCommands", Spy>;
}

const message = {
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
} as unknown as APIMessage;

function spy(result: unknown): Spy {
	return mock.fn(async (..._args: unknown[]) => result);
}

export function createMockAPI(): MockAPI {
	return {
		interactions: {
			reply: spy(undefined),
			defer: spy(undefined),
			updateMessage: spy(undefined),
			deferMessageUpdate: spy(undefined),
			followUp: spy(message),
			editReply: spy(message),
			deleteReply: spy(undefined),
			getOriginalReply: spy(message),
			createModal: spy(undefined),
			createAutocompleteResponse: spy(undefined),
		},
		applicationCommands: {
			bulkOverwriteGlobalCommands: spy([]),
			bulkOverwriteGuildCommands: spy([]),
		},
	};
}

/** The mock implements only the endpoints the framework calls. */
export function asAPI(api: MockAPI): API {
	return api as unknown as API;
}

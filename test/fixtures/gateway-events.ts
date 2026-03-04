import { GatewayDispatchEvents, type APIMessage } from "discord-api-types/v10";

export function messageCreateEvent(): { event: string; data: Partial<APIMessage> } {
	return {
		event: GatewayDispatchEvents.MessageCreate,
		data: {
			id: "777777777777777777",
			channel_id: "333333333333333333",
			author: {
				id: "666666666666666666",
				username: "testuser",
				discriminator: "0",
				avatar: null,
				global_name: null,
			},
			content: "Hello, world!",
			timestamp: "2024-01-01T00:00:00.000Z",
			edited_timestamp: null,
			tts: false,
			mention_everyone: false,
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			pinned: false,
			type: 0,
		},
	};
}

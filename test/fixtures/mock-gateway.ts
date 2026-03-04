import { EventEmitter } from "node:events";
import { WebSocketShardEvents } from "@discordjs/ws";
import type { GatewayDispatchPayload } from "discord-api-types/v10";

export class MockGateway extends EventEmitter {
	dispatch(event: string, data: unknown, shardId = 0): void {
		const payload = { t: event, d: data, op: 0, s: 1 } as GatewayDispatchPayload;
		this.emit(WebSocketShardEvents.Dispatch, payload, shardId);
	}
}

export function createMockGateway(): MockGateway {
	return new MockGateway();
}

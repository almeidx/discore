import type { GatewayDispatchEvents, GatewayDispatchPayload } from "discord-api-types/v10";

export type GatewayEventData<E extends GatewayDispatchEvents> = Extract<GatewayDispatchPayload, { t: E }>["d"];

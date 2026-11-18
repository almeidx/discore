/** Thrown when `ctx.awaitComponent()` or `ctx.awaitModal()` times out before a matching interaction arrives. */
export class CollectorTimeoutError extends Error {
	constructor(timeout: number) {
		super(`Collector timed out after ${timeout}ms`);
		this.name = "CollectorTimeoutError";
	}
}

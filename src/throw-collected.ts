/** Throws the only error as-is, or several as an {@link AggregateError}. Does nothing when there are none. */
export function throwCollected(errors: unknown[], message: string): void {
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1) throw new AggregateError(errors, message);
}

/** Removes the first occurrence of `item` from `list` in place. Returns whether it was present. */
export function removeItem<T>(list: T[], item: T): boolean {
	const index = list.indexOf(item);
	if (index === -1) return false;
	list.splice(index, 1);
	return true;
}

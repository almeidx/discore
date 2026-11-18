export const DefinitionType = {
	Command: 1,
	CommandGroup: 2,
	Event: 3,
	Button: 4,
	SelectMenu: 5,
	Modal: 6,
	Autocomplete: 7,
	UserCommand: 8,
	MessageCommand: 9,
} as const;

export type DefinitionType = (typeof DefinitionType)[keyof typeof DefinitionType];

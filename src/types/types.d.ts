import type { i18n } from "i18next";
import "obsidian";
import "sortablejs";
import type Sortable from "sortablejs";

declare global {
	const i18next: i18n;
}

declare module "sortablejs" {
	interface SortableEvent extends Event {
		items: HTMLElement[];
	}
}

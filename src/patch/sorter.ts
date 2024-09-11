import {
	type App,
	type ChildElement,
	type FileExplorerView,
	type RootElements,
	requireApiVersion,
} from "obsidian";
import Sortable from "sortablejs";
import type BartenderPlugin from "../main";
import type { BartenderSettings } from "../settings";
import { ANIMATION_DURATION } from "../types/constant";
import { reorderArray } from "../utils";

export class CustomSorter {
	plugin: BartenderPlugin;
	settings: BartenderSettings;
	app: App;

	constructor(plugin: BartenderPlugin) {
		this.plugin = plugin;
		this.settings = plugin.settings;
		this.app = plugin.app;
	}

	getRootFolders(
		fileExplorer?: FileExplorerView
	): [RootElements | ChildElement] | undefined {
		if (!fileExplorer) fileExplorer = this.plugin.getFileExplorer();
		if (!fileExplorer) return;
		const root = fileExplorer.tree?.infinityScroll?.rootEl;
		return root && this.traverseRoots(root);
	}

	traverseRoots(
		root: RootElements | ChildElement,
		items?: [RootElements | ChildElement]
	) {
		if (!items) items = [root];
		const supportsVirtualChildren = requireApiVersion?.("0.15.0");
		const _children = supportsVirtualChildren ? root.vChildren?._children : root.children;
		for (const child of _children || []) {
			if (child.children || child.vChildren?._children) {
				items.push(child);
			}
			this.traverseRoots(child, items);
		}
		return items;
	}

	toggleFileExplorerSorters(enable: boolean) {
		const fileExplorer = this.plugin.getFileExplorer();
		const roots = this.getRootFolders(fileExplorer);
		if (roots?.length) {
			for (const root of roots) {
				if (root.sorter) {
					root.sorter.option("sort", enable);
					root.sorter.option("disabled", !enable);
				}
			}
		}
	}

	cleanupFileExplorerSorters() {
		const fileExplorer = this.plugin.getFileExplorer();
		const roots = this.getRootFolders(fileExplorer);
		if (roots?.length) {
			for (const root of roots) {
				if (root.sorter) {
					root.sorter.destroy();
					delete root.sorter;
					Object.keys(root.childrenEl!).forEach(
						(key) => key.startsWith("Sortable") && delete (root.childrenEl as any)[key]
					);
					// sortable.destroy removes all of the draggble attributes :( so we put them back
					root
						.childrenEl!.querySelectorAll("div.nav-file-title")
						.forEach((el: HTMLDivElement) => (el.draggable = true));
					root
						.childrenEl!.querySelectorAll("div.nav-folder-title")
						.forEach((el: HTMLDivElement) => (el.draggable = true));
				}
			}
		}
		delete fileExplorer.hasCustomSorter;
		// unset "custom" file explorer sort
		if (
			this.app.vault.getConfig("fileSortOrder") === "custom" ||
			this.settings.sortOrder === "custom"
		) {
			fileExplorer.setSortOrder("alphabetical");
			this.settings.sortOrder = "alphabetical";
		} else {
			fileExplorer.setSortOrder(this.settings.sortOrder);
		}
	}

	setFileExplorerSorter(fileExplorer?: FileExplorerView) {
		this.settings = this.plugin.settings;
		if (!fileExplorer) fileExplorer = this.plugin.getFileExplorer();
		if (
			!fileExplorer ||
			this.settings.sortOrder !== "custom" ||
			fileExplorer.hasCustomSorter
		)
			return;

		const roots = this.getRootFolders(fileExplorer);
		if (!roots || !roots.length) return;
		for (const root of roots) {
			const el = root?.childrenEl;
			if (!el) continue;
			let draggedItems: HTMLElement[];
			fileExplorer.hasCustomSorter = true;
			const dragEnabled = !!document.body
				.querySelector("div.nav-action-button.drag-to-rearrange")
				?.hasClass("is-active");
			const path = root.file?.path ?? "";

			root.sorter = Sortable.create(el!, {
				group: `fileExplorer${path}`,
				forceFallback: true,
				multiDrag: true,
				// @ts-ignore
				multiDragKey: "alt",
				// selectedClass: "is-selected",
				chosenClass: "bt-sortable-chosen",
				delay: 0,
				disabled: !dragEnabled,
				sort: dragEnabled, // init with dragging disabled. the nav bar button will toggle on/off
				animation: ANIMATION_DURATION,
				onStart: (evt) => {
					draggedItems = evt.items.length ? evt.items : [evt.item];
				},
				onMove: (evt) => {
					// TODO: Refactor this
					// Responsible for updating the internal Obsidian array that contains the file item order
					// Without this logic, reordering is ephemeral and will be undone by Obisidian's native processes
					const supportsVirtualChildren = requireApiVersion?.("0.15.0");
					let _children = supportsVirtualChildren
						? root.vChildren?._children
						: root.children;
					if (!_children || !draggedItems?.length) return;
					let children = _children.map((child) => child.el);
					const adjacentEl = evt.related;
					const targetIndex = children.indexOf(adjacentEl);
					const firstItem = draggedItems.first();
					const firstItemIndex = children.indexOf(firstItem!);
					const _draggedItems = draggedItems.slice();
					if (firstItemIndex > targetIndex) _draggedItems.reverse();
					for (const item of _draggedItems) {
						const itemIndex = children.indexOf(item);
						_children = reorderArray(_children, itemIndex, targetIndex);
						children = reorderArray(children, itemIndex, targetIndex);
					}
					this.settings.fileExplorerOrder[path] = _children.map(
						(child) => child.file.path
					);
					this.plugin.saveSettings();
					// return !adjacentEl.hasClass("nav-folder");
				},
				onEnd: (_evt) => {
					draggedItems = [];
					document.querySelector("body>div.drag-ghost")?.detach();
				},
			});
		}
	}
}

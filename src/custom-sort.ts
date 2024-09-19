import { Menu, type TAbstractFile, type TFile, TFolder, setIcon } from "obsidian";
import type { BartenderSettings } from "./settings";
import type BartenderPlugin from "./main";

const Collator = new Intl.Collator(undefined, {
	usage: "sort",
	sensitivity: "base",
	numeric: true,
}).compare;

const Sorter = {
	alphabetical(first: TFile, second: TFile) {
		return Collator(first.basename, second.basename);
	},
	alphabeticalReverse(first: TFile, second: TFile) {
		return -Sorter.alphabetical(first, second);
	},
	byModifiedTime(first: TFile, second: TFile) {
		return second.stat.mtime - first.stat.mtime;
	},
	byModifiedTimeReverse(first: TFile, second: TFile) {
		return -Sorter.byModifiedTime(first, second);
	},
	byCreatedTime(first: TFile, second: TFile) {
		return second.stat.ctime - first.stat.ctime;
	},
	byCreatedTimeReverse(first: TFile, second: TFile) {
		return -Sorter.byCreatedTime(first, second);
	},
};

const Translate = i18next.t.bind(i18next);

const sortOptionStrings = {
	alphabetical: "plugins.file-explorer.label-sort-a-to-z",
	alphabeticalReverse: "plugins.file-explorer.label-sort-z-to-a",
	byModifiedTime: "plugins.file-explorer.label-sort-new-to-old",
	byModifiedTimeReverse: "plugins.file-explorer.label-sort-old-to-new",
	byCreatedTime: "plugins.file-explorer.label-sort-created-new-to-old",
	byCreatedTimeReverse: "plugins.file-explorer.label-sort-created-old-to-new",
	custom: "Custom",
};

const sortOptionGroups = [
	["alphabetical", "alphabeticalReverse"],
	["byModifiedTime", "byModifiedTimeReverse"],
	["byCreatedTime", "byCreatedTimeReverse"],
	["custom"],
];

/**
 * For the moment, we copy the original function
 * Will be modify to add the custom sort after, but first I need to understand how it works
 * @param settings
 * @param e
 * @param foldersOnBottom
 */
export const folderSortV2 = function (
	settings: BartenderSettings,
	e: any,
	foldersOnBottom?: boolean
) {
	const children = e.children.slice();
	children.sort((firstEl: TAbstractFile, secondEl: TAbstractFile) => {
		let firstIsFolder;
		let secondIsFolder;
		if (
			foldersOnBottom &&
			((firstIsFolder = firstEl instanceof TFolder) ||
				(secondIsFolder = secondEl instanceof TFolder))
		) {
			return firstIsFolder && !secondIsFolder
				? 1
				: secondIsFolder && !firstIsFolder
					? -1
					: Collator(firstEl.name, secondEl.name);
		}

		const order =
			firstEl.parent &&
			secondEl.parent &&
			firstEl.parent === secondEl.parent &&
			!firstEl.parent.isRoot()
				? settings.fileExplorerOrder[firstEl.parent.path] || undefined
				: settings.fileExplorerOrder[""];
		if (!order) return Collator(firstEl.name, secondEl.name);
		const index1 = order.indexOf(firstEl.path);
		const index2 = order.indexOf(secondEl.path);

		return (index1 > -1 ? index1 : Infinity) - (index2 > -1 ? index2 : Infinity);
	});
	const i = [];
	for (let r = 0, o = children; r < o.length; r++) {
		const a = o[r];
		const s = this.fileItems[a.path];
		s && i.push(s);
	}

	return i;
};

function addButton(
	icon: "move" | "arrow-up-narrow-wide" | "three-horizontal-bars" | "search",
	addSortButton: any,
	title: string,
	onClick: (event: MouseEvent) => void
) {
	const leaf = addSortButton.app.workspace
		.getLeavesOfType("file-explorer")
		?.first()?.view;
	const button = createDiv({
		cls: "clickable-icon nav-action-button custom-sort",
		attr: {
			"aria-label": title,
		},
	});
	setIcon(button, icon);
	button.addEventListener("click", onClick);
	if (leaf) {
		const oldChild = leaf.containerEl
			.querySelector("div.nav-buttons-container")
			.querySelectorAll(`[aria-label="${title}"]`);
		for (let i = 0; i < oldChild.length; i++) {
			if (oldChild[i].hasClass("custom-sort")) oldChild[i].remove();
			else oldChild[i].addClass("hide");
		}
		const shouldBeBefore =
			icon === "move" ||
			icon === "arrow-up-narrow-wide" ||
			icon === "three-horizontal-bars";
		if (shouldBeBefore) {
			const devAll = leaf.containerEl.querySelector(
				`div.nav-buttons-container > .nav-action-button[aria-label='${Translate("plugins.file-explorer.action-collapse-all")}']`
			);
			const expandAll = leaf.containerEl.querySelector(
				`div.nav-buttons-container > .nav-action-button[aria-label='${Translate("plugins.file-explorer.action-expand-all")}']`
			);
			if (devAll) {
				leaf.containerEl
					.querySelector("div.nav-buttons-container")
					.insertBefore(button, devAll);
			} else if (expandAll) {
				leaf.containerEl
					.querySelector("div.nav-buttons-container")
					.insertBefore(button, expandAll);
			} else {
				leaf.containerEl.querySelector("div.nav-buttons-container").appendChild(button);
			}
		} else
			leaf.containerEl.querySelector("div.nav-buttons-container").appendChild(button);
	}
	return button;
}

export const addSortButton = function (
	bartender: BartenderPlugin,
	_sorter: any,
	sortOption: any,
	_setSortOrder: any,
	_currentSort: any
) {
	const plugin = this;
	const settings = bartender.settings;
	const sortEl = addButton(
		settings.sortOrder === "custom" ? "move" : "arrow-up-narrow-wide",
		this,
		Translate("plugins.file-explorer.action-change-sort"),
		(event: MouseEvent) => {
			event.preventDefault();
			const menu = new Menu();
			for (
				let currentSortOption = settings.sortOrder,
					groupIndex = 0,
					_sortOptionGroups = sortOptionGroups;
				groupIndex < _sortOptionGroups.length;
				groupIndex++
			) {
				for (
					let addMenuItem = (_sortOption: keyof typeof sortOptionStrings) => {
							const label = Translate(sortOptionStrings[_sortOption]);
							menu.addItem((item) =>
								item
									.setTitle(label)
									.setChecked(_sortOption === currentSortOption)
									.onClick(() => {
										if (_sortOption !== currentSortOption) {
											sortEl.setAttribute("data-sort-method", _sortOption);
											plugin.app.workspace.trigger(
												"file-explorer-sort-change",
												_sortOption
											);
											//force the sort with the new sort method
											const leaf = plugin.app.workspace
												.getLeavesOfType("file-explorer")
												?.first()?.view;
											if (leaf) leaf.sort();
										}
										//setSortOrder(_sortOption);
										if (_sortOption === "custom") setIcon(sortEl, "move");
										else setIcon(sortEl, "arrow-up-narrow-wide");
									})
							);
						},
						itemIndex = 0,
						sortOptionGroup = _sortOptionGroups[groupIndex];
					itemIndex < sortOptionGroup.length;
					itemIndex++
				) {
					addMenuItem(sortOptionGroup[itemIndex] as keyof typeof sortOptionStrings);
				}
				menu.addSeparator();
			}
			menu.showAtMouseEvent(event);
		}
	);
	setTimeout(() => {
		sortEl.setAttribute("data-sort-method", settings.sortOrder);
	}, 100);
	addButton(
		"three-horizontal-bars",
		this,
		"Drag to rearrange",
		function (event: MouseEvent) {
			event.preventDefault();
			const value = !this.hasClass("is-active");
			this.toggleClass("is-active", value);
			plugin.app.workspace.trigger("file-explorer-draggable-change", value);
		}
	).addClass("drag-to-rearrange");
	addButton("search", this, "Filter items", function (event: MouseEvent) {
		event.preventDefault();
		const value = !this.hasClass("is-active");
		this.toggleClass("is-active", value);
		const filterEl = document.body.querySelector(
			'.workspace-leaf-content[data-type="file-explorer"] .search-input-container > input'
		) as HTMLInputElement;
		if (filterEl && !value) {
			filterEl.parentElement?.hide();
			filterEl.value = "";
			filterEl.dispatchEvent(new Event("input"));
		} else {
			filterEl?.parentElement?.show();
			filterEl?.focus();
		}
	});
	return sortEl;
};

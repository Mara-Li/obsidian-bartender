import Fuse from "fuse.js";
import {
	type App,
	type ChildElement,
	type FileExplorerView,
	Scope,
	requireApiVersion,
} from "obsidian";
import type BartenderPlugin from "../main";
import type { BartenderSettings } from "../settings";
type NestedObject = { [key: string]: string | NestedObject };

export class CustomFilter {
	settings: BartenderSettings;
	plugin: BartenderPlugin;
	app: App;

	constructor(plugin: BartenderPlugin) {
		this.plugin = plugin;
		this.settings = plugin.settings;
		this.app = plugin.app;
	}

	setFileExplorerFilter(fileExplorer?: FileExplorerView) {
		fileExplorer = fileExplorer ?? this.plugin.getFileExplorer();
		const fileExplorerNav = fileExplorer?.headerDom?.navHeaderEl;
		if (!fileExplorerNav) {
			return;
		}
		const fileExplorerFilter = fileExplorerNav.createDiv("search-input-container filter");
		fileExplorerNav.insertAdjacentElement("afterend", fileExplorerFilter);
		const fileExplorerFilterInput = fileExplorerFilter.createEl("input");
		fileExplorerFilterInput.placeholder = "Type to filter...";
		fileExplorerFilterInput.type = "text";
		fileExplorerFilter.hide();
		const filterScope = new Scope(this.app.scope);
		fileExplorerFilterInput.onfocus = () => {
			this.app.keymap.pushScope(filterScope);
		};
		fileExplorerFilterInput.onblur = () => {
			this.app.keymap.popScope(filterScope);
		};

		//register arrow keys to navigate the file explorer

		fileExplorerFilterInput.oninput = (ev: InputEvent) => {
			if (ev.target instanceof HTMLInputElement) {
				if (ev.target.value.length) {
					clearButtonEl.show();
				} else {
					clearButtonEl.hide();
				}
				fileExplorer.tree.infinityScroll.filter = ev.target.value;
			}
			fileExplorer.tree.infinityScroll.compute();
		};
		const clearButtonEl = fileExplorerFilter.createDiv(
			"search-input-clear-button",
			(el) => {
				el.addEventListener("click", () => {
					fileExplorerFilterInput.value = "";
					clearButtonEl.hide();
					fileExplorerFilterInput.focus();
					fileExplorerFilterInput.dispatchEvent(new Event("input"));
				});
				el.hide();
			}
		);
	}

	clearFileExplorerFilter() {
		const fileExplorer = this.plugin.getFileExplorer();
		const fileExplorerFilterEl: HTMLInputElement | null =
			fileExplorer.containerEl.querySelector(
				'.workspace-leaf-content[data-type="file-explorer"] .search-input-container > input'
			);
		fileExplorerFilterEl?.remove();
		if (fileExplorerFilterEl) fileExplorerFilterEl.value = "";
		fileExplorer.tree.infinityScroll.filter = "";
		fileExplorer.tree.infinityScroll.compute();
	}

	private getItems = (items: ChildElement[], app: App): ChildElement[] => {
		let children: any[] = [];
		const supportsVirtualChildren = requireApiVersion && requireApiVersion("0.15.0");
		const excluded = app.vault.config.userIgnoreFilters;
		if (excluded) {
			items = items.filter((item) => {
				//if the item.file.path startswith any of the excluded paths, return false
				return !excluded.some((exclude) => item.file.path.startsWith(exclude));
			});
		}
		return supportsVirtualChildren
			? items
					.reduce((res, item) => {
						if (item.vChildren?._children) {
							children = [...children, ...item.vChildren._children];
						} else {
							res.push(item);
						}
						return res;
					}, [] as ChildElement[])
					.concat(children.length ? this.getItems(children, app) : children)
			: items
					.reduce((res, item) => {
						if (item.children) {
							children = [...children, ...item.children];
						} else {
							res.push(item);
						}
						return res;
					}, [] as ChildElement[])
					.concat(children.length ? this.getItems(children, app) : children);
	};

	// highlight fuzzy filter matches

	fileExplorerFilter = function (
		fileExplorer: FileExplorerView,
		filter: CustomFilter = this
	) {
		const supportsVirtualChildren = requireApiVersion?.("0.15.0");
		if (!fileExplorer) return;
		const _children = supportsVirtualChildren
			? this.rootEl?.vChildren._children
			: this.rootEl?.children;
		if (!_children) return;
		if (this.filter?.length >= 1) {
			if (!this.filtered) {
				this.rootEl._children = _children;
				this.filtered = true;
			}
			const options = {
				includeScore: true,
				includeMatches: true,
				useExtendedSearch: true,
				getFn: filter.getFn,
				threshold: 0.1,
				ignoreLocation: true,
				keys: ["file.path"],
			};
			const flattenedItems = filter.getItems(this.rootEl._children, fileExplorer.app);
			const fuse = new Fuse(flattenedItems, options);
			const maxResults = 200;
			const results = fuse.search(this.filter).slice(0, maxResults);
			if (supportsVirtualChildren) {
				this.rootEl.vChildren._children = filter.highlight(results);
			} else {
				this.rootEl.children = filter.highlight(results);
			}

			return;
		}
		if (!(this.filter?.length < 1 && this.filtered)) {
			return;
		}
		if (this.rootEl._children) {
			if (supportsVirtualChildren) {
				this.rootEl.vChildren._children = this.rootEl._children;
			} else {
				this.rootEl.children = this.rootEl._children;
			}
		}

		const flattenedItems = filter.getItems(this.rootEl._children, fileExplorer.app);
		flattenedItems.map((match: ChildElement) => {
			if (!(<any>match).innerEl.origContent) {
				return;
			}

			// @ts-ignore
			match.innerEl.setText((<any>match).innerEl.origContent);
			delete (<any>match).innerEl.origContent;
			// @ts-ignore
			match.innerEl.removeClass("has-matches");
		});

		this.filtered = false;
	};

	private highlight = (
		fuseSearchResult: any,
		highlightClassName: string = "suggestion-highlight"
	) => {
		const set = (obj: NestedObject, path: string, value: any) => {
			const pathValue = path.split(".");
			let i;

			for (i = 0; i < pathValue.length - 1; i++) {
				obj = obj[pathValue[i]] as NestedObject;
			}

			obj[pathValue[i]] = value;
		};

		const generateHighlightedText = (inputText: string, regions: number[][] = []) => {
			return regions
				.reduce((str, [start, end]) => {
					str[start] = `<span class="${highlightClassName}">${str[start]}`;
					str[end] = `${str[end]}</span>`;
					return str;
				}, inputText.split(""))
				.join("");
		};

		return fuseSearchResult
			.filter(({ matches }: any) => matches && matches.length)
			.map(({ item, matches }: any) => {
				const highlightedItem = { ...item };
				matches.forEach((match: any) => {
					if (!highlightedItem.innerEl.origContent)
						highlightedItem.innerEl.origContent = highlightedItem.innerEl.textContent;
					set(
						highlightedItem,
						"innerEl.innerHTML",
						generateHighlightedText(match.value, match.indices)
					);
					highlightedItem.innerEl?.addClass("has-matches");
				});

				return highlightedItem;
			});
	};

	private getFn(obj: any, path: string[]) {
		const removeExt = function (obj: any) {
			if (typeof obj === "string" || obj instanceof String) {
				const parts = obj.split("/");
				let newObj = obj;
				if (parts.length >= 3) {
					for (let i = 1; i < parts.length - 1; i += 2) {
						parts[i] = "…";
					}
					newObj = parts.join("/");
				}
				return newObj.replace(/.md$/, "");
			}
			return obj;
		};
		const value = Fuse.config.getFn(obj, path);
		if (Array.isArray(value)) {
			return value.map((el) => removeExt(el));
		}
		return removeExt(value);
	}
}

import { around } from "monkey-around";
import {
	type FileExplorerView,
	Platform,
	Plugin,
	type SplitDirection,
	View,
	type ViewCreator,
	Workspace,
	type WorkspaceItem,
	type WorkspaceLeaf,
	WorkspaceTabs,
	requireApiVersion,
} from "obsidian";

import Sortable, { MultiDrag } from "sortablejs";
import { addSortButton, folderSortV2 } from "./custom-sort";
import { Collapse } from "./patch/collapse";
import { CustomFilter } from "./patch/filter";
import { CustomSorter } from "./patch/sorter";
import { type BartenderSettings, DEFAULT_SETTINGS, SettingTab } from "./settings";
import { RIBBON_BAR_SELECTOR } from "./types/constant";

Sortable.mount(new MultiDrag());

export default class BartenderPlugin extends Plugin {
	settings: BartenderSettings;
	settingsTab: SettingTab;
	collapse: Collapse;
	customFilter: CustomFilter;
	customSorter: CustomSorter;

	async onload() {
		await this.loadSettings();
		this.collapse = new Collapse(this);
		this.customFilter = new CustomFilter(this);
		this.customSorter = new CustomSorter(this);
		this.registerMonkeyPatches();
		this.registerEventHandlers();
		this.registerSettingsTab();
		this.initialize();

		this.app.vault.on("rename", async (file, oldFile) => {
			// change the path in the settings
			//first check if folder and search this path in the settings
			for (const key in this.settings.fileExplorerOrder) {
				for (const item of this.settings.fileExplorerOrder[key]) {
					if (item === oldFile) {
						const index = this.settings.fileExplorerOrder[key].indexOf(item);
						this.settings.fileExplorerOrder[key][index] = file.path;
					}
				}
				if (key.startsWith(oldFile)) {
					this.settings.fileExplorerOrder[file.path] =
						this.settings.fileExplorerOrder[key];
					delete this.settings.fileExplorerOrder[key];
				}
			}
			await this.saveSettings();
		});

		this.app.vault.on("delete", async (file) => {
			// remove the path from the settings
			for (const key in this.settings.fileExplorerOrder) {
				for (const item of this.settings.fileExplorerOrder[key]) {
					if (item === file.path) {
						const index = this.settings.fileExplorerOrder[key].indexOf(item);
						this.settings.fileExplorerOrder[key].splice(index, 1);
					}
				}
				if (key.startsWith(file.path)) {
					delete this.settings.fileExplorerOrder[key];
				}
			}
			await this.saveSettings();
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	patchFileExplorerFolder() {
		const plugin = this;
		const leaf = plugin.app.workspace.getLeaf();
		const fileExplorer = plugin.app.viewRegistry.viewByType["file-explorer"](
			leaf
		) as FileExplorerView;
		this.register(
			around(fileExplorer.constructor.prototype, {
				getSortedFolderItems: (old: any) => {
					return function (...args: any[]) {
						if (plugin.settings.sortOrder === "custom") {
							return folderSortV2.call(this, plugin.settings, ...args);
						}
						return old.call(this, ...args);
					};
				},
			})
		);
		leaf.detach();
	}

	initialize() {
		this.app.workspace.onLayoutReady(() => {
			this.patchFileExplorerFolder();
			const fileExplorer = this.getFileExplorer();
			this.customFilter.setFileExplorerFilter(fileExplorer);
			setTimeout(
				() => {
					// add file explorer sorter
					this.customSorter.setFileExplorerSorter();

					// add sorter to the left sidebar ribbon
					if (this.settings.useCollapse) {
						this.collapse.insertSeparator(
							RIBBON_BAR_SELECTOR,
							"side-dock-ribbon-action",
							false
						);
						this.collapse.setRibbonBarSorter();
					}

					addSortButton(this, null, null, null, null);
					// add sorter to all view actions icon groups
					this.app.workspace.iterateRootLeaves((leaf) => {
						if (
							leaf?.view?.hasOwnProperty("actionsEl") &&
							!leaf?.view?.hasOwnProperty("iconSorter")
						) {
							leaf.view.iconSorter = this.collapse.setViewActionSorter(
								leaf.view.actionsEl,
								leaf.view
							);
						}
					});
				},
				Platform.isMobile ? 3000 : 400
			);

			// give time for plugins like Customizable Page Header to add their icons
		});
	}

	registerSettingsTab() {
		this.settingsTab = new SettingTab(this.app, this);
		this.addSettingTab(this.settingsTab);
	}

	registerEventHandlers() {
		this.registerEvent(
			this.app.workspace.on("file-explorer-draggable-change", (value) => {
				this.customSorter.toggleFileExplorerSorters(value);
			})
		);
		this.registerEvent(
			this.app.workspace.on("file-explorer-sort-change", (sortMethod: string) => {
				this.settings.sortOrder = sortMethod;
				this.saveSettings();
				if (sortMethod === "custom") {
					setTimeout(() => {
						this.customSorter.setFileExplorerSorter();
					}, 10);
				} else {
					this.customSorter.cleanupFileExplorerSorters();
				}
			})
		);
		this.registerEvent(
			this.app.workspace.on("file-explorer-load", (fileExplorer: FileExplorerView) => {
				setTimeout(() => {
					this.customSorter.setFileExplorerSorter();
				}, 1000);
			})
		);
		this.registerEvent(
			this.app.workspace.on(
				"bartender-leaf-split",
				(_originLeaf: WorkspaceItem, newLeaf: WorkspaceItem) => {
					const element: HTMLElement = newLeaf.tabsInnerEl as HTMLElement;
					if (newLeaf.type === "tabs" && newLeaf instanceof WorkspaceTabs) {
						if (requireApiVersion && !requireApiVersion("0.15.3")) {
							this.collapse.setTabBarSorter(element, newLeaf);
						}
					}
				}
			)
		);

		this.registerEvent(
			this.app.workspace.on("ribbon-bar-updated", () => {
				setTimeout(() => {
					if (this.settings.ribbonBarOrder && this.collapse.ribbonBarSorter) {
						this.collapse.setElementIDs(this.collapse.ribbonBarSorter.el, {
							useClass: true,
							useAria: true,
							useIcon: true,
						});
						this.collapse.ribbonBarSorter.sort(this.settings.ribbonBarOrder);
					}
				}, 0);
			})
		);
		this.registerEvent(
			this.app.workspace.on("status-bar-updated", () => {
				setTimeout(() => {
					if (this.settings.statusBarOrder && this.collapse.statusBarSorter) {
						this.collapse.setElementIDs(this.collapse.statusBarSorter.el, {
							useClass: true,
							useIcon: true,
						});
						this.collapse.statusBarSorter.sort(this.settings.statusBarOrder);
					}
				}, 0);
			})
		);
	}

	registerMonkeyPatches() {
		const plugin = this;
		this.register(
			around(this.app.viewRegistry.constructor.prototype, {
				registerView(old: any) {
					return function (type: string, viewCreator: ViewCreator, ...args: unknown[]) {
						plugin.app.workspace.trigger("view-registered", type, viewCreator);
						return old.call(this, type, viewCreator, ...args);
					};
				},
			})
		);
		if (this.app.workspace.layoutReady) {
			this.patchFileExplorer();
		} else {
			// wait for layout to be ready
			this.registerEvent(
				this.app.workspace.on("layout-ready", () => {
					this.patchFileExplorer();
				})
			);
		}

		this.register(
			around(View.prototype, {
				onunload(old: any) {
					return function (...args) {
						try {
							if (this.iconSorter) {
								this.iconSorter.destroy();
								this.iconSorter = null;
							}
						} catch {
							//pass
						}
						return old.call(this, ...args);
					};
				},
				onload(old: any) {
					return function (...args) {
						setTimeout(() => {
							if (this.app.workspace.layoutReady) {
								try {
									if (
										!(this.leaf.parentSplit instanceof WorkspaceTabs) &&
										this.hasOwnProperty("actionsEl") &&
										!this.iconSorter
									) {
										this.iconSorter = plugin.collapse.setViewActionSorter(
											this.actionsEl,
											this
										);
									}
								} catch {
									//pass
								}
							}
						}, 200);

						return old.call(this, ...args);
					};
				},
			})
		);
		if (Platform.isDesktop) {
			this.register(
				around(HTMLDivElement.prototype, {
					addEventListener(old: any) {
						return function (
							type: string,
							listener: EventListenerOrEventListenerObject,
							options?: boolean | AddEventListenerOptions
						) {
							if (
								type === "mousedown" &&
								listener instanceof Function &&
								this.hasClass("workspace-tab-header")
							) {
								const origListener = listener;
								listener = (event) => {
									if (event instanceof MouseEvent && (event?.altKey || event?.metaKey))
										return;
									else origListener(event);
								};
							}
							return old.call(this, type, listener, options);
						};
					},
				})
			);
		}
		this.register(
			around(Workspace.prototype, {
				splitLeaf(old: any) {
					return function (
						source: WorkspaceItem,
						newLeaf: WorkspaceItem,
						direction?: SplitDirection,
						before?: boolean,
						...args
					) {
						const result = old.call(this, source, newLeaf, direction, before, ...args);
						this.trigger("bartender-leaf-split", source, newLeaf);
						return result;
					};
				},
				changeLayout(old: any) {
					return async function (workspace: any, ...args): Promise<void> {
						const result = await old.call(this, workspace, ...args);
						this.trigger("bartender-workspace-change");
						return result;
					};
				},
			})
		);
		this.register(
			around(Plugin.prototype, {
				addStatusBarItem(old: any) {
					return function (...args): HTMLElement {
						const result = old.call(this, ...args);
						this.app.workspace.trigger("status-bar-updated");
						return result;
					};
				},
				addRibbonIcon(old: any) {
					return function (...args): HTMLElement {
						const result = old.call(this, ...args);
						this.app.workspace.trigger("ribbon-bar-updated");
						return result;
					};
				},
			})
		);
	}

	patchFileExplorer(fileExplorer?: FileExplorerView) {
		const plugin = this;
		const customFilter = this.customFilter;
		if (!fileExplorer) fileExplorer = this.getFileExplorer();
		const InfinityScroll = fileExplorer.tree.infinityScroll.constructor;
		// register clear first so that it gets called first onunload
		this.register(() => this.customFilter.clearFileExplorerFilter());
		this.register(
			around(InfinityScroll.prototype, {
				compute(old: any) {
					return function (...args: any[]) {
						try {
							if (this.scrollEl.hasClass("nav-files-container")) {
								plugin.customFilter.fileExplorerFilter.call(
									this,
									fileExplorer,
									customFilter,
									plugin.app
								);
							}
						} catch (err) {
							console.log(err);
						}
						return old.call(this, ...args);
					};
				},
			})
		);
		this.register(
			around(fileExplorer.headerDom.constructor.prototype, {
				addSortButton(old: any) {
					return function (...args: any[]) {
						if (this.navHeaderEl?.parentElement?.dataset?.type === "file-explorer") {
							plugin.customFilter.setFileExplorerFilter(this);
							return addSortButton.call(this, plugin, ...args);
						}
						return old.call(this, ...args);
					};
				},
			})
		);
	}

	getFileExplorer() {
		const fileExplorer: FileExplorerView | undefined = this.app.workspace
			.getLeavesOfType("file-explorer")
			?.first()?.view as unknown as FileExplorerView;

		return fileExplorer;
	}

	onunload(): void {
		this.collapse.statusBarSorter?.destroy();
		this.collapse.ribbonBarSorter?.destroy();
		this.app.workspace.iterateAllLeaves((leaf) => {
			let sorterParent: View | WorkspaceTabs | WorkspaceLeaf | boolean;
			if (
				(sorterParent = leaf?.iconSorter ? leaf : false) ||
				(sorterParent = leaf?.view?.iconSorter ? leaf.view : false) ||
				(sorterParent =
					leaf?.parentSplit instanceof WorkspaceTabs && leaf?.parentSplit?.iconSorter
						? leaf?.parentSplit
						: false)
			) {
				try {
					sorterParent.iconSorter?.destroy();
				} finally {
					delete sorterParent.iconSorter;
				}
			}
		});

		// clean up file explorer sorters
		this.customSorter.cleanupFileExplorerSorters();
		const leaf = this.app.workspace.getLeavesOfType("file-explorer")?.first()?.view;
		if (leaf) {
			const oldChild =
				leaf.containerEl
					.querySelector("div.nav-buttons-container")
					?.querySelectorAll("div.nav-action-button.custom-sort") || [];
			for (const el of oldChild) {
				if (el.ariaLabel === "move" || el.ariaLabel === "arrow-up-narrow-wide") {
					//only remove the custom sort option
					const hiddenButton = leaf.containerEl.querySelector(
						`div.nav-buttons-container > div.nav-action-button.hide[aria-label="${el.ariaLabel}"]`
					);
					if (hiddenButton) hiddenButton.removeClass("hide");
					el.remove();
				} else el.remove();
			}
			const filterEl = leaf.containerEl.querySelectorAll(
				".search-input-container.filter"
			);
			for (const el of filterEl) {
				el.remove();
			}
		}
	}
}

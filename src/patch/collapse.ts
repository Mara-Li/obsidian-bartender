import {
	type App,
	Platform,
	type View,
	type WorkspaceSplit,
	type WorkspaceTabs,
	requireApiVersion,
	setIcon,
} from "obsidian";
import Sortable from "sortablejs";
import type BartenderPlugin from "../main";
import type { BartenderSettings } from "../settings";
import { ANIMATION_DURATION, STATUS_BAR_SELECTOR } from "../types/constant";
import {
	type GenerateIdOptions,
	generateId,
	getNextSiblings,
	getPreviousSiblings,
	reorderArray,
} from "../utils";

export class Collapse {
	plugin: BartenderPlugin;
	settings: BartenderSettings;
	ribbonBarSorter: Sortable | undefined;
	statusBarSorter: Sortable;
	app: App;

	constructor(plugin: BartenderPlugin) {
		this.plugin = plugin;
		this.settings = plugin.settings;
		this.app = plugin.app;
	}

	insertSeparator(selector: string, className: string, rtl: Boolean) {
		const elements = document.body.querySelectorAll(selector);
		elements.forEach((el: HTMLElement) => {
			const getSiblings = rtl ? getPreviousSiblings : getNextSiblings;
			if (!el) {
				return;
			}
			const separator = el.createDiv(`${className} separator`);
			rtl && el.prepend(separator);
			const glyphEl = separator.createDiv("glyph");
			const glyphName = "plus-with-circle"; // this gets replaced using CSS
			setIcon(glyphEl, glyphName);
			separator.addClass("is-collapsed");
			this.plugin.register(() => separator.detach());
			let hideTimeout: NodeJS.Timeout;
			separator.onClickEvent((event: MouseEvent) => {
				if (separator.hasClass("is-collapsed")) {
					Array.from(el.children).forEach((el) => el.removeClass("is-hidden"));
					separator.removeClass("is-collapsed");
				} else {
					getSiblings(separator).forEach((el) => el.addClass("is-hidden"));
					separator.addClass("is-collapsed");
				}
			});
			el.onmouseenter = (ev) => {
				if (hideTimeout) clearTimeout(hideTimeout);
			};
			el.onmouseleave = (ev) => {
				if (this.settings.autoHide) {
					hideTimeout = setTimeout(() => {
						getSiblings(separator).forEach((el) => el.addClass("is-hidden"));
						separator.addClass("is-collapsed");
					}, this.plugin.settings.autoHideDelay);
				}
			};
			setTimeout(() => {
				getSiblings(separator).forEach((el) => el.addClass("is-hidden"));
				separator.addClass("is-collapsed");
			}, 0);
		});
	}

	initCollapse() {
		if (Platform.isDesktop && this.settings.useCollapse) {
			// add sorter to the status bar
			this.insertSeparator(STATUS_BAR_SELECTOR, "status-bar-item", true);
			this.setStatusBarSorter();

			// add sorter to the sidebar tabs
			if (requireApiVersion && !requireApiVersion("0.15.3")) {
				const left = (this.app.workspace.leftSplit as WorkspaceSplit).children;
				const right = (this.app.workspace.rightSplit as WorkspaceSplit).children;
				left.concat(right).forEach((child) => {
					if (child.hasOwnProperty("tabsInnerEl") && !child.iconSorter) {
						child.iconSorter = this.setTabBarSorter(child.tabsInnerEl, child);
					}
				});
			}
		}
	}

	setTabBarSorter(element: HTMLElement, leaf: WorkspaceTabs) {
		this.setElementIDs(element, { useClass: true, useIcon: true });
		return Sortable.create(element, {
			group: "leftTabBar",
			dataIdAttr: "data-id",
			chosenClass: "bt-sortable-chosen",
			delay: Platform.isMobile ? 200 : this.plugin.settings.dragDelay,
			dropBubble: false,
			dragoverBubble: false,
			animation: ANIMATION_DURATION,
			onChoose: () => element.parentElement?.addClass("is-dragging"),
			onUnchoose: () => element.parentElement?.removeClass("is-dragging"),
			onStart: () => {
				document.body.addClass("is-dragging");
				element.querySelector(".separator")?.removeClass("is-collapsed");
				Array.from(element.children).forEach((el) => el.removeClass("is-hidden"));
			},
			onEnd: (event) => {
				document.body.removeClass("is-dragging");
				if (event.oldIndex !== undefined && event.newIndex !== undefined) {
					reorderArray(leaf.children, event.oldIndex, event.newIndex);
					leaf.currentTab = event.newIndex;
					leaf.recomputeChildrenDimensions();
				}
				this.app.workspace.requestSaveLayout();
			},
		});
	}

	setViewActionSorter(el: HTMLElement, view: View): Sortable | undefined {
		this.setElementIDs(el, { useClass: true, useIcon: true });
		const hasSorter = Object.values(el).find((value) =>
			value?.hasOwnProperty("nativeDraggable")
		);
		if (hasSorter) return undefined;
		const viewType = view?.getViewType() || "unknown";
		return new Sortable(el, {
			group: "actionBar",
			dataIdAttr: "data-id",
			chosenClass: "bt-sortable-chosen",
			delay: Platform.isMobile ? 200 : this.plugin.settings.dragDelay,
			sort: true,
			animation: ANIMATION_DURATION,
			onStart: () => {
				el.querySelector(".separator")?.removeClass("is-collapsed");
				Array.from(el.children).forEach((el) => el.removeClass("is-hidden"));
			},
			store: {
				get: () => {
					return this.settings.actionBarOrder[viewType];
				},
				set: (s) => {
					this.settings.actionBarOrder[viewType] = s.toArray();
					this.plugin.saveSettings();
				},
			},
		});
	}

	setRibbonBarSorter() {
		const el = document.body.querySelector(
			"body > div.app-container div.side-dock-actions"
		) as HTMLElement;
		if (el) {
			this.setElementIDs(el, { useClass: true, useAria: true, useIcon: true });
			this.ribbonBarSorter = Sortable.create(el, {
				group: "ribbonBar",
				dataIdAttr: "data-id",
				delay: Platform.isMobile ? 200 : this.plugin.settings.dragDelay,
				chosenClass: "bt-sortable-chosen",
				animation: ANIMATION_DURATION,
				onChoose: () => {
					Array.from(el.children).forEach((el) => el.removeClass("is-hidden"));
				},
				onStart: () => {
					el.querySelector(".separator")?.removeClass("is-collapsed");
					Array.from(el.children).forEach((el) => el.removeClass("is-hidden"));
				},
				store: {
					get: (sortable) => {
						return this.settings.ribbonBarOrder;
					},
					set: (s) => {
						this.settings.ribbonBarOrder = s.toArray();
						this.plugin.saveSettings();
					},
				},
			});
		}
	}

	setElementIDs(parentEl: HTMLElement, options: GenerateIdOptions) {
		Array.from(parentEl.children).forEach((child) => {
			if (child instanceof HTMLElement && !child.getAttribute("data-id")) {
				child.setAttribute("data-id", generateId(child, options));
			}
		});
	}

	setStatusBarSorter() {
		const el = document.body.querySelector(
			"body > div.app-container > div.status-bar"
		) as HTMLElement;
		if (el) {
			this.setElementIDs(el, { useClass: true, useAria: true, useIcon: true });
			this.statusBarSorter = Sortable.create(el, {
				group: "statusBar",
				dataIdAttr: "data-id",
				chosenClass: "bt-sortable-chosen",
				delay: Platform.isMobile ? 200 : this.plugin.settings.dragDelay,
				animation: ANIMATION_DURATION,
				onChoose: () => {
					Array.from(el.children).forEach((el) => el.removeClass("is-hidden"));
				},
				onStart: () => {
					el.querySelector(".separator")?.removeClass("is-collapsed");
					Array.from(el.children).forEach((el) => el.removeClass("is-hidden"));
				},
				store: {
					get: (sortable) => {
						return this.settings.statusBarOrder;
					},
					set: (s) => {
						this.settings.statusBarOrder = s.toArray();
						this.plugin.saveSettings();
					},
				},
			});
		}
	}
}

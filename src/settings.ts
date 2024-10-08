import { type App, PluginSettingTab, Setting } from "obsidian";
import type BartenderPlugin from "./main";

export interface BartenderSettings {
	statusBarOrder: string[];
	ribbonBarOrder: string[];
	fileExplorerOrder: Record<string, string[]>;
	actionBarOrder: Record<string, string[]>;
	autoHide: boolean;
	autoHideDelay: number;
	dragDelay: number;
	sortOrder: string;
	useCollapse: boolean;
}

export const DEFAULT_SETTINGS: BartenderSettings = {
	statusBarOrder: [],
	ribbonBarOrder: [],
	fileExplorerOrder: {},
	actionBarOrder: {},
	autoHide: false,
	autoHideDelay: 2000,
	dragDelay: 200,
	sortOrder: "alphabetical",
	useCollapse: true,
};

export class SettingTab extends PluginSettingTab {
	plugin: BartenderPlugin;

	constructor(app: App, plugin: BartenderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Support collapse")
			.setDesc("Add a button to collapse the ribbon and status bar items")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useCollapse).onChange((value) => {
					this.plugin.settings.useCollapse = value;
					this.plugin.saveSettings();
					this.display();
				})
			);
		if (this.plugin.settings.useCollapse) {
			new Setting(containerEl)
				.setName("Auto Collapse")
				.setDesc(
					"Automatically hide ribbon and status bar items once your mouse leaves the icon container"
				)
				.addToggle((toggle) =>
					toggle.setValue(this.plugin.settings.autoHide).onChange((value) => {
						this.plugin.settings.autoHide = value;
						this.plugin.saveSettings();
					})
				);

			new Setting(containerEl)
				.setName("Auto Collapse Delay")
				.setDesc(
					"How long to wait before auto collapsing hidden icons on the ribbon and status bar"
				)
				.addText((textfield) => {
					textfield.setPlaceholder(String(2000));
					textfield.inputEl.type = "number";
					textfield.setValue(String(this.plugin.settings.autoHideDelay));
					textfield.onChange(async (value) => {
						this.plugin.settings.autoHideDelay = Number(value);
						this.plugin.saveSettings();
					});
				});
		}

		new Setting(containerEl)
			.setName("Drag Start Delay (ms)")
			.setDesc(
				"How long to wait before triggering the drag behavior after clicking. ⚠️ Requires an app restart."
			)
			.addText((textfield) => {
				textfield.setPlaceholder(String(200));
				textfield.inputEl.type = "number";
				textfield.setValue(String(this.plugin.settings.dragDelay));
				textfield.onChange(async (value) => {
					this.plugin.settings.dragDelay = Number(value);
					this.plugin.saveSettings();
				});
			});
	}
}

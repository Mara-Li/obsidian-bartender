import Fuse from "fuse.js";
import {Menu, TAbstractFile, TFile, TFolder, requireApiVersion, FileExplorerView, sanitizeHTMLToDom} from "obsidian";
import {BartenderSettings} from "../settings/settings";

let Collator = new Intl.Collator(undefined, {
  usage: "sort",
  sensitivity: "base",
  numeric: true,
}).compare;

let Sorter = {
  alphabetical: function (first: TFile, second: TFile) {
    return Collator(first.basename, second.basename);
  },
  alphabeticalReverse: function (first: TFile, second: TFile) {
    return -Sorter.alphabetical(first, second);
  },
  byModifiedTime: function (first: TFile, second: TFile) {
    return second.stat.mtime - first.stat.mtime;
  },
  byModifiedTimeReverse: function (first: TFile, second: TFile) {
    return -Sorter.byModifiedTime(first, second);
  },
  byCreatedTime: function (first: TFile, second: TFile) {
    return second.stat.ctime - first.stat.ctime;
  },
  byCreatedTimeReverse: function (first: TFile, second: TFile) {
    return -Sorter.byCreatedTime(first, second);
  },
};

const Translate = i18next.t.bind(i18next);

const SortGlyph = "arrow-up-narrow-wide";

const MOVE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-move svg-icon"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/></svg>'

const DEFAULT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-narrow-wide svg-icon"><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M11 12h4"/><path d="M11 16h7"/><path d="M11 20h10"/></svg>';

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

export const folderSort = function (order: string[], foldersOnBottom?: boolean) {
  let fileExplorer = this.view,
    folderContents = this.file.children.slice();
  folderContents.sort(function (firstEl: TFile | TFolder, secondEl: TFile | TFolder) {
    let firstIsFolder, secondIsFolder;
    if (
      foldersOnBottom &&
      ((firstIsFolder = firstEl instanceof TFolder) || (secondIsFolder = secondEl instanceof TFolder))
    ) {
      return firstIsFolder && !secondIsFolder
        ? 1
        : secondIsFolder && !firstIsFolder
        ? -1
        : Collator(firstEl.name, secondEl.name);
    } else {
      if (!order) return Collator(firstEl.name, secondEl.name);

      const index1 = order.indexOf(firstEl.path);
      const index2 = order.indexOf(secondEl.path);

      return (index1 > -1 ? index1 : Infinity) - (index2 > -1 ? index2 : Infinity);
    }
  });
  const items = folderContents
    .map((child: TAbstractFile) => fileExplorer.fileItems[child.path])
    .filter((f: TAbstractFile) => f);

  if (requireApiVersion && requireApiVersion("0.15.0")) {
    this.vChildren.setChildren(items);
  } else {
    this.children = items;
  }
};

export const addSortButton = function (settings:BartenderSettings, sorter: any, sortOption: any,setSortOrder:any,currentSort:any) {
  let plugin = this;
  console.log(settings.sortOrder);
  let sortEl = this.addNavButton(
    settings.sortOrder === "custom" ? "move" : "arrow-up-narrow-wide",
    Translate("plugins.file-explorer.action-change-sort"),
    function (event: MouseEvent) {
      event.preventDefault();
      let menu = new Menu();
      for (
        let currentSortOption = settings.sortOrder, groupIndex = 0, _sortOptionGroups = sortOptionGroups;
        groupIndex < _sortOptionGroups.length;
        groupIndex++
      ) {
        for (
          let addMenuItem = function (_sortOption: keyof typeof sortOptionStrings) {
              let label = Translate(sortOptionStrings[_sortOption]);
              menu.addItem(function (item) {
                return item
                  .setTitle(label)
                  .setActive(_sortOption === currentSortOption)
                  .onClick(function () {
                    if (_sortOption !== currentSortOption) {
                      sortEl.setAttribute("data-sort-method", _sortOption);
                      plugin.app.workspace.trigger("file-explorer-sort-change", _sortOption);
                    }
                    setSortOrder(_sortOption);
                    if (_sortOption === "custom") {
                      const svg = sortEl.querySelector("svg");
                      if (svg) {
                        svg.remove();
                        sortEl.appendChild(
                          sanitizeHTMLToDom(MOVE_ICON)
                        );
                      }
                    } else {
                      const svg = sortEl.querySelector("svg");
                      if (svg) {
                        svg.remove();
                        sortEl.appendChild(
                          sanitizeHTMLToDom(DEFAULT_ICON))
                      }
                    }
                    
                  });
              });
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
  this.addNavButton("three-horizontal-bars", "Drag to rearrange", function (event: MouseEvent) {
    event.preventDefault();
    let value = !this.hasClass("is-active");
    this.toggleClass("is-active", value);
    plugin.app.workspace.trigger("file-explorer-draggable-change", value);
  }).addClass("drag-to-rearrange");
  this.addNavButton("search", "Filter items", function (event: MouseEvent) {
    event.preventDefault();
    let value = !this.hasClass("is-active");
    this.toggleClass("is-active", value);
    let filterEl = document.body.querySelector(
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
    plugin.app.workspace.trigger("file-explorer-draggable-change", value);
  });
  return sortEl;
};

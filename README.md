# Obsidian Bartender

> [!WARNING]
> The plugin is heavely experimental and use some internal function of Obsidian to make it works. It can break at any update of Obsidian.  
> As I'm not the original maintener some part of the code are obscure to me. I will try to fix any bug you can [make](https://github.com/Mara-Li/obsidian-bartender/issues/new?assignees=&labels=bug&projects=&template=bug_report.yml&title=%5BBug%5D%3A+), but new feature can be difficult to support.  
> More over, the loading of the plugin and the unloading doesn't work pretty well, and you **always** should to reload Obsidian to make it works.

Take control of your Obsidian workspace by organizing, rearranging, and filtering the file explorer. It also add collapse (optionally) in the status bar and ribbon.

## File Explorer

To rearrange :
- Click on the sort icon ![image](https://github.com/Mara-Li/obsidian-bartender/assets/30244939/146d3e09-43f6-4b7f-8509-ed15d4427ccf)
- Choose "custom", the icon will change to: ![image](https://github.com/Mara-Li/obsidian-bartender/assets/30244939/9bb320f1-0e52-46cd-8e70-c02181c52619) and a burger button will appear next to it: ![image](https://github.com/Mara-Li/obsidian-bartender/assets/30244939/8c41438c-8690-41e2-a4a2-83c29d203486)
- Click on the burger
- Now, drag and drop the folder or files you want to move.
- When you are pleased, click again on the burger to disable rearranging.
- Keep the sort option on custom to keep your rearrange. If you want to return at any sort of Obsidian, just click again on the "move" icon and choose your sort. 

### Filtering

The file explorer can be filtered using fuse.js extended search syntax:

White space acts as an **AND** operator, while a single pipe (`|`) character acts as an **OR** operator. To escape white space, use double quote ex. `="scheme language"` for exact match.

| Token       | Match type                 | Description                            |
| ----------- | -------------------------- | -------------------------------------- |
| `jscript`   | fuzzy-match                | Items that fuzzy match `jscript`       |
| `=scheme`   | exact-match                | Items that are `scheme`                |
| `'python`   | include-match              | Items that include `python`            |
| `!ruby`     | inverse-exact-match        | Items that do not include `ruby`       |
| `^java`     | prefix-exact-match         | Items that start with `java`           |
| `!^erlang` | inverse-prefix-exact-match | Items that do not start with `erlang` |
| `.js$`      | suffix-exact-match         | Items that end with `.js`              |
| `!.go$`     | inverse-suffix-exact-match | Items that do not end with `.go`       |

White space acts as an **AND** operator, while a single pipe (`|`) character acts as an **OR** operator.

## Installation

- [x] Using [BRAT](https://tfthacker.com/BRAT) with `https://github.com/mara-li/obsidian-bartender`
      → Or copy and open `obsidian://brat?plugin=mara-li/obsidian-bartender` in your explorer or browser. It will automatically open Obsidian and install the plugin.
- [x] From the release page: 
    - Download the latest release
    - Unzip `obsidian-bartender.zip` in `.obsidian/plugins/` path
    - In Obsidian settings, at "Community Plugin", reload the plugin list
    - Enable the plugin (or reload it if already installed)

## Credit

- <ins>Original work</ins>: [NothingIsLost](https://github.com/nothingislost/obsidian-bartender/)
- <ins>Update for Obsidian 1.5.8</ins>: [zansbang](https://github.com/zansbang/obsidian-bartender)

---
<a style="text-align: right;display: inline-block" href="https://discord.gg/EXADYbWuMH">Discord server support</a>
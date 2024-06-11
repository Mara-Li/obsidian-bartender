# Obsidian Bartender

Take control of your Obsidian workspace by organizing, rearranging, and filtering the file explorer. It also add collapse (optionally) in the status bar and ribbon.

## File Explorer
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


import builtins from "builtin-modules";
import { Command } from "commander";
import dotenv from "dotenv";
import esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import process from "process";
import packageJson from "./package.json" assert { type: "json" };

dotenv.config();

const program = new Command();
program
	.option("-p, --production", "Production build")
	.option("-v, --vault", "Use vault path")
	.option("-o, --output-dir <path>", "Output path")
	.parse();

program.parse();
const opt = program.opts();
const prod = opt.production ?? false;
const exportToVault = opt.vault ?? false;
const manifest = JSON.parse(fs.readFileSync("./manifest.json", "utf-8"));

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin: ${packageJson.repository}
*/
`;

const pluginID = manifest.id;
const vaultPath = process.env.VAULT;
const folderPlugin = vaultPath
	? path.join(vaultPath, ".obsidian", "plugins", pluginID)
	: undefined;

if (vaultPath && exportToVault && !fs.existsSync(folderPlugin)) {
	fs.mkdirSync(folderPlugin, { recursive: true });
}

const style = fs.existsSync("src/styles.css");

let outdir = "./";
if (opt.outputDir) {
	outdir = opt.outputDir;
} else if (exportToVault) {
	outdir = folderPlugin;
	if (!prod) fs.writeFileSync(path.join(folderPlugin, ".hotreload"), "");
} else if (prod) {
	outdir = "./dist";
}

const moveStyles = {
	name: "move-styles",
	setup(build) {
		build.onEnd(() => {
			if (style) fs.copyFileSync("src/styles.css", "./styles.css");
		});
	},
};

const exportToVaultFunc = {
	name: "export-to-vault",
	setup(build) {
		build.onEnd(() => {
			if (!(prod && exportToVault)) {
				return;
			}
			if (!folderPlugin) {
				console.error(
					"VAULT environment variable not set, skipping export to vault",
				);
				return;
			}

			fs.copyFileSync(`${outdir}/main.js`, path.join(folderPlugin, "main.js"));
			if (fs.existsSync(`${outdir}/styles.css`))
				fs.copyFileSync("./styles.css", path.join(folderPlugin, "styles.css"));
			fs.copyFileSync(
				"./manifest.json",
				path.join(folderPlugin, "manifest.json"),
			);
		});
	},
};

const exportToDist = {
	name: "export-to-dist",
	setup(build) {
		build.onEnd(() => {
			if (!prod) {
				return;
			}
			fs.copyFileSync("manifest.json", path.join(outdir, "manifest.json"));
		});
	},
};

const entryPoints = ["src/main.ts"];
if (style) entryPoints.push("src/styles.css");

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints,
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins,
	],
	format: "cjs",
	target: "esnext",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	minifySyntax: prod,
	minifyWhitespace: prod,
	outdir,
	plugins: [moveStyles, exportToDist, exportToVaultFunc],
});

if (prod) {
	console.log("🎉 Build for production");
	console.log(`📤 Output directory: ${outdir}`);
	await context.rebuild();
	console.log("✅ Build successful");
	process.exit(0);
} else {
	console.log("🚀 Start development build");
	console.log(`📤 Output directory: ${outdir}`);
	await context.watch();
}

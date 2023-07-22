import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { Extension, Facet, Text } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";

// TODO: Add some settings here for what line length to break on
interface HardBreakPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: HardBreakPluginSettings = {
	mySetting: "default",
};

const isLongLineChange = (view: EditorView) => {
	return (
		fromA: number,
		toA: number,
		fromB: number,
		toB: number,
		inserted: Text,
	) => {
		const state = view.state;
		if (state.doc.lineAt(toB).length > 80) {
			// TODO: currently doesn't handle backspacing to override the short line length. The backspace just
			//  immediately triggers this again. Might need to watch the changes to see how to detect this and not
			//  add the newline.
			const wordSelectionAtEndOfLine = state.wordAt(toB);
			if (wordSelectionAtEndOfLine?.empty == false) {
				const wordFrom = wordSelectionAtEndOfLine.from;
				const wordTo = wordSelectionAtEndOfLine.to;
				const wordAtEndOfLine = state.sliceDoc(wordFrom, wordTo);
				const changes = [
					{
						from: wordFrom,
						to: wordTo,
					},
					{
						from: wordFrom,
						to: wordFrom,
						insert: state.lineBreak,
					},
					{
						from: wordFrom + 1,
						to: wordFrom + 1,
						insert: wordAtEndOfLine,
					},
				];
				view.dispatch({
					changes,
					selection: {
						anchor: wordFrom + 1 + wordAtEndOfLine.length,
					},
				});
			}
		}
	};
};

const editorExtension: Extension = [
	EditorView.updateListener.of((update: ViewUpdate) => {
		if (update.docChanged) {
			// TODO: Needs a refactor, this probably doesn't need to iterate over all changes, perhaps it just wants to
			//  look at one of the changes? Or compare the old and the new state to see whether it pushed a line
			//  length over 80 characters?
			update.changes.iterChanges(isLongLineChange(update.view));
		}
	}),
];

export default class MyPlugin extends Plugin {
	settings: HardBreakPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"Sample Plugin",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("This is a notice!");
			},
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open sample modal (simple)",
			callback: () => {
				new SampleModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: "open-sample-modal-complex",
			name: "Open sample modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerEditorExtension(editorExtension);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}

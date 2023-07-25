import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import {
	CharCategory,
	EditorSelection,
	EditorState,
	Line,
	SelectionRange,
	TransactionSpec,
} from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";

interface HardBreakPluginSettings {
	hardWrapLineLength: number;
}

const DEFAULT_SETTINGS: HardBreakPluginSettings = {
	hardWrapLineLength: 120,
};

const shouldHardWrap = (
	oldState: EditorState,
	newState: EditorState,
	hardWrapLength: number,
): boolean => {
	const newSelection = newState.selection;
	const newSelectionHead = newSelection.ranges[newSelection.mainIndex].head;
	const newSelectionLine = newState.doc.lineAt(newSelectionHead);
	// On creating a new line (either as part of this plugin, or through other actions that create a new line)
	// the old state doesn't include the new line. We don't need to do anything in this case, so return false
	if (oldState.doc.lines < newSelectionLine.number) {
		return false;
	}
	const oldSelection = oldState.selection;
	const oldSelectionLine = oldState.doc.lineAt(
		oldSelection.ranges[oldSelection.mainIndex].head,
	);
	// If the old selection line is greater than the new selection line, we're backspacing and removing a break
	// Also do nothing, because we want you to be able to manually un-break an auto-broken line
	if (oldSelectionLine.number > newSelectionLine.number) {
		return false;
	}
	const newLineLength = newSelectionLine.length;
	const oldLineLength = oldState.doc.line(newSelectionLine.number).length;
	return oldLineLength <= hardWrapLength && newLineLength > hardWrapLength;
};

const findWhitespaceBefore = (
	state: EditorState,
	pos: number,
): SelectionRange => {
	let foundWhitespace = true;
	let leftmostWhitespace = pos;
	while (foundWhitespace) {
		const currentChar = state.doc.slice(
			leftmostWhitespace,
			leftmostWhitespace + 1,
		);
		if (
			state.charCategorizer(leftmostWhitespace)(currentChar.toString()) ==
			CharCategory.Space
		) {
			leftmostWhitespace = leftmostWhitespace - 1;
		} else {
			foundWhitespace = false;
		}
	}
	return EditorSelection.range(leftmostWhitespace - 1, pos);
};

const getStartOfLineWhitespace = (line: Line): string => {
	/* Regex explanation
	   First, match any whitespace
	   Then, match either:
	   * `* ` indicating an unordered list
	   * `- ` also indicating an unordered list
	   * `1. ` indicating an ordered list
	   Then match any other whitespace
	 */
	const startOfLine = line.text.match(/^\s*(([-*]|(\d+\.)) )?\s*/g);
	if (startOfLine === null) {
		return "";
	}

	// Replace non-whitespace characters with spaces
	return startOfLine[0].replace(/[-*\d.]/, " ");
};

const createWrapLineTransaction = (state: EditorState): TransactionSpec => {
	const newSelectionHead =
		state.selection.ranges[state.selection.mainIndex].head;
	const wordSelectionAtEndOfLine = state.wordAt(newSelectionHead);
	if (wordSelectionAtEndOfLine?.empty == false) {
		// If there's a word at the end of the line, we need to:
		// * Remove the word at the end of the line
		// * Remove any preceding whitespace
		// * Insert a line break
		// * Insert any required indentation
		// * Add the removed word on the new line (after the line break)
		const wordFrom = wordSelectionAtEndOfLine.from;
		const wordTo = wordSelectionAtEndOfLine.to;
		const wordAtEndOfLine = state.sliceDoc(wordFrom, wordTo);
		const endOfLineWhitespace = findWhitespaceBefore(state, wordFrom);
		const line = state.doc.lineAt(newSelectionHead);
		// TODO: We may want to turn this value into the native intent character
		//  i.e. if we get back 6 whitespace, we can turn that in to 3 tabs if the tabsize is 2
		const startOfLineWhitespace = getStartOfLineWhitespace(line);
		const changes = [
			{
				from: wordFrom,
				to: wordTo,
			},
			{
				from: endOfLineWhitespace.anchor,
				to: wordTo,
			},
			{
				from: endOfLineWhitespace.anchor,
				to: endOfLineWhitespace.anchor,
				insert: state.lineBreak,
			},
			{
				from: endOfLineWhitespace.anchor + 1,
				to: endOfLineWhitespace.anchor + 1,
				insert: startOfLineWhitespace,
			},
			{
				from: endOfLineWhitespace.anchor + startOfLineWhitespace.length,
				to: endOfLineWhitespace.anchor + startOfLineWhitespace.length,
				insert: wordAtEndOfLine,
			},
		];
		return {
			changes,
			selection: {
				anchor:
					endOfLineWhitespace.anchor +
					startOfLineWhitespace.length +
					wordAtEndOfLine.length +
					1,
			},
		};
	} else {
		// There's no word at the end of the line. If the character that took us over the line length limit was a
		// newline, then we have nothing to do
		const finalLineCharacter = state.sliceDoc(
			newSelectionHead,
			newSelectionHead,
		);
		if (finalLineCharacter == "\n") {
			return {};
		}
		// Otherwise, delete the whitespace that was just added and add a newline instead
		const changes = [
			{
				from: newSelectionHead - 1,
				to: newSelectionHead,
			},
			{
				from: newSelectionHead - 1,
				to: newSelectionHead - 1,
				insert: state.lineBreak,
			},
		];
		return {
			changes,
			selection: {
				anchor: newSelectionHead,
			},
		};
	}
};

export default class HardBreakPlugin extends Plugin {
	settings: HardBreakPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new HardBreakSettingsTab(this.app, this));

		this.registerEditorExtension(
			EditorView.updateListener.of((update: ViewUpdate) => {
				if (
					update.docChanged &&
					shouldHardWrap(
						update.startState,
						update.state,
						// If we wrap when the line is at hardWrapLineLength, when we add the newline, it will be 1
						// over the limit. So we have to wrap at 1 less than the limit.
						this.settings.hardWrapLineLength - 1,
					)
				) {
					const hardWrapTransaction = createWrapLineTransaction(
						update.state,
					);
					update.view.dispatch(hardWrapTransaction);
				}
			}),
		);
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

class HardBreakSettingsTab extends PluginSettingTab {
	plugin: HardBreakPlugin;

	constructor(app: App, plugin: HardBreakPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Hard break length")
			.setDesc("The line length to hard break a line at")
			.addSlider((slider) => {
				slider
					.setLimits(50, 240, 1)
					.setValue(this.plugin.settings.hardWrapLineLength)
					.setDynamicTooltip()
					.onChange(async (value: number) => {
						this.plugin.settings.hardWrapLineLength = value;
						await this.plugin.saveSettings();
					});
			});
	}
}

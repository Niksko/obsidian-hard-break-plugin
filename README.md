# Obsidian hard break plugin

This plugin allows Obsidian to insert hard linebreaks in long lines, emulating a feature that I like in Webstorm.
This allows markdown to remain readable, and makes it easier to navigate markdown documents because they have
shorter lines.

This is a bit of a toy to help explore how to write Obsidian plugins, but it also fixes a genuine frustration.

What's working:

* Lines will break at a specified line length
* This length is configurable via plugin settings
* If you're in the middle of a word, it will be moved to the next line
* Preceding whitespace will be trimmed after the word you're in the middle of is moved to the next line
* If you break the line yourself at the exact length of the line, the plugin will not add a second newline, as you 
  would expect
* If you're in the middle of whitespace when the line limit is reached, no whitespace will be trimmed

What still needs work (in order of priority):

* If you want to override the line break by going to the start of the newly broken line and backspacing, this won't 
  work if you immediately backspace.
  This is because since we trimmed the whitespace, your line length is now back at the threshold for breaking.
  I _think_ to solve this we might need to use some state to temporarily disable checking for longer lines until 
  either we exceed the line length, or we move our selection somewhere else.
* Pretty sure this will not work for right-to-left texts.
  I need to adjust all of the manual offsetting I'm doing to be inverted for RTL text

## Development

Watch for changes and continuously rebuild: `pnpm run dev`

Lint and check formatting: `pnpm run lint`

Prettier format: `pnpm run format`

## Release process

1. If the new code requires a newer version of Obsidian, update `minAppVersion` in `manifest.json`
1. Run `pnpm version patch|minor|major` to bump the versions in the `manifest.json` and the `package.json` and update 
   the `versions.json` file
1. Build plugin code and CSS: `pnpm run build`
1. Create a GitHub release with the new version number, without the `v` in front
1. Upload the `main.js`, `styles.css` and `manifest.json` to the release
1. Make a PR to [https://github.com/obsidianmd/obsidian-releases]()

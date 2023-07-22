# Obsidian hard break plugin

This plugin allows Obsidian to insert hard linebreaks in long lines, emulating a feature that I like in Webstorm.
This allows markdown to remain readable, and makes it easier to navigate markdown documents because they have 
shorter lines.

This is a bit of a toy to help explore how to write Obsidian plugins.

Still very much TODO, but so far I have the core functionality working where if you take a line over 80 characters, 
it will remove the current word, add a newline, and the put the word on the new line.

Still TODO (these also have comments in the code):
* Refactor so that we're not computing whether the word is too long on every change in an update
* Add some settings, at the very least a configurable length to break on
* Webstorm's implementation is fairly clever, it will continue with the current markdown block.
  For example, if I'm in the middle of typing a comment and I hit the length limit, it will break but it will assume 
  I want to continue writing the comment, so it will add the right amount of indentation to do this.

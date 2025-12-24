---
model: opus
description: Generate a specification for user tasks
argument-hint: [spec file] [user instructions]
---

## Variables

SPEC_FILE: $ARGUMENTS[0]
USER_INSTRUCTIONS: $ARGUMENTS[1]

## Instructions

Generate a slash command or document with name {SPEC_FILE} according to {USER_INSTRUCTIONS}. Put details as much as possible.
If {SPEC_FILE} starts with '/...', then it is a slash command, put the generated document as `.claude/commands/{SPEC_FILE}.md`. You must also follow the format of the existing slash commands in `.claude/commands/`.
Otherwise it is a document, just genreate it in the current directory.

If the spec file already exists, then just update it according to {USER_INSTRUCTIONS}.
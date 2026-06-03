## Project memory (memory-first discipline)

This repo keeps a durable, linked knowledge base in `.claude/memory/` (an
Obsidian-style graph of notes). The global `project-memory` skill governs how to
read and write it.

- At the start of a task, orient from `.claude/memory/index.md` and the SessionStart
  context before opening source files. Read targeted files to confirm current state
  before editing; do not re-scan the whole repo to rebuild understanding a note
  already captures.
- As work progresses, record durable knowledge (module maps, decisions, gotchas,
  design tokens) as small linked notes and update `index.md`. Knowledge not written
  down is lost when context is compacted.
- Build/test/lint commands and code conventions live in `.claude/memory/conventions.md`.
- When building or restyling UI, the global `ui-design` skill applies; record chosen
  design tokens in `.claude/memory/components/`.

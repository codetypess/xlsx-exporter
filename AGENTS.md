# Agent Instructions

For `.xlsx` tasks, follow [ai/skills/xlsx-agent/WORKFLOW.md](ai/skills/xlsx-agent/WORKFLOW.md).

Key rules:

- Prefer the `fastxlsx` CLI over direct workbook XML edits.
- Use the first available CLI entry: `fastxlsx`, then `npx fastxlsx`, then `npm run cli --` only inside this repository root.
- Inspect before writing and validate after writing.
- If `table-profiles.json` exists, prefer `--profile`.
- For `apply --ops`, read [ai/skills/xlsx-agent/OPS-SCHEMA.md](ai/skills/xlsx-agent/OPS-SCHEMA.md).

This file is only a repo-root discovery hook. Keep detailed workflow changes in `ai/skills/xlsx-agent/` so all agent entrypoints stay aligned.

---
name: xlsx-agent
description: Edit and validate `.xlsx` workbooks through the `fastxlsx` CLI. Use for config-table updates, structured-sheet edits, sheet management, style changes, and roundtrip-safe workbook modifications instead of touching workbook XML directly.
---

# Xlsx Agent

This skill is a thin adapter over the shared workflow in [ai/skills/xlsx-agent/WORKFLOW.md](../../ai/skills/xlsx-agent/WORKFLOW.md).

Keep this file short on purpose. Agent discovery happens here, but the canonical workflow lives in one shared location so Codex, Cursor, and Claude do not drift apart.

## Use This Skill For

- Inspecting `.xlsx` workbooks before editing
- Single-cell edits and style updates
- `config-table` updates
- Structured `table` edits and profile-based workflows
- Deterministic multi-step edits through `apply --ops`
- Roundtrip validation after workbook changes

## Command Entry

Use the first available CLI entry:

```bash
fastxlsx <subcommand> ...
```

If `fastxlsx` is not on `PATH` but the package is available:

```bash
npx fastxlsx <subcommand> ...
```

Only when working inside the `fastxlsx` repository root:

```bash
npm run cli -- <subcommand> ...
```

The shared workflow document uses `fastxlsx` as shorthand for whichever entry is available.

## Canonical References

- Workflow: [ai/skills/xlsx-agent/WORKFLOW.md](../../ai/skills/xlsx-agent/WORKFLOW.md)
- Ops schema: [ai/skills/xlsx-agent/OPS-SCHEMA.md](../../ai/skills/xlsx-agent/OPS-SCHEMA.md)

Read the workflow document before editing. Read the ops schema only when preparing an `apply --ops` payload.

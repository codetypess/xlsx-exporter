# XLSX Workflow

Use this document as the canonical workflow for `.xlsx` tasks across different agents.

## CLI Entry Selection

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

This order keeps the workflow portable:

- `fastxlsx` covers globally installed or published-package usage.
- `npx fastxlsx` covers project-local package usage without requiring a global install.
- `npm run cli --` is last because it only works inside this repository root and depends on repo-local development tooling.

The examples below use `fastxlsx` as shorthand. Replace it with the available entry above.

## Default Workflow

1. Inspect before writing so sheet names, header rows, and workbook structure are confirmed first.
2. Read the exact sheet, cell, or table row that will change so structured rows and offsets are not guessed.
3. Apply the smallest fitting command so the change stays reviewable and roundtrip-safe.
4. Validate after writing so packaging or serialization regressions are caught immediately.
5. Re-read exact results when output correctness matters so the final workbook, not the intended command, is being verified.

Start with:

```bash
fastxlsx inspect path/to/file.xlsx
fastxlsx get path/to/file.xlsx --sheet Sheet1 --cell B2
fastxlsx validate path/to/file.xlsx
```

Use `--in-place` only when the user clearly wants to overwrite the source workbook.

## Command Choice

Use `inspect` and `get` for read-only discovery:

```bash
fastxlsx inspect path/to/file.xlsx
fastxlsx get path/to/file.xlsx --sheet Sheet1 --cell B2
```

Use `set` for single-cell edits:

```bash
fastxlsx set path/to/file.xlsx --sheet Sheet1 --cell B2 --text "hello" --output out.xlsx
fastxlsx set path/to/file.xlsx --sheet Sheet1 --cell C2 --formula "B2*0.9" --cached-value 110.7 --output out.xlsx
fastxlsx set path/to/file.xlsx --sheet Sheet1 --cell D2 --clear --output out.xlsx
```

Use direct workbook and style commands for targeted changes:

```bash
fastxlsx add-sheet path/to/file.xlsx --sheet Summary --output out.xlsx
fastxlsx rename-sheet path/to/file.xlsx --from Sheet1 --to Config --output out.xlsx
fastxlsx delete-sheet path/to/file.xlsx --sheet Scratch --output out.xlsx
fastxlsx copy-style path/to/file.xlsx --sheet Config --from B2 --to C2 --output out.xlsx
fastxlsx set-number-format path/to/file.xlsx --sheet Config --cell B2 --format '0.00%' --output out.xlsx
fastxlsx set-background-color path/to/file.xlsx --sheet Config --cell B2 --color FFFF0000 --output out.xlsx
```

Use `apply` for deterministic multi-step edits:

```bash
fastxlsx apply path/to/file.xlsx --ops /tmp/xlsx-agent-ops.json --output out.xlsx
```

Use `apply` only when the change genuinely spans multiple actions. Single-cell or single-command edits are easier to audit when kept as direct CLI commands.

For `apply --ops`, read [OPS-SCHEMA.md](OPS-SCHEMA.md).

Use `config-table` for header-based config sheets where each row is a record under one header row:

```bash
fastxlsx config-table init path/to/file.xlsx --sheet Config --headers '["Key","Value"]' --output out.xlsx
fastxlsx config-table list path/to/file.xlsx --sheet Config
fastxlsx config-table get path/to/file.xlsx --sheet Config --field Key --text timeout
fastxlsx config-table upsert path/to/file.xlsx --sheet Config --field Key --record '{"Key":"timeout","Value":"30"}' --in-place
fastxlsx config-table delete path/to/file.xlsx --sheet Config --field Key --text timeout --output out.xlsx
fastxlsx config-table replace path/to/file.xlsx --sheet Config --records '[{"Key":"timeout","Value":"30"}]' --output out.xlsx
fastxlsx config-table sync path/to/file.xlsx --sheet Config --from-json config.json --mode upsert --output out.xlsx
```

Use `table` for structured sheets with explicit header and data row boundaries:

```bash
fastxlsx table inspect path/to/file.xlsx --sheet main --header-row 1 --data-start-row 6
fastxlsx table list path/to/file.xlsx --sheet main --header-row 1 --data-start-row 6
fastxlsx table get path/to/file.xlsx --sheet main --header-row 1 --data-start-row 6 --key 1001 --key-field id
fastxlsx table upsert path/to/file.xlsx --sheet main --header-row 1 --data-start-row 6 --key-field id --record '{"id":1001,"desc":"..."}' --in-place
fastxlsx table delete path/to/file.xlsx --sheet main --header-row 1 --data-start-row 6 --key 1001 --key-field id --output out.xlsx
fastxlsx table sync path/to/file.xlsx --sheet main --header-row 1 --data-start-row 6 --key-field id --from-json rows.json --mode replace --output out.xlsx
```

Treat rows such as `auto`, `>>`, `!!!`, `###`, and `-` as structure to preserve, not built-in business semantics.

## Profiles

If `table-profiles.json` already exists, prefer `--profile`. The default profiles file is `table-profiles.json`; override it with `--profiles-file` when needed.

Profiles matter because they freeze the agreed sheet name, header row, data start row, and key fields in one place instead of repeating them in every command.

```bash
fastxlsx table list res/task.xlsx --profile 'task#main'
fastxlsx table get res/task.xlsx --profile 'task#conf' --key '"GATE_SIEGE_TIME"'
fastxlsx table get res/task.xlsx --profile 'task#define' --key '{"key1":"TASK_TYPE","key2":"MAIN"}'
fastxlsx table upsert res/task.xlsx --profile 'task#main' --record '{"id":1001,"desc":"..."}' --in-place
fastxlsx table sync res/task.xlsx --profile 'task#conf' --from-json conf.json --mode upsert --output out.xlsx
```

If profiles do not exist yet, generate them first:

```bash
fastxlsx table generate-profiles res/task.xlsx
fastxlsx table generate-profiles res/task.xlsx res/monster.xlsx --sheet-filter '^(main|conf)$' --output table-profiles.json
```

Generated names use `文件名#表名`, for example `task#main`.

## Limits

Prefer the CLI over ad hoc scripts or direct workbook XML edits.

That constraint is deliberate: the CLI is the reviewed surface that preserves roundtrip behavior. Direct XML edits or throwaway scripts bypass the guardrails this skill is trying to enforce.

If the current CLI cannot express the requested change:

1. Confirm that existing commands are insufficient.
2. Extend the CLI in this repository.
3. Re-run the workbook change through the CLI.

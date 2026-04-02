# Ops Schema

Use this file when preparing an `ops.json` document for:

```bash
fastxlsx apply path/to/file.xlsx --ops ops.json --output out.xlsx
```

## Contents

- File Shape
- Supported Actions
- Recommended Pattern

## File Shape

Use either of these forms:

```json
[
  { "type": "setCell", "sheet": "Sheet1", "cell": "A1", "value": "hello" }
]
```

```json
{
  "output": "out.xlsx",
  "actions": [
    { "type": "setCell", "sheet": "Sheet1", "cell": "A1", "value": "hello" }
  ]
}
```

`output` is optional. A CLI `--output` flag overrides it.

`apply` is the right choice when the edit spans multiple cells, mixes workbook-level and sheet-level changes, or should be expressed as one deterministic batch.

Actions run in array order. Put workbook setup steps first, then cell or record edits that depend on that setup.

## Supported Actions

### Cell Actions

#### setCell

```json
{ "type": "setCell", "sheet": "Sheet1", "cell": "B2", "value": 123 }
```

`value` must be a JSON scalar: string, number, boolean, or `null`.

#### setBackgroundColor

```json
{ "type": "setBackgroundColor", "sheet": "Config", "cell": "B2", "color": "FFFF0000" }
```

Use `null` to clear a solid background fill:

```json
{ "type": "setBackgroundColor", "sheet": "Config", "cell": "B2", "color": null }
```

#### setFormula

```json
{
  "type": "setFormula",
  "sheet": "Sheet1",
  "cell": "C2",
  "formula": "B2*0.9",
  "cachedValue": 110.7
}
```

`cachedValue` is optional and must be a JSON scalar when present.

#### setNumberFormat

```json
{ "type": "setNumberFormat", "sheet": "Config", "cell": "B2", "formatCode": "0.00%" }
```

#### clearCell

```json
{ "type": "clearCell", "sheet": "Sheet1", "cell": "D2" }
```

Use this when the cell itself should be removed. If a workflow needs a blank value while preserving a deliberate placeholder write, use `setCell` with `null` instead.

#### copyStyle

```json
{ "type": "copyStyle", "sheet": "Config", "from": "B2", "to": "C2" }
```

### Sheet Actions

#### renameSheet

```json
{ "type": "renameSheet", "from": "Sheet1", "to": "Config" }
```

#### addSheet

```json
{ "type": "addSheet", "sheet": "Summary" }
```

#### setHeaders

```json
{ "type": "setHeaders", "sheet": "Config", "headers": ["Key", "Value"] }
```

Optional fields:

- `headerRow`
- `startColumn`

Defaults:

- `headerRow`: `1`
- `startColumn`: `1`

#### deleteSheet

```json
{ "type": "deleteSheet", "sheet": "OldSheet" }
```

### Record Actions

#### addRecord

```json
{
  "type": "addRecord",
  "sheet": "Config",
  "record": { "Key": "timeout", "Value": "30" }
}
```

Optional field:

- `headerRow`

Default `headerRow` is `1`.

#### addRecords

```json
{
  "type": "addRecords",
  "sheet": "Config",
  "records": [
    { "Key": "timeout", "Value": "30" },
    { "Key": "region", "Value": "ap-south-1" }
  ]
}
```

Optional field:

- `headerRow`

Default `headerRow` is `1`.

#### setRecord

```json
{
  "type": "setRecord",
  "sheet": "Config",
  "row": 2,
  "record": { "Key": "timeout", "Value": "60" }
}
```

Optional field:

- `headerRow`

Default `headerRow` is `1`.

#### setRecords

```json
{
  "type": "setRecords",
  "sheet": "Config",
  "records": [
    { "Key": "timeout", "Value": "60" }
  ]
}
```

Optional field:

- `headerRow`

Default `headerRow` is `1`.

#### deleteRecord

```json
{ "type": "deleteRecord", "sheet": "Config", "row": 2 }
```

Optional field:

- `headerRow`

Default `headerRow` is `1`.

#### deleteRecords

```json
{ "type": "deleteRecords", "sheet": "Config", "rows": [2, 4, 7] }
```

Optional field:

- `headerRow`

Default `headerRow` is `1`.

### Workbook Metadata Actions

#### setActiveSheet

```json
{ "type": "setActiveSheet", "sheet": "Config" }
```

#### setSheetVisibility

```json
{ "type": "setSheetVisibility", "sheet": "Config", "visibility": "hidden" }
```

Allowed visibility values:

- `visible`
- `hidden`
- `veryHidden`

#### setDefinedName

Global:

```json
{ "type": "setDefinedName", "name": "ConfigRange", "value": "Config!$A$1:$B$20" }
```

Sheet-scoped:

```json
{ "type": "setDefinedName", "name": "LocalValue", "scope": "Config", "value": "$B$2" }
```

#### deleteDefinedName

Global:

```json
{ "type": "deleteDefinedName", "name": "ConfigRange" }
```

Sheet-scoped:

```json
{ "type": "deleteDefinedName", "name": "LocalValue", "scope": "Config" }
```

## Recommended Pattern

For multi-step workbook edits:

1. Run `inspect` to confirm sheet names and workbook structure before building operations.
2. Build `ops.json` in execution order so dependent steps happen in a predictable sequence.
3. Run `apply` once so the workbook is saved from one deterministic action list.
4. Run `validate` to catch roundtrip or packaging regressions immediately.
5. Re-run `get` on critical cells if exact confirmation is required.

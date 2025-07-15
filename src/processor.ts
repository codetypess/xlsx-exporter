import { convertToConfig, convertToDefine, convertToFold, convertToMap } from "./transform";
import { filterKeys } from "./util";
import { assert, copyOf, error, Processor, Sheet, TObject, Workbook, writers } from "./xlsx";

//-----------------------------------------------------------------------------
// Stringify
//-----------------------------------------------------------------------------
export type StringifyRule = (workbook: Workbook, writer: string) => TObject;
const rules: Record<string, StringifyRule> = {};

export const registerStringifyRule = (name: string, rule: StringifyRule) => {
    assert(!rules[name], `Stringify rule '${name}' already registered`);
    rules[name] = rule;
};

export const mergeSheet = (workbook: Workbook, writer: string) => {
    const result: TObject = {};
    for (const sheetName in workbook.sheets) {
        const sheet = workbook.sheets[sheetName];
        for (const k of filterKeys(sheet.data)) {
            const row = sheet.data[k];
            if (result[k]) {
                error(`Duplicate key: ${k}`);
            }
            result[k] = row;
        }
    }
    return result;
};

export const simpleSheet = (workbook: Workbook, writer: string) => {
    const result: TObject = {};
    for (const k in workbook.sheets) {
        result[k] = workbook.sheets[k].data;
    }
    return result;
};

export const StringifyProcessor: Processor = (
    workbook: Workbook,
    sheet: Sheet,
    ruleName?: string
) => {
    const rule = rules[ruleName ?? "simple"];
    if (!rule) {
        error(`Stringify rule not found: ${ruleName}`);
    }
    for (const k in writers) {
        const filtered = copyOf(workbook, k);
        const writer = writers[k];
        writer(filtered.path, rule(filtered, k), "stringify");
    }
};

//-----------------------------------------------------------------------------
// Define
//-----------------------------------------------------------------------------
export const DefineProcessor: Processor = (workbook: Workbook, sheet: Sheet, action?: string) => {
    const data = convertToDefine(sheet);
    for (const k in writers) {
        const writer = writers[k];
        writer(workbook.path, data, "define");
    }
    if (action !== "keep_sheet") {
        delete workbook.sheets[sheet.name];
    }
};

//-----------------------------------------------------------------------------
// Config
//-----------------------------------------------------------------------------
export const ConfigProcessor: Processor = (workbook: Workbook, sheet: Sheet) => {
    sheet.data = convertToConfig(sheet);
};

//-----------------------------------------------------------------------------
// Map
//-----------------------------------------------------------------------------
export const MapProcessor: Processor = (workbook: Workbook, sheet: Sheet, ...keys: string[]) => {
    sheet.data = convertToMap(sheet, ...keys);
};

//-----------------------------------------------------------------------------
// Fold
//-----------------------------------------------------------------------------
export const FoldProcessor: Processor = (
    workbook: Workbook,
    sheet: Sheet,
    idxKey: string,
    ...foldKeys: string[]
) => {
    sheet.data = convertToFold(sheet, idxKey, ...foldKeys);
};

//-----------------------------------------------------------------------------
// Type Define
//-----------------------------------------------------------------------------
export const TypedefProcessor: Processor = (workbook: Workbook, sheet: Sheet) => {
    for (const k in writers) {
        const writer = writers[k];
        writer(workbook.path, workbook as unknown as TObject, "typedef");
    }
};

import {
    collapseSheet,
    columnSheet,
    configSheet,
    decltype,
    defineSheet,
    mapSheet,
} from "./transform";
import { keys, values } from "./util";
import {
    assert,
    convertors,
    doing,
    Processor,
    registerChecker,
    registerType,
    Sheet,
    TObject,
    TRow,
    TValue,
    Workbook,
    write,
} from "./xlsx";

export type StringifyRule = (workbook: Workbook) => object;
const rules: Record<string, StringifyRule> = {};
const NONE = {};

export const registerStringify = (name: string, rule: StringifyRule) => {
    assert(!rules[name], `Stringify rule '${name}' already registered`);
    rules[name] = rule;
};

export const mergeSheet = (workbook: Workbook, sheetNames?: string[]) => {
    const result: TObject = {};
    for (const sheet of workbook.sheets) {
        if (!sheetNames || sheetNames.includes(sheet.name)) {
            for (const k of keys(sheet.data)) {
                const row = sheet.data[k];
                if (result[k]) {
                    throw new Error(`Duplicate key: ${k}`);
                }
                result[k] = row;
            }
        }
    }
    return result;
};

export const simpleSheet = (workbook: Workbook, sheetNames?: string[]) => {
    const result: TObject = {};
    for (const sheet of workbook.sheets) {
        if (!sheetNames || sheetNames.includes(sheet.name)) {
            result[sheet.name] = sheet.data;
        }
    }
    return result;
};

export const noneSheet = () => {
    return NONE;
};

export const StringifyProcessor: Processor = async (
    workbook: Workbook,
    sheet: Sheet,
    ruleName?: string
) => {
    const rule = rules[ruleName ?? "simple"];
    if (!rule) {
        throw new Error(`Stringify rule not found: ${ruleName}`);
    }
    const data = rule(workbook);
    if (data !== NONE) {
        write(workbook, "stringify", data);
    }
};

export const DefineProcessor: Processor = async (workbook: Workbook, sheet: Sheet) => {
    const data = defineSheet(workbook, sheet);
    write(workbook, "define", data);
    sheet.data = {};
    sheet.ignore = true;
};

export const ConfigProcessor: Processor = async (
    workbook: Workbook,
    sheet: Sheet,
    name?: string
) => {
    const data = configSheet(workbook, sheet);
    if (name) {
        data["!name"] = name;
    }
    sheet.data = data;
    sheet.ignore = true;
};

export const MapProcessor: Processor = async (
    workbook: Workbook,
    sheet: Sheet,
    value: string,
    ...ks: string[]
) => {
    sheet.data = mapSheet(workbook, sheet, value, ...ks);
};

export const CollapseProcessor: Processor = async (
    workbook: Workbook,
    sheet: Sheet,
    ...ks: string[]
) => {
    sheet.data = collapseSheet(workbook, sheet, ...ks);
};

export const ColumnProcessor: Processor = async (
    workbook: Workbook,
    sheet: Sheet,
    idxKey: string,
    ...foldKeys: string[]
) => {
    sheet.data = columnSheet(workbook, sheet, idxKey, ...foldKeys);
};

export const TypedefProcessor: Processor = async (workbook: Workbook, sheet: Sheet) => {
    write(workbook, "typedef", null!);
};

export const AutoRegisterProcessor: Processor = async (workbook: Workbook) => {
    for (const sheet of workbook.sheets) {
        if (!sheet.processors.find((p) => p.name === "define")) {
            continue;
        }
        for (const row of values<TRow>(sheet.data)) {
            const enumName = row["enum"]?.v as string;
            const key1 = row["key1"]?.v as string;
            const key2 = row["key2"]?.v as string;
            const value = row["value"]?.v as string;
            const value_type = row["value_type"]?.v as string;
            if (enumName && key1 && key2 && value !== undefined && value_type) {
                using _ = doing(
                    `Registering type '${enumName}' in '${workbook.path}#${sheet.name}'`
                );
                const typeKeys: Record<string, TValue> = decltype(
                    workbook,
                    workbook.path,
                    sheet.name,
                    key1
                );
                const typeValues: Record<string, string> = keys(typeKeys).reduce(
                    (acc, k) => {
                        acc[String(typeKeys[k])] = k;
                        return acc;
                    },
                    {} as Record<string, string>
                );

                if (!convertors[enumName]) {
                    registerType(enumName, (str) => typeKeys[str]);
                    registerChecker(enumName, () => {
                        return ({ cell }) => typeValues[cell.v as string] !== undefined;
                    });
                }
            }
        }
    }
};

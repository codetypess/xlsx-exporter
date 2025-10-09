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

export type StringifyRule = (workbook: Workbook, writer: string) => TObject;
const rules: Record<string, StringifyRule> = {};

export const registerStringifyRule = (name: string, rule: StringifyRule) => {
    assert(!rules[name], `Stringify rule '${name}' already registered`);
    rules[name] = rule;
};

export const mergeSheet = (workbook: Workbook, writer: string, sheetNames?: string[]) => {
    const result: TObject = {};
    for (const sheetName in workbook.sheets) {
        if (!sheetNames || sheetNames.includes(sheetName)) {
            const sheet = workbook.sheets[sheetName];
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

export const simpleSheet = (workbook: Workbook, writer: string, sheetNames?: string[]) => {
    const result: TObject = {};
    for (const sheetName in workbook.sheets) {
        if (!sheetNames || sheetNames.includes(sheetName)) {
            result[sheetName] = workbook.sheets[sheetName].data;
        }
    }
    return result;
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
    const data = rule(workbook, workbook.writer);
    write(workbook.writer, workbook.path, data, "stringify");
};

export const DefineProcessor: Processor = async (
    workbook: Workbook,
    sheet: Sheet,
    action?: string
) => {
    const data = defineSheet(sheet);
    write(workbook.writer, workbook.path, data, "define");
    sheet.data = {};
    sheet.ignore = true;
};

export const ConfigProcessor: Processor = async (workbook: Workbook, sheet: Sheet) => {
    sheet.data = configSheet(sheet);
    sheet.ignore = true;
};

export const MapProcessor: Processor = async (
    workbook: Workbook,
    sheet: Sheet,
    value: string,
    ...ks: string[]
) => {
    sheet.data = mapSheet(sheet, value, ...ks);
};

export const CollapseProcessor: Processor = async (
    workbook: Workbook,
    sheet: Sheet,
    ...ks: string[]
) => {
    sheet.data = collapseSheet(sheet, ...ks);
};

export const ColumnProcessor: Processor = async (
    workbook: Workbook,
    sheet: Sheet,
    idxKey: string,
    ...foldKeys: string[]
) => {
    sheet.data = columnSheet(sheet, idxKey, ...foldKeys);
};

export const TypedefProcessor: Processor = async (workbook: Workbook, sheet: Sheet) => {
    write(workbook.writer, workbook.path, workbook as unknown as TObject, "typedef");
};

export const AutoRegisterProcessor: Processor = async (workbook: Workbook) => {
    for (const sheetName in workbook.sheets) {
        const sheet = workbook.sheets[sheetName];
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
                const typeKeys: Record<string, TValue> = decltype(workbook.path, sheet.name, key1);
                const typeValues: Record<string, string> = keys(typeKeys).reduce(
                    (acc, k) => {
                        acc[String(typeKeys[k])] = k;
                        return acc;
                    },
                    {} as Record<string, string>
                );

                if (!convertors[enumName]) {
                    registerType(enumName, (str) => typeKeys[str]);
                    registerChecker(
                        enumName,
                        () => (cell) => typeValues[cell.v as string] !== undefined
                    );
                }
            }
        }
    }
};

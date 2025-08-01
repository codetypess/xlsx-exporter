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
    copyOf,
    doing,
    Processor,
    RealType,
    registerChecker,
    registerType,
    Sheet,
    TObject,
    TRow,
    TValue,
    Workbook,
    writers,
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

export const StringifyProcessor: Processor = (
    workbook: Workbook,
    sheet: Sheet,
    ruleName?: string
) => {
    const rule = rules[ruleName ?? "simple"];
    if (!rule) {
        throw new Error(`Stringify rule not found: ${ruleName}`);
    }
    for (const k in writers) {
        const filtered = copyOf(workbook, k);
        const writer = writers[k];
        writer(filtered.path, rule(filtered, k), "stringify");
        workbook.typedefs[k] = {};
        for (const sheetName in filtered.sheets) {
            workbook.typedefs[k][sheetName] = filtered.sheets[sheetName].fields;
        }
    }
};

export const DefineProcessor: Processor = (workbook: Workbook, sheet: Sheet, action?: string) => {
    const data = defineSheet(sheet);
    for (const k in writers) {
        const writer = writers[k];
        writer(workbook.path, data, "define");
    }
    if (action !== "keep_sheet") {
        delete workbook.sheets[sheet.name];
    }
};

export const ConfigProcessor: Processor = (workbook: Workbook, sheet: Sheet) => {
    sheet.data = configSheet(sheet);
};

export const MapProcessor: Processor = (
    workbook: Workbook,
    sheet: Sheet,
    value: string,
    ...ks: string[]
) => {
    sheet.data = mapSheet(sheet, value, ...ks);
};

export const CollapseProcessor: Processor = (workbook: Workbook, sheet: Sheet, ...ks: string[]) => {
    sheet.data = collapseSheet(sheet, ...ks);
};

export const ColumnProcessor: Processor = (
    workbook: Workbook,
    sheet: Sheet,
    idxKey: string,
    ...foldKeys: string[]
) => {
    sheet.data = columnSheet(sheet, idxKey, ...foldKeys);
};

export const TypedefProcessor: Processor = (workbook: Workbook, sheet: Sheet) => {
    for (const k in writers) {
        const writer = writers[k];
        writer(workbook.path, workbook as unknown as TObject, "typedef");
    }
};

export const AutoRegisterProcessor: Processor = (workbook: Workbook) => {
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

                registerType(enumName, value_type as RealType, (str) => typeKeys[str]);

                registerChecker(
                    enumName,
                    () => (cell) => typeValues[cell.v as string] !== undefined
                );
            }
        }
    }
};

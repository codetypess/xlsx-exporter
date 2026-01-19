import { RowIndexer } from "./indexer";
import { values } from "./util";
import {
    Sheet,
    TArray,
    TObject,
    TRow,
    TValue,
    Type,
    Workbook,
    assert,
    checkType,
    convertValue,
    isNotNull,
    toString,
} from "./xlsx";

export const defineSheet = (workbook: Workbook, sheet: Sheet) => {
    checkType(sheet.data, Type.Sheet);

    const config: TObject = {};

    config["!name"] = `${workbook.name}.${sheet.name}`;
    config["!type"] = Type.Define;

    const rows = values<TObject>(sheet.data).map((v) => checkType<TRow>(v, Type.Row));
    for (const row of rows) {
        const typename = row["value_type"].v as string;
        assert(!typename.endsWith("?"), `Type '${typename}' is not valid`);
        const value = convertValue(row["value"], typename);

        if (!row["key1"] && row["key"]) {
            row["key1"] = row["key"];
        }

        let t = config;
        for (let n = 1; n <= 10; n++) {
            const key = toString(row[`key${n}`]);
            if (key) {
                const nextKey = toString(row[`key${n + 1}`]);
                if (nextKey) {
                    t[key] ||= {};
                    t = t[key] as TObject;
                } else {
                    if (t[key]) {
                        throw new Error(`Key '${key}' is already defined`);
                    }
                    t[key] = value;
                    if (row["value_comment"]?.v) {
                        value["!comment"] = toString(row["value_comment"]);
                    } else if (n === 1 && row["comment"]?.v) {
                        value["!comment"] = toString(row["comment"]);
                    }
                }
            } else {
                if (!t["!enum"]) {
                    const enumName = toString(row["enum"]);
                    if (enumName) {
                        t["!enum"] = enumName;
                    }
                }
                if (!t["!comment"]) {
                    const comment = toString(row["comment"]);
                    if (comment) {
                        t["!comment"] = comment;
                    }
                }
                break;
            }
        }
    }

    return config;
};

export const configSheet = (
    workbook: Workbook,
    sheet: Sheet,
    nameKey = "key",
    valueKey = "value",
    typeKey = "value_type",
    commentKey = "value_comment"
) => {
    checkType(sheet.data, Type.Sheet);

    const result: TObject = {};
    result["!name"] = `${workbook.name}.${sheet.name}`;
    result["!type"] = Type.Config;
    const rows = values<TObject>(sheet.data).map((v) => checkType<TRow>(v, Type.Row));
    for (const row of rows) {
        assert(row[nameKey]?.v !== undefined, `Key '${nameKey}' is not found`);
        assert(row[valueKey]?.v !== undefined, `Value '${valueKey}' is not found`);
        assert(row[typeKey]?.v !== undefined, `Type '${typeKey}' is not found`);
        assert(row[commentKey]?.v !== undefined, `Comment '${commentKey}' is not found`);
        const key = row[nameKey].v as string;
        const typename = row[typeKey].v as string;
        assert(!typename.endsWith("?"), `Type '${typename}' is not valid`);
        const value = convertValue(row[valueKey], typename);
        value["!comment"] = row[commentKey].v as string;
        result[key] = value;
    }
    return result;
};

/**
 * Convert a single key table to a multi-key table
        example:
        
        t = {
            {id1: 1, id2: 1, data: 1111},
            {id1: 1, id2: 5, data: 2222},
        }

        convertToMap(t, "id1", "id2")
        =>
        t = {
            [1] = {
                [1] = {id1: 1, id2: 1, data: 1111},
                [5] = {id1: 1, id2: 5, data: 2222},
            }
        }
 */
export const mapSheet = (workbook: Workbook, sheet: Sheet, value: string, ...keys: string[]) => {
    checkType(sheet.data, Type.Sheet);

    const queryValue = (() => {
        if (value === "*") {
            return (row: TRow) => row;
        } else if (value.startsWith(".")) {
            return (row: TRow) => row[value.slice(1)];
        } else if (
            (value.startsWith("{") && value.endsWith("}")) ||
            (value.startsWith("[") && value.endsWith("]"))
        ) {
            const isObject = value.startsWith("{");
            const ks = value
                .slice(1, -1)
                .split(",")
                .map((k) => k.trim());
            return (row: TRow) => {
                const result: TObject | TArray = isObject ? {} : [];
                for (const k of ks) {
                    const v = row[k];
                    if (!v) {
                        throw new Error(`Key '${k}' is not found`);
                    }
                    if (isObject) {
                        (result as TObject)[k] = v;
                    } else {
                        (result as TArray).push(v);
                    }
                }
                return result;
            };
        } else {
            throw new Error(`Invalid value query: ${value}`);
        }
    })();

    const result: { [key: string]: TValue } = {};
    const rows = values<TObject>(sheet.data).map((v) => checkType<TRow>(v, Type.Row));
    for (const row of rows) {
        let t = result;
        for (let i = 0; i < keys.length; i++) {
            const key = (row[keys[i]]?.v ?? "") as string;
            if (key === "") {
                throw new Error(`Key '${keys[i]}' is not found`);
            }
            if (i === keys.length - 1) {
                t[key] = queryValue(row);
            } else {
                if (!t[key]) {
                    t[key] = {};
                }
                t = t[key] as TObject;
            }
        }
    }
    return result;
};

export const columnSheet = (
    workbook: Workbook,
    sheet: Sheet,
    idxKey: string,
    ...foldKeys: string[]
) => {
    checkType(sheet.data, Type.Sheet);

    const rows = values<TObject>(sheet.data).map((v) => checkType<TRow>(v, Type.Row));

    const result: { [key: string]: TObject } = {};
    for (const row of rows) {
        const idx = (row[idxKey]?.v ?? "") as string;
        if (idx === "") {
            throw new Error(`Key '${idxKey}' is not found`);
        }
        let value = result[idx];
        if (!value) {
            result[idx] = { ...row };
            value = result[idx];
            delete value[sheet.fields[0].name];
            for (const k of foldKeys) {
                value[k] = [];
            }
        }
        for (const k of foldKeys) {
            const v = row[k];
            if (isNotNull(v)) {
                (value[k] as TArray).push(v);
            }
        }
    }

    for (const field of sheet.fields) {
        if (foldKeys.includes(field.name)) {
            field.realtype = field.typename.replaceAll("?", "") + "[]";
        }
    }

    return result;
};

export const collapseSheet = (workbook: Workbook, sheet: Sheet, ...keys: string[]) => {
    checkType(sheet.data, Type.Sheet);
    const result: { [key: string]: TValue } = {};
    const rows = values<TObject>(sheet.data).map((v) => checkType<TRow>(v, Type.Row));
    for (const row of rows) {
        let t = result;
        for (let i = 0; i < keys.length; i++) {
            const key = (row[keys[i]]?.v ?? "") as string;
            if (key === "") {
                throw new Error(`Key '${keys[i]}' is not found`);
            }

            if (!t[key]) {
                t[key] = i === keys.length - 1 ? [] : {};
            }
            t = t[key] as TObject;
            if (i === keys.length - 1) {
                (t as unknown as TArray).push(row);
            }
        }
    }
    return result;
};

export const decltype = <T>(
    workbook: Workbook,
    path: string,
    sheetName: string,
    typeValue: string,
    typeKey: string = "key1",
    fieldKey: string = "key2"
) => {
    const types: Record<string, T> = {};
    const indexer = new RowIndexer<TRow>(workbook.context, path, sheetName);
    for (const row of indexer.rows) {
        const key1 = row[typeKey];
        const key2 = row[fieldKey];
        const value = row["value"];
        const type = row["value_type"];
        if (key1.v === typeValue) {
            types[String(key2.v)] = convertValue(value, type.v as string).v as T;
        }
    }
    return types;
};

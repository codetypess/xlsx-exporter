import { values } from "./util";
import {
    Sheet,
    TArray,
    TCell,
    TObject,
    TRow,
    TValue,
    Type,
    assert,
    checkType,
    convertValue,
    getRows,
    isNotNull,
    toString,
} from "./xlsx";

export const defineSheet = (sheet: Sheet) => {
    checkType(sheet.data, Type.Sheet);

    const config: TObject = {};
    const enumOptions: TObject[] = [];

    config["!name"] = sheet.name;
    config["!type"] = Type.Define;

    const rows = values<TObject>(sheet.data).map((v) => checkType<TRow>(v, Type.Row));
    for (const row of rows) {
        const value = convertValue(row["value"], row["value_type"].v as string);

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
                if (row["enum_option"]?.v && t["!enum"]) {
                    enumOptions.push(t);
                }
                break;
            }
        }
    }

    for (const entry of enumOptions) {
        const enumName = entry["!enum"];
        const options: { name: string; value: unknown; desc: unknown }[] = [];
        for (const k of Object.keys(entry).filter((k) => !k.startsWith("!"))) {
            const v = entry[k] as TCell;
            const comment = v["!comment"] ?? "";
            let name: string, desc: string | undefined;
            if (comment.includes("-")) {
                [name, desc] = comment.split("-", 2);
            } else {
                name = comment;
            }
            if (!name) {
                name = k;
            }
            options.push({
                name: `${name}(${k})`,
                value: v.v,
                desc: desc,
            });
        }
        options.sort((a, b) => {
            if (typeof a.value === "number" && typeof b.value === "number") {
                return a.value - b.value;
            }
            return String(a.value).localeCompare(String(b.value));
        });
        config[`${enumName}Options`] = options as TArray;
    }

    return config;
};

export const configSheet = (
    sheet: Sheet,
    nameKey = "key",
    valueKey = "value",
    typeKey = "value_type",
    commentKey = "value_comment"
) => {
    checkType(sheet.data, Type.Sheet);

    const result: TObject = {};
    result["!name"] = sheet.name;
    result["!type"] = Type.Config;
    const rows = values<TObject>(sheet.data).map((v) => checkType<TRow>(v, Type.Row));
    for (const row of rows) {
        assert(row[nameKey]?.v !== undefined, `Key '${nameKey}' is not found`);
        assert(row[valueKey]?.v !== undefined, `Value '${valueKey}' is not found`);
        assert(row[typeKey]?.v !== undefined, `Type '${typeKey}' is not found`);
        assert(row[commentKey]?.v !== undefined, `Comment '${commentKey}' is not found`);
        const key = row[nameKey].v as string;
        const value = convertValue(row[valueKey], row[typeKey].v as string);
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
export const mapSheet = (sheet: Sheet, value: string, ...keys: string[]) => {
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
            const keys = value
                .slice(1, -1)
                .split(",")
                .map((k) => k.trim());
            return (row: TRow) => {
                const result: TObject | TArray = isObject ? {} : [];
                for (const k of keys) {
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

export const columnSheet = (sheet: Sheet, idxKey: string, ...foldKeys: string[]) => {
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
    return result;
};

export const collapseSheet = (sheet: Sheet, ...keys: string[]) => {
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
    path: string,
    sheetName: string,
    typeValue: string,
    typeKey: string = "key1",
    fieldKey: string = "key2"
) => {
    const types: Record<string, T> = {};
    for (const row of getRows(path, sheetName)) {
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

import { RowIndexer } from "./indexer.js";
import {
    TypedefField,
    TypedefObject,
    TypedefUnion,
    TypedefWorkbook,
} from "./typedef.js";
import { values } from "./util.js";
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
    convertors,
    convertValue,
    isNotNull,
    toString,
} from "./xlsx.js";

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

type TypedefDraftField = {
    readonly name: string;
    readonly comment: string;
    readonly rawType: string;
};

type TypedefDraftObject = {
    kind: "object";
    name: string;
    comment: string;
    fields: TypedefDraftField[];
};

type TypedefDraftUnion = {
    kind: "union";
    name: string;
    comment: string;
    discriminator: string;
    members: string[];
};

type TypedefDraft = TypedefDraftObject | TypedefDraftUnion;

const splitTypename = (typename: string) => {
    const optional = typename.endsWith("?");
    const clean = optional ? typename.slice(0, -1) : typename;
    const array = clean.match(/(?:\[\d*\])+$/)?.[0].replace(/\d+/g, "") ?? "";
    const base = clean.slice(0, clean.length - array.length);
    return {
        base,
        array,
        optional,
    };
};

const composeTypename = (base: string, array: string, optional: boolean) => {
    return `${base}${array}${optional ? "?" : ""}`;
};

const normalizeSourceTypename = (typename: string) => {
    const meta = splitTypename(typename);
    const base = meta.base === "auto" ? "int" : meta.base;
    return composeTypename(base, meta.array, meta.optional);
};

const tryParseLiteral = (typename: string) => {
    if (!typename.startsWith("#")) {
        return null;
    }
    const raw = typename.slice(1).trim();
    if (raw.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)) {
        return Number(raw);
    }
    return raw;
};

const buildTypedefDatasource = (workbook: Workbook, currentSheet: Sheet) => {
    const sources = new Map<string, Set<string>>();
    const locations = new Map<string, string[]>();

    for (const sourceWorkbook of workbook.context.workbooks) {
        for (const sourceSheet of sourceWorkbook.sheets) {
            if (sourceWorkbook.path === workbook.path && sourceSheet.name === currentSheet.name) {
                continue;
            }
            if (sourceSheet.processors.some((processor) => processor.name === "typedef")) {
                continue;
            }
            for (const field of sourceSheet.fields) {
                if (field.name.startsWith("-")) {
                    continue;
                }
                const typename = normalizeSourceTypename(field.typename);
                sources.set(field.name, (sources.get(field.name) ?? new Set()).add(typename));
                locations.set(field.name, [
                    ...(locations.get(field.name) ?? []),
                    `${sourceWorkbook.path}#${sourceSheet.name}.${field.name}`,
                ]);
            }
        }
    }

    return {
        resolve(name: string) {
            const types = Array.from(sources.get(name) ?? []);
            if (types.length === 0) {
                return null;
            }
            assert(
                types.length === 1,
                `Typedef type source '${name}' is ambiguous: ${(locations.get(name) ?? []).join(
                    ", "
                )}`
            );
            return types[0];
        },
    };
};

const resolveTypedefType = (
    workbook: Workbook,
    sheet: Sheet,
    datasource: ReturnType<typeof buildTypedefDatasource>,
    localTypes: ReadonlySet<string>,
    rawType: string
) => {
    const meta = splitTypename(rawType);
    if (meta.base.startsWith("#")) {
        assert(
            meta.array.length === 0 && !meta.optional,
            `Literal typedef field '${rawType}' is not allowed to use array or optional suffix`
        );
        return rawType;
    }
    if (localTypes.has(meta.base) || convertors[meta.base]) {
        return rawType;
    }
    const sourceType = datasource.resolve(meta.base);
    assert(!!sourceType, `Typedef type '${meta.base}' not found in ${workbook.path}#${sheet.name}`);
    const sourceMeta = splitTypename(sourceType);
    return composeTypename(
        sourceMeta.base,
        meta.array || sourceMeta.array,
        meta.optional || sourceMeta.optional
    );
};

export const typedefSheet = (workbook: Workbook, sheet: Sheet): TypedefWorkbook => {
    checkType(sheet.data, Type.Sheet);

    for (const key of ["comment", "key1", "key2", "value_type", "value_comment"]) {
        assert(
            sheet.fields.some((field) => field.name === key),
            `Typedef field '${key}' is required in ${workbook.path}#${sheet.name}`
        );
    }

    const drafts = new Map<string, TypedefDraft>();
    const order: string[] = [];

    for (const row of values<TRow>(sheet.data)) {
        const key1 = toString(row["key1"]).trim();
        if (!key1) {
            continue;
        }

        const comment = toString(row["comment"]).trim();
        const key2 = toString(row["key2"]).trim();
        const valueType = toString(row["value_type"]).trim();
        const valueComment = toString(row["value_comment"]).trim();

        if (!drafts.has(key1)) {
            order.push(key1);
        }

        if (key2.includes("|")) {
            const members = key2
                .split("|")
                .map((member) => member.trim())
                .filter((member) => member);
            assert(members.length > 0, `Typedef union '${key1}' has no members`);
            assert(valueType, `Typedef union '${key1}' is missing discriminator`);

            const previous = drafts.get(key1);
            assert(
                !previous || previous.kind === "union",
                `Typedef '${key1}' cannot mix object fields and union members`
            );

            if (!previous) {
                drafts.set(key1, {
                    kind: "union",
                    name: key1,
                    comment,
                    discriminator: valueType,
                    members,
                });
            } else {
                const unionDraft = previous as TypedefDraftUnion;
                assert(
                    unionDraft.discriminator === valueType,
                    `Typedef union '${key1}' discriminator mismatch: ` +
                        `'${unionDraft.discriminator}' !== '${valueType}'`
                );
                unionDraft.members = members;
                if (comment && !unionDraft.comment) {
                    unionDraft.comment = comment;
                }
            }
            continue;
        }

        assert(key2, `Typedef '${key1}' field name is required`);
        assert(valueType, `Typedef '${key1}.${key2}' field type is required`);

        const previous = drafts.get(key1);
        assert(
            !previous || previous.kind === "object",
            `Typedef '${key1}' cannot mix union members and object fields`
        );

        const draft =
            previous ??
            ({
                kind: "object",
                name: key1,
                comment,
                fields: [],
            } satisfies TypedefDraftObject);
        const objectDraft = draft as TypedefDraftObject;
        if (!previous) {
            drafts.set(key1, objectDraft);
        } else if (comment && !objectDraft.comment) {
            objectDraft.comment = comment;
        }
        assert(
            !objectDraft.fields.some((field) => field.name === key2),
            `Typedef '${key1}' has duplicate field '${key2}'`
        );
        objectDraft.fields.push({
            name: key2,
            comment: valueComment,
            rawType: valueType,
        });
    }

    const localTypes = new Set(order);
    const datasource = buildTypedefDatasource(workbook, sheet);
    const types = order.map((name) => {
        const draft = drafts.get(name)!;
        if (draft.kind === "union") {
            return {
                kind: "union",
                name: draft.name,
                comment: draft.comment,
                discriminator: draft.discriminator,
                members: draft.members.slice(),
            } satisfies TypedefUnion;
        }
        return {
            kind: "object",
            name: draft.name,
            comment: draft.comment,
            fields: draft.fields.map((field) => {
                const type = resolveTypedefType(workbook, sheet, datasource, localTypes, field.rawType);
                return {
                    name: field.name,
                    comment: field.comment,
                    rawType: field.rawType,
                    type,
                    literal: tryParseLiteral(type) ?? undefined,
                } satisfies TypedefField;
            }),
        } satisfies TypedefObject;
    });

    return {
        path: workbook.path,
        sheet: sheet.name,
        types,
    };
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
                        throw new Error(
                            `${workbook.context.tag} ${workbook.name}.${sheet.name} Key '${k}' is not found`
                        );
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
            throw new Error(
                `${workbook.context.tag} ${workbook.name}.${sheet.name} Invalid value query: ${value}`
            );
        }
    })();

    const result: { [key: string]: TValue } = {};
    const rows = values<TObject>(sheet.data).map((v) => checkType<TRow>(v, Type.Row));
    for (const row of rows) {
        let t = result;
        for (let i = 0; i < keys.length; i++) {
            const key = (row[keys[i]]?.v ?? "") as string;
            if (key === "") {
                throw new Error(
                    `${workbook.context.tag} ${workbook.name}.${sheet.name} Key '${keys[i]}' is not found`
                );
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

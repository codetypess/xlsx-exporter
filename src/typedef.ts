import JSON5 from "json5";
import { StringBuffer } from "./stringify.js";
import { toPascalCase } from "./util.js";
import {
    assert,
    Context,
    convertors,
    convertValue,
    error,
    registerType,
    Sheet,
    TObject,
    Workbook,
} from "./xlsx.js";

export type TypedefLiteral = string | number;

export type TypedefField = {
    readonly name: string;
    readonly comment: string;
    readonly rawType: string;
    readonly type: string;
    readonly literal?: TypedefLiteral;
};

export type TypedefObject = {
    readonly kind: "object";
    readonly name: string;
    readonly comment: string;
    readonly fields: readonly TypedefField[];
};

export type TypedefUnion = {
    readonly kind: "union";
    readonly name: string;
    readonly comment: string;
    readonly discriminator: string;
    readonly members: readonly string[];
};

export type TypedefEntry = TypedefObject | TypedefUnion;

export type TypedefWorkbook = {
    readonly path: string;
    readonly sheet: string;
    readonly types: readonly TypedefEntry[];
};

const typedefWorkbooks = new Map<string, TypedefWorkbook>();
const typedefEntries = new Map<string, TypedefEntry>();
const typedefOwners = new Map<string, string>();

const basicTypes = ["string", "number", "boolean", "unknown", "object"];

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

const tryParseLiteral = (typename: string): TypedefLiteral | null => {
    if (!typename.startsWith("#")) {
        return null;
    }
    const raw = typename.slice(1).trim();
    if (raw.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)) {
        return Number(raw);
    }
    return raw;
};

const stringifyLiteral = (value: TypedefLiteral) => {
    return typeof value === "number" ? String(value) : JSON.stringify(value);
};

export const registerTypedefWorkbook = (typedefWorkbook: TypedefWorkbook) => {
    const previous = typedefWorkbooks.get(typedefWorkbook.path);
    if (previous) {
        for (const type of previous.types) {
            if (typedefOwners.get(type.name) === typedefWorkbook.path) {
                typedefEntries.delete(type.name);
                typedefOwners.delete(type.name);
            }
        }
    }

    typedefWorkbooks.set(typedefWorkbook.path, typedefWorkbook);
    for (const type of typedefWorkbook.types) {
        typedefEntries.set(type.name, type);
        typedefOwners.set(type.name, typedefWorkbook.path);
    }
};

const parseTypedefJson = (str: string) => {
    try {
        return JSON5.parse(str);
    } catch {
        return JSON.parse(str);
    }
};

const stringifyNestedValue = (value: unknown) => {
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return JSON.stringify(value);
};

export const registerTypedefConvertors = (typedefWorkbook: TypedefWorkbook) => {
    const objectTypes = new Map<string, TypedefObject>();
    const unionTypes = new Map<string, TypedefUnion>();

    for (const type of typedefWorkbook.types) {
        if (type.kind === "object") {
            objectTypes.set(type.name, type);
        } else {
            unionTypes.set(type.name, type);
        }
    }

    const convertObject = (type: TypedefObject, raw: unknown) => {
        assert(
            !!raw && typeof raw === "object" && !Array.isArray(raw),
            `Typedef '${type.name}' expects an object`
        );
        const source = raw as Record<string, unknown>;
        const result: TObject = {};
        const rest = new Set(Object.keys(source));

        for (const field of type.fields) {
            rest.delete(field.name);
            const meta = splitTypename(field.type);
            const value = source[field.name];
            if (value === undefined || value === null) {
                if (meta.optional) {
                    continue;
                }
                error(`Typedef '${type.name}.${field.name}' is required`);
            }
            if (field.literal !== undefined) {
                assert(
                    value === field.literal,
                    `Typedef '${type.name}.${field.name}' expects literal ${stringifyLiteral(
                        field.literal
                    )}`
                );
                result[field.name] = field.literal;
                continue;
            }
            result[field.name] = convertValue(stringifyNestedValue(value), field.type);
        }

        assert(
            rest.size === 0,
            `Typedef '${type.name}' has unexpected fields: ${Array.from(rest).sort().join(", ")}`
        );

        return result;
    };

    const makeLiteralKey = (value: TypedefLiteral) => {
        return `${typeof value}:${String(value)}`;
    };

    const resolveUnionObject = (union: TypedefUnion) => {
        const members = new Map<string, TypedefObject>();
        for (const member of union.members) {
            const objectType = objectTypes.get(member);
            assert(
                !!objectType,
                `Typedef union '${union.name}' member '${member}' must be an object type`
            );
            const discriminatorField = objectType.fields.find(
                (field) => field.name === union.discriminator
            );
            assert(
                !!discriminatorField?.literal,
                `Typedef union '${union.name}' member '${member}' must define ` +
                    `literal field '${union.discriminator}'`
            );
            members.set(makeLiteralKey(discriminatorField.literal), objectType);
        }
        return members;
    };

    for (const type of typedefWorkbook.types) {
        registerType(type.name, (value) => {
            const raw = parseTypedefJson(value);
            if (type.kind === "object") {
                return convertObject(type, raw);
            }
            assert(
                !!raw && typeof raw === "object" && !Array.isArray(raw),
                `Typedef '${type.name}' expects an object`
            );
            const source = raw as Record<string, unknown>;
            const member = resolveUnionObject(type).get(
                makeLiteralKey(source[type.discriminator] as TypedefLiteral)
            );
            assert(
                !!member,
                `Typedef union '${type.name}' cannot resolve discriminator '${type.discriminator}'`
            );
            return convertObject(member, source);
        });
    }
};

export const getTypedefWorkbook = (pathOrWorkbook: string | Workbook) => {
    const path = typeof pathOrWorkbook === "string" ? pathOrWorkbook : pathOrWorkbook.path;
    return typedefWorkbooks.get(path) ?? null;
};

export const getTypedef = (typename: string) => {
    return typedefEntries.get(typename) ?? null;
};

export const hasTypedefWorkbook = (pathOrWorkbook: string | Workbook) => {
    return getTypedefWorkbook(pathOrWorkbook) !== null;
};

export type TypeResolver = (typename: string) => { type: string; path?: string };

export class TypeImporter {
    private readonly _namedTypes: Record<string, Set<string>> = {};

    constructor(readonly resolver: TypeResolver) {}

    resolve(typename: string) {
        const ret = this.resolver(typename);
        const basic = ret.type.match(/^[a-zA-Z_][a-zA-Z0-9_]+/)?.[0] ?? "";
        if (ret.path && !basicTypes.includes(basic)) {
            this._namedTypes[ret.path] ||= new Set();
            this._namedTypes[ret.path].add(ret.type.replaceAll("[]", ""));
        }
        return ret;
    }

    toString() {
        const arr = Object.entries(this._namedTypes)
            .filter(([_, types]) => types.size > 0)
            .map(([path, types]) => ({ path, items: Array.from(types).sort() }));
        const buffer: string[] = [];
        for (const entry of arr) {
            buffer.push(`import {`);
            for (const typename of entry.items) {
                buffer.push(`    ${typename},`);
            }
            buffer.push(`} from "${entry.path}";`);
        }
        return buffer.join("\n");
    }
}

export const getTsRowTypeName = (workbookName: string, sheetName: string) => {
    return toPascalCase(`Generated_${workbookName}_${sheetName}_Row`);
};

const writeTsRowType = (
    typeBuffer: StringBuffer,
    workbook: Workbook,
    sheet: Sheet,
    typeImporter: TypeImporter
) => {
    const className = getTsRowTypeName(workbook.name, sheet.name);
    typeBuffer.writeLine(`export interface ${className} {`);
    typeBuffer.indent();
    for (const field of sheet.fields.filter((f) => !f.ignore)) {
        const checker = field.checkers.map((v) => v.source).join(";");
        const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
        typeBuffer.writeLine(`/**`);
        typeBuffer.writeLine(
            ` * ${comment} (location: ${field.location}) (checker: ${checker || "x"})`
        );
        typeBuffer.writeLine(` */`);
        let typename = field.realtype ?? field.typename;
        const optional = typename.endsWith("?") ? "?" : "";
        const array = typename.match(/\[.*\]/)?.[0].replace(/\d+/g, "") ?? "";
        typename = typename.match(/^[\w@]+/)?.[0] ?? "";
        let tsType: string;
        if (typename === "int" || typename === "float" || typename === "auto") {
            tsType = `number`;
        } else if (typename === "string") {
            tsType = `string`;
        } else if (typename === "bool") {
            tsType = `boolean`;
        } else if (
            typename.startsWith("json") ||
            typename.startsWith("table") ||
            typename.startsWith("unknown") ||
            typename.startsWith("@")
        ) {
            tsType = `unknown`;
        } else {
            tsType = typeImporter.resolve(typename).type;
        }
        typeBuffer.padding();
        typeBuffer.writeString(`readonly ${field.name}${optional}: `);
        if (array) {
            const deepCount = array.length / 2;
            tsType = `readonly ${tsType}[]`;
            for (let i = 1; i < deepCount; i++) {
                tsType = `readonly (${tsType})[]`;
            }
        }
        typeBuffer.writeString(`${tsType};`);
        typeBuffer.linefeed();
    }
    typeBuffer.unindent();
    typeBuffer.writeLine(`}`);
    typeBuffer.writeLine("");
};

export const genTsSheetType = (workbook: Workbook, sheet: Sheet, resolver: TypeResolver) => {
    const buffer = new StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!`);
    buffer.writeLine(`// file: ${workbook.path}#${sheet.name}`);
    buffer.writeLine("");

    const typeImporter = new TypeImporter(resolver);
    const typeBuffer = new StringBuffer(4);
    writeTsRowType(typeBuffer, workbook, sheet, typeImporter);

    const imports = typeImporter.toString();
    if (imports.length > 0) {
        buffer.writeLine(imports);
        buffer.writeLine("");
    }

    buffer.writeString(typeBuffer.toString());
    return buffer.toString();
};

export const genTsType = (workbook: Workbook, resolver: TypeResolver) => {
    const buffer = new StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!`);
    buffer.writeLine(`// file: ${workbook.path}`);
    buffer.writeLine("");

    const typeImporter = new TypeImporter(resolver);
    const sheets = workbook.sheets.filter((s) => !s.ignore);
    const typeBuffer = new StringBuffer(4);
    for (const sheet of sheets) {
        writeTsRowType(typeBuffer, workbook, sheet, typeImporter);
    }

    const imports = typeImporter.toString();
    if (imports.length > 0) {
        buffer.writeLine(imports);
        buffer.writeLine("");
    }

    buffer.writeString(typeBuffer.toString());

    return buffer.toString();
};

export const genLuaType = (workbook: Workbook, resolver: TypeResolver) => {
    const sheets = workbook.sheets.filter((s) => !s.ignore);
    const buffer = new StringBuffer(4);
    for (const sheet of sheets) {
        const className =
            `xlsx.${workbook.context.writer}.` + toPascalCase(`${workbook.name}_${sheet.name}`);
        buffer.writeLine(`---file: ${workbook.path}`);
        buffer.writeLine(`---@class ${className}`);
        for (const field of sheet.fields.filter((f) => !f.ignore)) {
            const optional = field.typename.endsWith("?") ? "?" : "";
            const array = field.typename.match(/\[.*\]/g)?.[0].replace(/\d+/g, "") ?? "";
            let typename = field.typename.match(/^[\w@]+/)?.[0] ?? "";
            typename = typename.startsWith("@") ? "table" : typename;
            const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
            if (typename === "int" || typename === "auto") {
                buffer.writeLine(`---@field ${field.name}${optional} integer${array} ${comment}`);
            } else if (typename === "float") {
                buffer.writeLine(`---@field ${field.name}${optional} number${array} ${comment}`);
            } else if (typename === "string" || typename.startsWith("@")) {
                buffer.writeLine(`---@field ${field.name}${optional} string${array} ${comment}`);
            } else if (typename === "bool") {
                buffer.writeLine(`---@field ${field.name}${optional} boolean${array} ${comment}`);
            } else {
                const ret = resolver(typename);
                buffer.writeLine(
                    `---@field ${field.name}${optional} ${ret.type}${array} ${comment}`
                );
            }
        }
        buffer.writeLine("");
    }
    return buffer.toString();
};

const defaultTypeResolver: TypeResolver = (typename) => ({ type: typename });

const resolveTsTypedefType = (
    typename: string,
    localTypes: ReadonlySet<string>,
    importer: TypeImporter
) => {
    const meta = splitTypename(typename);
    let result: string;
    if (meta.base.startsWith("#")) {
        result = stringifyLiteral(tryParseLiteral(meta.base) ?? meta.base.slice(1));
    } else if (meta.base === "int" || meta.base === "float" || meta.base === "auto") {
        result = "number";
    } else if (meta.base === "string") {
        result = "string";
    } else if (meta.base === "bool") {
        result = "boolean";
    } else if (
        meta.base.startsWith("json") ||
        meta.base.startsWith("table") ||
        meta.base.startsWith("unknown") ||
        meta.base.startsWith("@")
    ) {
        result = "unknown";
    } else if (localTypes.has(meta.base)) {
        result = meta.base;
    } else {
        result = importer.resolve(meta.base).type;
    }

    if (meta.array) {
        const depth = meta.array.length / 2;
        result = `${result}[]`;
        for (let i = 1; i < depth; i++) {
            result = `(${result})[]`;
        }
    }

    return {
        type: result,
        optional: meta.optional,
    };
};

const resolveLuaTypedefType = (
    typename: string,
    localTypes: ReadonlySet<string>,
    resolver: TypeResolver
) => {
    const meta = splitTypename(typename);
    let result: string;
    if (meta.base.startsWith("#")) {
        result = stringifyLiteral(tryParseLiteral(meta.base) ?? meta.base.slice(1));
    } else if (meta.base === "int" || meta.base === "auto") {
        result = "integer";
    } else if (meta.base === "float") {
        result = "number";
    } else if (meta.base === "string" || meta.base.startsWith("@")) {
        result = "string";
    } else if (meta.base === "bool") {
        result = "boolean";
    } else if (
        meta.base.startsWith("json") ||
        meta.base.startsWith("table") ||
        meta.base.startsWith("unknown")
    ) {
        result = "table";
    } else if (localTypes.has(meta.base)) {
        result = meta.base;
    } else {
        result = resolver(meta.base).type;
    }

    return {
        type: `${result}${meta.array}`,
        optional: meta.optional,
    };
};

export const genTsTypedef = (
    workbook: Workbook,
    resolver: TypeResolver = defaultTypeResolver
) => {
    const typedefWorkbook = getTypedefWorkbook(workbook);
    if (!typedefWorkbook) {
        return "";
    }

    const importer = new TypeImporter(resolver);
    const localTypes = new Set(typedefWorkbook.types.map((type) => type.name));
    const buffer = new StringBuffer(4);
    const typeBuffer = new StringBuffer(4);

    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!`);
    buffer.writeLine(`// file: ${typedefWorkbook.path}`);
    buffer.writeLine("");

    for (const type of typedefWorkbook.types) {
        if (type.comment) {
            typeBuffer.writeLine(`/** ${type.comment} */`);
        }
        if (type.kind === "union") {
            const members = type.members.map((member) => {
                if (localTypes.has(member)) {
                    return member;
                }
                return importer.resolve(member).type;
            });
            typeBuffer.writeLine(`export type ${type.name} = ${members.join(" | ")};`);
            typeBuffer.writeLine("");
            continue;
        }

        typeBuffer.writeLine(`export interface ${type.name} {`);
        typeBuffer.indent();
        for (const field of type.fields) {
            if (field.comment) {
                typeBuffer.writeLine(`/** ${field.comment} */`);
            }
            const resolved = resolveTsTypedefType(field.type, localTypes, importer);
            typeBuffer.writeLine(
                `${field.name}${resolved.optional ? "?" : ""}: ${resolved.type};`
            );
        }
        typeBuffer.unindent();
        typeBuffer.writeLine(`}`);
        typeBuffer.writeLine("");
    }

    const imports = importer.toString();
    if (imports) {
        buffer.writeLine(imports);
        buffer.writeLine("");
    }
    buffer.writeString(typeBuffer.toString());
    return buffer.toString();
};

export const genLuaTypedef = (
    workbook: Workbook,
    resolver: TypeResolver = defaultTypeResolver
) => {
    const typedefWorkbook = getTypedefWorkbook(workbook);
    if (!typedefWorkbook) {
        return "";
    }

    const localTypes = new Set(typedefWorkbook.types.map((type) => type.name));
    const buffer = new StringBuffer(4);
    for (const type of typedefWorkbook.types) {
        buffer.writeLine(`---file: ${typedefWorkbook.path}`);
        if (type.comment) {
            buffer.writeLine(`---${type.comment}`);
        }
        if (type.kind === "union") {
            const members = type.members.map((member) => {
                if (localTypes.has(member)) {
                    return member;
                }
                return resolver(member).type;
            });
            buffer.writeLine(`---@alias ${type.name} ${members.join("|")}`);
            buffer.writeLine("");
            continue;
        }

        buffer.writeLine(`---@class ${type.name}`);
        for (const field of type.fields) {
            const resolved = resolveLuaTypedefType(field.type, localTypes, resolver);
            buffer.writeLine(
                `---@field ${field.name}${resolved.optional ? "?" : ""} ${resolved.type}` +
                    (field.comment ? ` ${field.comment}` : "")
            );
        }
        buffer.writeLine("");
    }
    return buffer.toString();
};

export const genXlsxType = (ctx: Context, resolver: TypeResolver) => {
    const buffer = new StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!\n`);

    const typeBuffer = new StringBuffer(4);
    const typeImporter = new TypeImporter(resolver);
    typeImporter.resolve("TCell");

    for (const workbook of ctx.workbooks) {
        for (const sheet of workbook.sheets) {
            const className = toPascalCase(`${workbook.name}_${sheet.name}_Row`);

            // row
            typeBuffer.writeLine(`// file: ${workbook.path}`);
            if (sheet.processors.length > 0) {
                typeBuffer.writeLine(`// processors:`);
                const processors = sheet.processors
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name));
                for (const p of processors) {
                    typeBuffer.writeString(`//  - @${p.name}`);
                    if (p.args.length > 0) {
                        typeBuffer.writeString(`(${p.args.join(", ")})`);
                    }
                    typeBuffer.writeLine("");
                }
            }
            typeBuffer.writeLine(`export interface ${className} {`);
            typeBuffer.indent();
            for (const field of sheet.fields) {
                if (field.name.startsWith("-")) {
                    continue;
                }
                const checker = field.checkers.map((v) => v.source).join(";");
                const optional = field.typename.endsWith("?") ? "?" : "";
                const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
                const array = field.typename.match(/\[.*\]/g)?.[0].replace(/\d+/g, "") ?? "";
                let typename = field.typename.match(/^[\w@]+/)?.[0] ?? "";
                if (typename.startsWith("@")) {
                    typename = "unknown";
                } else if (!convertors[typename]) {
                    const where = `file: ${workbook.path}#${sheet.name}#${field.location}:${field.name}`;
                    throw new Error(`convertor not found: ${typename} (${where})`);
                }
                typeBuffer.writeLine(`/**`);
                typeBuffer.writeLine(
                    ` * ${comment} (location: ${field.location}) (type: ${field.typename}) ` +
                        `(checker: ${checker.replaceAll("@", "\\@") || "x"}) ` +
                        `(writer: ${field.writers.join("|")})`
                );
                typeBuffer.writeLine(` */`);
                typeBuffer.padding();
                typeBuffer.writeString(`${field.name}: { v${optional}: `);
                if (typename === "int" || typename === "float" || typename === "auto") {
                    typeBuffer.writeString(`number`);
                } else if (typename === "string") {
                    typeBuffer.writeString(`string`);
                } else if (typename === "bool") {
                    typeBuffer.writeString(`boolean`);
                } else if (
                    typename.startsWith("json") ||
                    typename.startsWith("table") ||
                    typename.startsWith("unknown") ||
                    typename.startsWith("@")
                ) {
                    typeBuffer.writeString(`unknown`);
                } else {
                    const ret = typeImporter.resolve(typename);
                    typeBuffer.writeString(`${ret.type}`);
                }
                typeBuffer.writeString(`${array} } & TCell;`);
                typeBuffer.linefeed();
            }
            typeBuffer.unindent();
            typeBuffer.writeLine(`}`);
            typeBuffer.writeLine("");
        }
    }

    const imports = typeImporter.toString();
    if (imports.length > 0) {
        buffer.writeLine(imports);
        buffer.writeLine("");
    }

    buffer.writeLine(`type TCell = Omit<_TCell, "v">;`);
    buffer.writeLine("");
    buffer.writeLine(typeBuffer.toString());

    return buffer.toString();
};

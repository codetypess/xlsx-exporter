import { StringBuffer } from "./stringify";
import { toPascalCase } from "./util";
import { Context, convertors, Workbook } from "./xlsx";

const basicTypes = ["string", "number", "boolean", "unknown", "object"];

export type TypeResolver = (typename: string) => { type: string; path?: string };

export class TypeImporter {
    private readonly _namedTypes: Record<string, Set<string>> = {};

    constructor(readonly resolver: TypeResolver) {}

    resolve(typename: string) {
        const ret = this.resolver(typename);
        const basic = ret.type.match(/^[a-zA-Z_][a-zA-Z0-9_]+/)?.[0] ?? "";
        if (ret.path && !basicTypes.includes(basic)) {
            this._namedTypes[ret.path] ||= new Set();
            this._namedTypes[ret.path].add(ret.type);
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

export const genTsTypedef = (workbook: Workbook, resolver: TypeResolver) => {
    const buffer = new StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!`);
    buffer.writeLine(`// file: ${workbook.path}`);
    buffer.writeLine("");

    const typeImporter = new TypeImporter(resolver);
    const sheets = workbook.sheets.filter((s) => !s.ignore);
    const typeBuffer = new StringBuffer(4);
    for (const sheet of sheets) {
        const className = toPascalCase(`Generated_${workbook.name}_${sheet.name}_Row`);
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
            const array = typename.match(/[[\]]+/)?.[0] ?? "";
            typename = typename.replaceAll("?", "").replaceAll("[]", "");
            if (typename === "int" || typename === "float" || typename === "auto") {
                typeBuffer.writeLine(`readonly ${field.name}${optional}: number${array};`);
            } else if (typename === "string") {
                typeBuffer.writeLine(`readonly ${field.name}${optional}: string${array};`);
            } else if (typename === "bool") {
                typeBuffer.writeLine(`readonly ${field.name}${optional}: boolean${array};`);
            } else if (
                typename.startsWith("json") ||
                typename.startsWith("table") ||
                typename.startsWith("unknown") ||
                typename.startsWith("@")
            ) {
                typeBuffer.writeLine(`readonly ${field.name}${optional}: unknown${array};`);
            } else {
                const ret = typeImporter.resolve(typename);
                typeBuffer.writeLine(`readonly ${field.name}${optional}: ${ret.type}${array};`);
            }
        }
        typeBuffer.unindent();
        typeBuffer.writeLine(`}`);
        typeBuffer.writeLine("");
    }

    const imports = typeImporter.toString();
    if (imports.length > 0) {
        buffer.writeLine(imports);
        buffer.writeLine("");
    }

    buffer.writeString(typeBuffer.toString());

    return buffer.toString();
};

export const genLuaTypedef = (workbook: Workbook, resolver: TypeResolver) => {
    const sheets = workbook.sheets.filter((s) => !s.ignore);
    const buffer = new StringBuffer(4);
    for (const sheet of sheets) {
        const className =
            `xlsx.${workbook.context.writer}.` + toPascalCase(`${workbook.name}_${sheet.name}`);
        buffer.writeLine(`---file: ${workbook.path}`);
        buffer.writeLine(`---@class ${className}`);
        for (const field of sheet.fields.filter((f) => !f.ignore)) {
            const optional = field.typename.endsWith("?") ? "?" : "";
            const array = field.typename.match(/[[\]]+/)?.[0] ?? "";
            let typename = field.typename.replaceAll("?", "").replaceAll("[]", "");
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

export const genWorkbookTypedef = (ctx: Context, resolver: TypeResolver) => {
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
                if (field.name.startsWith("--")) {
                    continue;
                }
                const checker = field.checkers.map((v) => v.source).join(";");
                const optional = field.typename.endsWith("?") ? "?" : "";
                const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
                const array = field.typename.match(/[[\]]+/)?.[0] ?? "";
                let typename = field.typename.replaceAll("?", "").replaceAll("[]", "");
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

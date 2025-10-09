import { StringBuffer } from "./stringify";
import { filename, toPascalCase } from "./util";
import { convertors, getWorkbook, getWorkbooks } from "./xlsx";

const basicTypes = ["string", "number", "boolean", "unknown", "object"];

export type TypeResolver = (typename: string) => { type: string; path?: string };

export const genTsTypedef = (path: string, writer: string, resolver: TypeResolver) => {
    const buffer = new StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!`);
    buffer.writeLine(`// file: ${path}`);
    buffer.writeLine("");

    const workbook = getWorkbook(path, writer);
    const sheets = Object.values(workbook.sheets)
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((s) => !s.ignore);
    const typeBuffer = new StringBuffer(4);
    const name = filename(path);
    const namedTypes: Record<string, Set<string>> = {};
    for (const sheet of sheets) {
        const className = toPascalCase(`Generated_${name}_${sheet.name}_Row`);
        typeBuffer.writeLine(`export interface ${className} {`);
        typeBuffer.indent();
        for (const field of sheet.fields.filter((f) => !f.ignore)) {
            const checker = field.checker.map((v) => v.def).join(";");
            const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
            typeBuffer.writeLine(`/**`);
            typeBuffer.writeLine(
                ` * ${comment} (location: ${field.refer}) (checker: ${checker || "x"})`
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
                const ret = resolver(typename);
                if (ret.path) {
                    namedTypes[ret.path] ||= new Set();
                    namedTypes[ret.path].add(ret.type);
                }
                typeBuffer.writeLine(`readonly ${field.name}${optional}: ${ret.type}${array};`);
            }
        }
        typeBuffer.unindent();
        typeBuffer.writeLine(`}`);
        typeBuffer.writeLine("");
    }

    if (Object.keys(namedTypes).length > 0) {
        for (const entry of Object.entries(namedTypes)) {
            const types = Array.from(entry[1])
                .filter((t) => !basicTypes.includes(t))
                .sort();
            if (types.length > 0) {
                buffer.writeLine(`import {`);
                for (const typename of types) {
                    buffer.writeLine(`    ${typename},`);
                }
                buffer.writeLine(`} from "${entry[0]}";`);
            }
        }
        buffer.writeLine("");
    }

    buffer.writeString(typeBuffer.toString());

    return buffer.toString();
};

export const genLuaTypedef = (path: string, writer: string, resolver: TypeResolver) => {
    const workbook = getWorkbook(path, writer);
    const sheets = Object.values(workbook.sheets)
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((s) => !s.ignore);
    const buffer = new StringBuffer(4);
    const name = filename(path);
    for (const sheet of sheets) {
        const className = `xlsx.${writer}.` + toPascalCase(`${name}_${sheet.name}`);
        buffer.writeLine(`---file: ${path}`);
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

export const genWorkbookTypedef = (resolver: TypeResolver) => {
    const buffer = new StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!\n`);

    const typeBuffer = new StringBuffer(4);
    const files = getWorkbooks();
    const namedTypes: Record<string, Set<string>> = {};
    for (const path of Object.keys(files).sort()) {
        const workbook = files[path];
        const name = filename(path);
        for (const k of Object.keys(workbook.sheets).sort()) {
            const sheet = workbook.sheets[k];
            const className = toPascalCase(`${name}_${sheet.name}`);

            // row
            typeBuffer.writeLine(`// file: ${path}`);
            if (sheet.processors.length > 0) {
                typeBuffer.writeLine(`// processors:`);
                for (const p of sheet.processors) {
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
                const checker = field.checker.map((v) => v.def).join(";");
                const optional = field.typename.endsWith("?") ? "?" : "";
                const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
                const array = field.typename.match(/[[\]]+/)?.[0] ?? "";
                let typename = field.typename.replaceAll("?", "").replaceAll("[]", "");
                if (typename.startsWith("@")) {
                    typename = "unknown";
                } else if (!convertors[typename]) {
                    const where = `file: ${path}#${sheet.name}#${field.refer}:${field.name}`;
                    throw new Error(`convertor not found: ${typename} (${where})`);
                }
                typeBuffer.writeLine(`/**`);
                typeBuffer.writeLine(
                    ` * ${comment} (location: ${field.refer}) (checker: ${checker || "x"}) ` +
                        `(writer: ${field.writers.join("|")})`
                );
                typeBuffer.writeLine(` */`);
                if (typename === "int" || typename === "float" || typename === "auto") {
                    typeBuffer.writeLine(`${field.name}: { v${optional}: number${array} };`);
                } else if (typename === "string") {
                    typeBuffer.writeLine(`${field.name}: { v${optional}: string${array} };`);
                } else if (typename === "bool") {
                    typeBuffer.writeLine(`${field.name}: { v${optional}: boolean${array} };`);
                } else if (
                    typename.startsWith("json") ||
                    typename.startsWith("table") ||
                    typename.startsWith("unknown") ||
                    typename.startsWith("@")
                ) {
                    typeBuffer.writeLine(`${field.name}: { v${optional}: unknown${array} };`);
                } else {
                    const ret = resolver(typename);
                    if (ret.path) {
                        namedTypes[ret.path] ||= new Set();
                        namedTypes[ret.path].add(ret.type);
                    }
                    typeBuffer.writeLine(`${field.name}: { v${optional}: ${ret.type}${array} };`);
                }
            }
            typeBuffer.unindent();
            typeBuffer.writeLine(`}`);
            typeBuffer.writeLine("");
        }
    }

    if (Object.keys(namedTypes).length > 0) {
        for (const entry of Object.entries(namedTypes)) {
            const types = Array.from(entry[1])
                .filter((t) => !basicTypes.includes(t))
                .sort();
            if (types.length > 0) {
                buffer.writeLine(`import {`);
                for (const typename of types) {
                    buffer.writeLine(`    ${typename},`);
                }
                buffer.writeLine(`} from "${entry[0]}";`);
            }
        }
        buffer.writeLine("");
    }

    buffer.writeLine(typeBuffer.toString());
    return buffer.toString();
};

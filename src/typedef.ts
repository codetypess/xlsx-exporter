import { StringBuffer } from "./stringify";
import { filename, keys, toPascalCase } from "./util";
import {
    convertors,
    files,
    getWorkbook,
    makeTypeName,
    Type,
    TypeDecl,
    TypeName,
    TypeStruct,
} from "./xlsx";

type ClassNameMaker = (className: string) => string;

const writeTsType = (field: string, typealias: TypeDecl, buffer: StringBuffer) => {
    if (typealias["!type"] === Type.TypeName) {
        const type = typealias as TypeName;
        const optional = type["!optional"] ? "?" : "";
        const array = type["!array"] ?? "";
        let realtype = type.value;
        realtype = convertors[realtype].realtype ?? realtype;
        if (type["!comment"]) {
            buffer.writeLine(`/**`);
            buffer.writeLine(` * ${type["!comment"]}`);
            buffer.writeLine(` */`);
        }
        if (realtype === "int" || realtype === "float") {
            buffer.writeLine(`readonly ${field}${optional}: number${array};`);
        } else if (realtype === "string") {
            buffer.writeLine(`readonly ${field}${optional}: string${array};`);
        } else if (realtype === "bool") {
            buffer.writeLine(`readonly ${field}${optional}: boolean${array};`);
        } else {
            buffer.writeLine(`readonly ${field}${optional}: unknown${array};`);
        }
    } else {
        const optional = field.endsWith("?") ? "?" : "";
        const array = field.endsWith("[]") ? "[]" : "";
        const struct = typealias as TypeStruct;
        buffer.writeLine(`readonly ${field}${optional}: {`);
        buffer.indent();
        for (const k of keys(struct)) {
            writeTsType(k, struct[k], buffer);
        }
        buffer.unindent();
        buffer.writeLine(`}${array};`);
    }
};
export const genTsTypedef = (path: string, writer: string, maker?: ClassNameMaker) => {
    const workbook = getWorkbook(path);
    const buffer = new StringBuffer(4);
    const name = filename(path);
    maker = maker ?? ((className) => className);
    const typedefs = workbook.typedefs[writer];
    for (const sheetName of Object.keys(typedefs).sort()) {
        const className = maker(toPascalCase(`Generated_${name}_${sheetName}_Row`));

        // row
        buffer.writeLine(`// file: ${path}`);
        buffer.writeLine(`export interface ${className} {`);
        buffer.indent();
        for (const field of typedefs[sheetName]) {
            const checker = field.checker.map((v) => v.def).join(";");
            const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
            buffer.writeLine(`/**`);
            buffer.writeLine(
                ` * ${comment} (location: ${field.refer}) (checker: ${checker || "x"})`
            );
            buffer.writeLine(` */`);
            writeTsType(
                field.name,
                field.typedecl ??
                    makeTypeName(field.typename.replaceAll("?", ""), {
                        "!optional": field.typename.includes("?"),
                    }),
                buffer
            );
        }
        buffer.unindent();
        buffer.writeLine(`}`);
        buffer.writeLine("");
    }
    return buffer.toString();
};

export const genLuaTypedef = (path: string, writer: string, maker?: ClassNameMaker) => {
    if (!maker) {
        maker = (className) => `xlsx.${writer}.${className}`;
    }
    const buffer = new StringBuffer(4);
    const workbook = getWorkbook(path);
    const name = filename(path);
    const typedefs = workbook.typedefs[writer];
    for (const sheetName of Object.keys(typedefs).sort()) {
        const className = maker(toPascalCase(`${name}_${sheetName}`));
        buffer.writeLine(`---file: ${path}`);
        buffer.writeLine(`---@class ${className}`);
        for (const field of typedefs[sheetName]) {
            const optional = field.typename.endsWith("?") ? "?" : "";
            let typename = field.typename.replaceAll("?", "").replaceAll("[]", "");
            typename = convertors[typename].realtype ?? typename;
            const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
            if (typename === "int") {
                buffer.writeLine(`---@field ${field.name}${optional} integer ${comment}`);
            } else if (typename === "float") {
                buffer.writeLine(`---@field ${field.name}${optional} number ${comment}`);
            } else if (typename === "string") {
                buffer.writeLine(`---@field ${field.name}${optional} string ${comment}`);
            } else if (typename === "bool") {
                buffer.writeLine(`---@field ${field.name}${optional} boolean ${comment}`);
            } else {
                buffer.writeLine(
                    `---@field ${field.name}${optional} ${maker(typename)} ${comment}`
                );
            }
        }
        buffer.writeLine("");
    }
    return buffer.toString();
};

export const genWorkbookTypedef = () => {
    const buffer = new StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!\n`);
    for (const path of Object.keys(files).sort()) {
        const workbook = getWorkbook(path);
        const name = filename(path);
        for (const k of Object.keys(workbook.sheets).sort()) {
            const sheet = workbook.sheets[k];
            const className = toPascalCase(`${name}_${sheet.name}`);

            // row
            buffer.writeLine(`// file: ${path}`);
            buffer.writeLine(`export interface ${className} {`);
            buffer.indent();
            for (const field of sheet.fields) {
                const checker = field.checker.map((v) => v.def).join(";");
                const optional = field.typename.endsWith("?") ? "?" : "";
                const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
                let typename = field.typename.replaceAll("?", "");
                if (!convertors[typename]) {
                    const where = `file: ${path}#${sheet.name}#${field.refer}:${field.name}`;
                    throw new Error(`convertor not found: ${typename} (${where})`);
                }
                typename = convertors[typename].realtype ?? typename;
                buffer.writeLine(`/**`);
                buffer.writeLine(
                    ` * ${comment} (location: ${field.refer}) (checker: ${checker || "x"}) ` +
                        `(writer: ${field.writers.join("|")})`
                );
                buffer.writeLine(` */`);
                if (typename === "int" || typename === "float") {
                    buffer.writeLine(`${field.name}: { v${optional}:number };`);
                } else if (typename === "string") {
                    buffer.writeLine(`${field.name}: { v${optional}:string };`);
                } else if (typename === "bool") {
                    buffer.writeLine(`${field.name}: { v${optional}:boolean };`);
                } else {
                    buffer.writeLine(`${field.name}: { v${optional}:unknown };`);
                }
            }
            buffer.unindent();
            buffer.writeLine(`}`);
            buffer.writeLine("");
        }
    }
    return buffer.toString();
};

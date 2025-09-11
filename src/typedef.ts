import { StringBuffer } from "./stringify";
import { filename, keys, toPascalCase } from "./util";
import {
    convertors,
    getWorkbook,
    getWorkbooks,
    makeTypeName,
    Type,
    TypeDecl,
    TypeName,
    TypeStruct,
    TypeTag,
} from "./xlsx";

type ClassNameMaker = (className: string) => string;

const writeTsType = (field: string, typealias: TypeDecl, buffer: StringBuffer) => {
    if (typealias["!type"] === Type.TypeName) {
        const type = typealias as TypeName;
        const optional = type["!optional"] ? "?" : "";
        const array = type["!array"] ?? "";
        let realtype = type.value;
        realtype = convertors[realtype]?.realtype ?? realtype;
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
    const workbook = getWorkbook(path, writer);
    const sheets = Object.values(workbook.sheets).sort((a, b) => a.name.localeCompare(b.name));
    const buffer = new StringBuffer(4);
    const name = filename(path);
    maker = maker ?? ((className) => className);
    for (const sheet of sheets) {
        const className = maker(toPascalCase(`Generated_${name}_${sheet.name}_Row`));
        buffer.writeLine(`// file: ${path}`);
        buffer.writeLine(`export interface ${className} {`);
        buffer.indent();
        for (const field of sheet.fields) {
            if (field.ignore) {
                continue;
            }
            const checker = field.checker.map((v) => v.def).join(";");
            const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
            buffer.writeLine(`/**`);
            buffer.writeLine(
                ` * ${comment} (location: ${field.refer}) (checker: ${checker || "x"})`
            );
            buffer.writeLine(` */`);
            const typename = field.typename;
            writeTsType(
                field.name,
                field.typedecl ??
                    makeTypeName(typename.replaceAll("?", "").replaceAll("[]", ""), {
                        "!optional": typename.includes("?"),
                        "!array": (typename.match(/[[\]]+/)?.[0] ?? undefined) as TypeTag["!array"],
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
    const workbook = getWorkbook(path, writer);
    const sheets = Object.values(workbook.sheets).sort((a, b) => a.name.localeCompare(b.name));
    const buffer = new StringBuffer(4);
    const name = filename(path);
    for (const sheet of sheets) {
        const className = maker(toPascalCase(`${name}_${sheet.name}`));
        buffer.writeLine(`---file: ${path}`);
        buffer.writeLine(`---@class ${className}`);
        for (const field of sheet.fields) {
            if (field.ignore) {
                continue;
            }
            const optional = field.typename.endsWith("?") ? "?" : "";
            const array = field.typename.match(/[[\]]+/)?.[0] ?? "";
            let typename = field.typename.replaceAll("?", "").replaceAll("[]", "");
            typename = convertors[typename]?.realtype ?? typename;
            typename = typename.startsWith("@") ? "table" : typename;
            const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
            if (typename === "int") {
                buffer.writeLine(`---@field ${field.name}${optional} integer${array} ${comment}`);
            } else if (typename === "float") {
                buffer.writeLine(`---@field ${field.name}${optional} number${array} ${comment}`);
            } else if (typename === "string") {
                buffer.writeLine(`---@field ${field.name}${optional} string${array} ${comment}`);
            } else if (typename === "bool") {
                buffer.writeLine(`---@field ${field.name}${optional} boolean${array} ${comment}`);
            } else {
                buffer.writeLine(
                    `---@field ${field.name}${optional} ${maker(typename)}${array} ${comment}`
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
    const files = getWorkbooks();
    for (const path of Object.keys(files).sort()) {
        const workbook = files[path];
        const name = filename(path);
        for (const k of Object.keys(workbook.sheets).sort()) {
            const sheet = workbook.sheets[k];
            const className = toPascalCase(`${name}_${sheet.name}`);

            // row
            buffer.writeLine(`// file: ${path}`);
            buffer.writeLine(`export interface ${className} {`);
            buffer.indent();
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
                typename = convertors[typename]?.realtype ?? typename;
                buffer.writeLine(`/**`);
                buffer.writeLine(
                    ` * ${comment} (location: ${field.refer}) (checker: ${checker || "x"}) ` +
                        `(writer: ${field.writers.join("|")})`
                );
                buffer.writeLine(` */`);
                if (typename === "int" || typename === "float") {
                    buffer.writeLine(`${field.name}: { v${optional}:number${array} };`);
                } else if (typename === "string") {
                    buffer.writeLine(`${field.name}: { v${optional}:string${array} };`);
                } else if (typename === "bool") {
                    buffer.writeLine(`${field.name}: { v${optional}:boolean${array} };`);
                } else {
                    buffer.writeLine(`${field.name}: { v${optional}:unknown${array} };`);
                }
            }
            buffer.unindent();
            buffer.writeLine(`}`);
            buffer.writeLine("");
        }
    }
    return buffer.toString();
};

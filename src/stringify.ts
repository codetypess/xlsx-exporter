import { escape, isNumericKey, keys } from "./util";
import { TArray, TCell, TObject, TValue, Type, checkType, isNotNull } from "./xlsx";

export class StringBuffer {
    readonly data: string[] = [];

    private _indent: number;
    private _indentCount: number = 0;

    constructor(indent: number) {
        this._indent = indent;
    }

    get indentCount() {
        return this._indentCount;
    }

    indent() {
        this._indentCount += this._indent;
    }

    unindent() {
        this._indentCount -= this._indent;
    }

    padding() {
        if (this._indent > 0) {
            this.data.push(" ".repeat(this._indentCount));
        }
    }

    linefeed() {
        if (this._indent > 0) {
            this.data.push("\n");
        }
    }

    writeLine(value: string) {
        this.padding();
        this.data.push(value);
        this.linefeed();
    }

    writeLines(value: string) {
        for (const line of value.split("\n")) {
            this.writeLine(line);
        }
    }

    writeString(value: string) {
        this.data.push(value);
    }

    toString() {
        return this.data.join("");
    }
}

export type StringifyContext = {
    readonly format: "json" | "lua" | "ts" | string;
    readonly indent: number;
    readonly precision?: number;
    readonly buffer: StringBuffer;
    readonly writeValue: (value: TValue) => void;
    readonly writeArray: (value: TArray) => void;
    readonly writeObject: (value: TObject) => void;
};

const numberToString = (value: number, precision?: number) => {
    if (value === (value | 0)) {
        return value.toFixed(0);
    } else {
        return value.toFixed(precision).replace(/\.?0+$/, "");
    }
};

//-----------------------------------------------------------------------------
// Json
//-----------------------------------------------------------------------------
export type JsonStringifyOption = {
    /** default: 4 */
    indent?: number;
    /** default: 10 */
    precision?: number;
};

export const stringifyJson = (data: TValue, option?: JsonStringifyOption) => {
    const stacks: string[] = [];
    option = option ?? {};
    option.indent = Math.max(option.indent ?? 4, 0);
    option.precision = option.precision ?? 10;
    const buffer = new StringBuffer(option.indent);
    const ctx: StringifyContext = {
        format: "json",
        indent: option.indent,
        precision: option.precision,
        buffer,
        writeValue,
        writeArray,
        writeObject,
    };

    function writeValue(value: TValue) {
        if (typeof value === "number") {
            buffer.writeString(numberToString(value, ctx.precision));
        } else if (typeof value === "boolean") {
            buffer.writeString(value.toString());
        } else if (value === null) {
            buffer.writeString("null");
        } else if (value === undefined) {
            buffer.writeString("undefined");
        } else if (typeof value === "string") {
            buffer.writeString('"');
            buffer.writeString(escape(value));
            buffer.writeString('"');
        } else if (Array.isArray(value)) {
            writeArray(value);
        } else {
            if (value["!type"] === Type.Cell) {
                value = value.v;
            }
            if (typeof value !== "object" || value === null || value === undefined) {
                writeValue(value);
            } else if (Array.isArray(value)) {
                writeArray(value);
            } else {
                writeObject(value as TObject);
            }
        }
    }

    function writeObject(value: TObject) {
        if (stacks.length > 256) {
            throw new Error(`json stringify stack overflow: ${stacks.join("->")}`);
        }

        if (value["!stringify"]) {
            value["!stringify"](value, ctx);
            return;
        }

        const ks = keys(value, isNotNull, value["!ignore"]);
        const space = ctx.indent > 0 ? " " : "";
        buffer.writeString("{");
        buffer.linefeed();
        buffer.indent();
        for (let i = 0; i < ks.length; i++) {
            const k = ks[i];
            const v = value[k];
            stacks.push(k);
            buffer.padding();
            buffer.writeString(`"${k}":${space}`);
            writeValue(v);
            if (i < ks.length - 1) {
                buffer.writeString(",");
            }
            buffer.linefeed();
            stacks.pop();
        }
        buffer.unindent();
        buffer.padding();
        buffer.writeString("}");
    }

    function writeArray(value: TArray) {
        if (value["!stringify"]) {
            value["!stringify"](value, ctx);
            return;
        }

        buffer.writeString("[");
        buffer.linefeed();
        buffer.indent();
        for (let i = 0; i < value.length; i++) {
            const v = value[i];
            buffer.padding();
            writeValue(v);
            if (i < value.length - 1) {
                buffer.writeString(",");
            }
            buffer.linefeed();
        }
        buffer.unindent();
        buffer.padding();
        buffer.writeString("]");
    }

    writeValue(data);

    return buffer.toString();
};

//-----------------------------------------------------------------------------
// Lua
//-----------------------------------------------------------------------------
export type LuaStringifyOption = {
    /** default: 4 */
    indent?: number;
    marshal?: string;
    /** default: 10 */
    precision?: number;
};

export const stringifyLua = (data: TValue, option?: LuaStringifyOption) => {
    const stacks: string[] = [];
    option = option ?? {};
    option.indent = Math.max(option.indent ?? 4, 0);
    option.precision = option.precision ?? 10;
    const buffer = new StringBuffer(option.indent);
    const ctx: StringifyContext = {
        format: "lua",
        indent: option.indent,
        precision: option.precision,
        buffer,
        writeValue,
        writeArray,
        writeObject,
    };
    function writeComment(value?: TValue) {
        if (value && typeof value === "object") {
            if (value["!enum"]) {
                buffer.writeLine(`---@enum ${value["!enum"]}`);
            }
            if (value["!comment"]) {
                const comment = value["!comment"].replaceAll("\n", "\\n");
                buffer.writeLine(`-- ${comment}`);
            }
        }
    }

    function writeValue(value: TValue) {
        if (typeof value === "number") {
            buffer.writeString(numberToString(value, ctx.precision));
        } else if (typeof value === "boolean") {
            buffer.writeString(value.toString());
        } else if (value === null || value === undefined) {
            buffer.writeString("nil");
        } else if (typeof value === "string") {
            buffer.writeString('"');
            buffer.writeString(escape(value));
            buffer.writeString('"');
        } else if (Array.isArray(value)) {
            writeArray(value);
        } else {
            if (value["!type"] === Type.Cell) {
                value = value.v;
            }
            if (typeof value !== "object" || value === null || value === undefined) {
                writeValue(value);
            } else if (Array.isArray(value)) {
                writeArray(value);
            } else {
                writeObject(value as TObject);
            }
        }
    }

    function writeObject(value: TObject) {
        if (stacks.length > 256) {
            throw new Error(`json stringify stack overflow: ${stacks.join("->")}`);
        }

        if (value["!stringify"]) {
            value["!stringify"](value, ctx);
            return;
        }

        const ks = keys(value, isNotNull, value["!ignore"]);
        const space = ctx.indent > 0 ? " " : "";
        buffer.writeString("{");
        buffer.linefeed();
        buffer.indent();
        for (let i = 0; i < ks.length; i++) {
            const k = ks[i];
            const v = value[k];
            stacks.push(k);
            writeComment(v);
            buffer.padding();
            if (isNumericKey(k)) {
                buffer.writeString(`[${k}]${space}=${space}`);
            } else if (k.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                buffer.writeString(`${k}${space}=${space}`);
            } else {
                buffer.writeString(`["${k}"]${space}=${space}`);
            }
            writeValue(v);
            buffer.writeString(",");
            buffer.linefeed();
            stacks.pop();
        }
        buffer.unindent();
        buffer.padding();
        buffer.writeString("}");
    }

    function writeArray(value: TArray) {
        if (stacks.length > 256) {
            throw new Error(`json stringify stack overflow: ${stacks.join("->")}`);
        }

        if (value["!stringify"]) {
            value["!stringify"](value, ctx);
            return;
        }

        buffer.writeString("{");
        buffer.linefeed();
        buffer.indent();
        for (let i = 0; i < value.length; i++) {
            const v = value[i];
            buffer.padding();
            writeValue(v);
            buffer.writeString(",");
            buffer.linefeed();
        }
        buffer.unindent();
        buffer.padding();
        buffer.writeString("}");
    }

    if (option.marshal) {
        buffer.writeString(option.marshal);
    }

    writeValue(data);

    return buffer.toString();
};

//-----------------------------------------------------------------------------
// TypeScript
//-----------------------------------------------------------------------------
export type TsStringifyOption = {
    /** default: 4 */
    indent?: number;
    marshal?: string;
    /** default: 10 */
    precision?: number;
    /** default: true */
    asconst?: boolean;
};

export const stringifyTs = (data: TValue, option?: TsStringifyOption) => {
    const stacks: string[] = [];
    option = option ?? {};
    option.indent = Math.max(option.indent ?? 4, 0);
    option.precision = option.precision ?? 10;
    option.asconst = option.asconst ?? true;
    const buffer = new StringBuffer(option.indent);
    const enumBuffer = new StringBuffer(option.indent);
    const ctx: StringifyContext = {
        format: "ts",
        indent: option.indent,
        precision: option.precision,
        buffer,
        writeValue,
        writeArray,
        writeObject,
    };

    function writeComment(comment: string | undefined, out: StringBuffer) {
        if (comment) {
            out.writeLine(`/**`);
            comment.split("\n").forEach((line) => {
                out.writeLine(` * ${line}`);
            });
            out.writeLine(` */`);
        }
    }

    function writeEnum(value: TObject) {
        const enumName = value["!enum"];
        const enumComment = value["!comment"];
        const ks = keys(value as TObject, isNotNull);
        enumBuffer.writeString(`export type ${enumName}Key =\n`);
        enumBuffer.indent();
        for (let i = 0; i < ks.length; i++) {
            const k = ks[i];
            const comma = i === ks.length - 1 ? ";" : "";
            enumBuffer.writeLine(`| "${k}"${comma}`);
        }
        enumBuffer.unindent();
        enumBuffer.writeLine("");

        writeComment(enumComment, enumBuffer);
        enumBuffer.writeLine(`export enum ${enumName} {`);
        enumBuffer.indent();
        for (const k of ks) {
            const v = checkType<TCell>((value as TObject)[k], Type.Cell);
            const valueComment = v["!comment"];
            writeComment(valueComment, enumBuffer);
            if (!k.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
                throw new Error(`Invalid enum key: ${k}`);
            }
            if (typeof v.v === "number") {
                enumBuffer.writeLine(`${k} = ${v.v},`);
            } else {
                enumBuffer.writeLine(`${k} = "${v.v}",`);
            }
        }
        enumBuffer.unindent();
        enumBuffer.writeLine(`}`);
        enumBuffer.writeLine("");
    }

    function writeValue(value: TValue) {
        if (typeof value === "number") {
            buffer.writeString(numberToString(value, ctx.precision));
        } else if (typeof value === "boolean") {
            buffer.writeString(value.toString());
        } else if (value === null || value === undefined) {
            buffer.writeString("null");
        } else if (typeof value === "string") {
            buffer.writeString('"');
            buffer.writeString(escape(value));
            buffer.writeString('"');
        } else if (Array.isArray(value)) {
            writeArray(value);
        } else {
            if (value["!type"] === Type.Cell) {
                value = value.v;
            }
            if (typeof value !== "object" || value === null || value === undefined) {
                writeValue(value);
            } else if (Array.isArray(value)) {
                writeArray(value);
            } else {
                writeObject(value as TObject);
            }
        }
    }

    function writeObject(value: TObject) {
        if (stacks.length > 256) {
            throw new Error(`json stringify stack overflow: ${stacks.join("->")}`);
        }

        if (value["!stringify"]) {
            value["!stringify"](value, ctx);
            return;
        }

        const ks = keys(value, isNotNull, value["!ignore"]);
        const space = ctx.indent > 0 ? " " : "";
        buffer.writeString("{");
        buffer.linefeed();
        buffer.indent();
        for (let i = 0; i < ks.length; i++) {
            const k = ks[i];
            const v = value[k];
            if (v && typeof v === "object") {
                if (v["!enum"]) {
                    writeEnum(v as TObject);
                    continue;
                } else if (v["!comment"]) {
                    writeComment(v["!comment"], buffer);
                }
            }
            stacks.push(k);
            buffer.padding();
            if (k.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/) || isNumericKey(k)) {
                buffer.writeString(`${k}:${space}`);
            } else {
                buffer.writeString(`"${k}":${space}`);
            }
            writeValue(v);
            buffer.writeString(",");
            buffer.linefeed();
            stacks.pop();
        }
        buffer.unindent();
        buffer.padding();
        buffer.writeString("}");
    }

    function writeArray(value: TArray) {
        if (stacks.length > 256) {
            throw new Error(`json stringify stack overflow: ${stacks.join("->")}`);
        }

        if (value["!stringify"]) {
            value["!stringify"](value, ctx);
            return;
        }

        buffer.writeString("[");
        buffer.linefeed();
        buffer.indent();
        for (let i = 0; i < value.length; i++) {
            const v = value[i];
            buffer.padding();
            writeValue(v);
            buffer.writeString(",");
            buffer.linefeed();
        }
        buffer.unindent();
        buffer.padding();
        buffer.writeString("]");
    }

    if (option.marshal) {
        buffer.writeString(option.marshal);
    }

    writeValue(data);
    if (option.asconst) {
        buffer.writeString(" as const;");
    } else {
        buffer.writeString(";");
    }

    const enumString = enumBuffer.toString();
    if (enumString) {
        buffer.data.unshift("\n");
        buffer.data.unshift(enumString);
    }

    return buffer.toString();
};

export const stringifyTsType = (data: TValue, option?: TsStringifyOption) => {
    const stacks: string[] = [];
    option = option ?? {};
    option.indent = Math.max(option.indent ?? 4, 0);

    const buffer = new StringBuffer(option.indent);
    const ctx: StringifyContext = {
        format: "typedef",
        indent: option.indent,
        precision: option.precision,
        buffer,
        writeValue,
        writeArray,
        writeObject,
    };

    function writeComment(comment: string | undefined, out: StringBuffer) {
        if (comment) {
            out.writeLine(`/**`);
            comment.split("\n").forEach((line) => {
                out.writeLine(` * ${line}`);
            });
            out.writeLine(` */`);
        }
    }

    function writeValue(value: TValue) {
        if (typeof value === "number") {
            buffer.writeString("number");
        } else if (typeof value === "boolean") {
            buffer.writeString("boolean");
        } else if (value === null) {
            buffer.writeString("null");
        } else if (value === undefined) {
            buffer.writeString("undefined");
        } else if (typeof value === "string") {
            buffer.writeString("string");
        } else if (Array.isArray(value)) {
            writeArray(value);
        } else if (typeof value === "object") {
            if (value["!type"] === Type.Cell) {
                value = value.v;
            }
            if (typeof value !== "object" || value === null || value === undefined) {
                writeValue(value);
            } else if (Array.isArray(value)) {
                writeArray(value);
            } else {
                writeObject(value as TObject);
            }
        }
    }

    function writeObject(value: TObject) {
        if (stacks.length > 256) {
            throw new Error(`json stringify stack overflow: ${stacks.join("->")}`);
        }

        if (value["!stringify"]) {
            value["!stringify"](value, ctx);
            return;
        }

        const ks = keys(value, isNotNull, value["!ignore"]);
        const space = ctx.indent > 0 ? " " : "";
        buffer.writeString("{");
        buffer.linefeed();
        buffer.indent();
        for (let i = 0; i < ks.length; i++) {
            const k = ks[i];
            const v = value[k];
            if (v && typeof v === "object") {
                if (v["!enum"]) {
                    writeValue(v["!enum"]);
                    continue;
                } else if (v["!comment"]) {
                    writeComment(v["!comment"], buffer);
                }
            }
            stacks.push(k);
            buffer.padding();
            if (k.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/) || isNumericKey(k)) {
                buffer.writeString(`${k}:${space}`);
            } else {
                buffer.writeString(`"${k}":${space}`);
            }
            writeValue(v);
            buffer.writeString(";");
            buffer.linefeed();
            stacks.pop();
        }
        buffer.unindent();
        buffer.padding();
        buffer.writeString("}");
    }

    function writeArray(value: TArray) {
        if (value["!stringify"]) {
            value["!stringify"](value, ctx);
            return;
        }

        buffer.writeString("[");
        buffer.linefeed();
        buffer.indent();
        for (let i = 0; i < value.length; i++) {
            const v = value[i];
            buffer.padding();
            writeValue(v);
            buffer.writeString(",");
            buffer.linefeed();
        }
        buffer.unindent();
        buffer.padding();
        buffer.writeString("]");
    }

    if (option.marshal) {
        buffer.writeString(option.marshal);
    }

    writeValue(data);

    return buffer.toString();
};

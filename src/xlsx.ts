import { basename, extname } from "path";
import xlsx from "xlsx";
import { type StringifyContext } from "./stringify";
import { keys, values } from "./util";

export const RANGE_CHECKER = "xlsx.checker.range";
export const INDEX_CHECKER = "xlsx.checker.index";
export const EXPR_CHECKER = "xlsx.checker.expr";
export const SHEET_CHECKER = "xlsx.checker.sheet";

export const enum Type {
    Row = "xlsx.type.row",
    Cell = "xlsx.type.cell",
    Object = "xlsx.type.object",
    Define = "xlsx.type.define",
    Config = "xlsx.type.config",
    Map = "xlsx.type.map",
    Fold = "xlsx.type.fold",
    Sheet = "xlsx.type.sheet",
}

export type Tag = {
    /** data name */
    ["!name"]?: string;
    /** type tag */
    ["!type"]?: string | Type;
    /** special stringify function */
    ["!stringify"]?: (self: TValue, ctx: StringifyContext) => void;
    /** enum name */
    ["!enum"]?: string;
    /** comment */
    ["!comment"]?: string;
    /** ignore fields when stringify */
    ["!ignore"]?: { [k: string]: boolean };
};

export type TCell = {
    /** converted value */
    v: TValue;
    /** location: A1 */
    r: string;
    /** original string value */
    s: string;
    /** already converted type */
    t?: string;
} & Tag;

export type TValue = boolean | number | string | null | undefined | TObject | TArray | TCell;
export type TObject = { [k: string | number]: TValue } & Tag;
export type TArray = TValue[] & Tag;
export type TRow = { [k: string]: TCell } & Tag;

export type Field = {
    readonly index: number;
    readonly name: string;
    readonly sheet: string;
    readonly path: string;
    readonly typename: string;
    readonly writers: string[];
    readonly checker: CheckerType[];
    readonly comment: string;
    readonly refer: string;
    realtype?: string;
    ignore: boolean;
};

export type Sheet = {
    readonly name: string;
    readonly path: string;
    readonly processors: { name: string; args: string[] }[];
    readonly fields: Field[];
    ignore: boolean;
    data: TObject;
};

export class Workbook {
    readonly path: string;
    readonly name: string;
    readonly context: Context;

    private readonly _sheets: Record<string, Sheet>;

    constructor(context: Context, path: string) {
        this.path = path;
        this.name = basename(path, extname(path));
        this._sheets = {};
        this.context = context;
    }

    get sheets(): readonly Sheet[] {
        return Object.values(this._sheets).sort((a, b) => a.name.localeCompare(b.name));
    }

    add(sheet: Sheet) {
        this._sheets[sheet.name] = sheet;
    }

    remove(name: string) {
        delete this._sheets[name];
    }

    has(name: string) {
        return !!this._sheets[name];
    }

    get(name: string) {
        if (!this._sheets[name]) {
            throw new Error(`Sheet not found: ${name}`);
        }
        return this._sheets[name];
    }

    clone(ctx: Context) {
        const newWorkbook = new Workbook(ctx, this.path);

        const includeWriters = (writers: string[]) => {
            if (ctx.writer === DEFAULT_WRITER || writers.length === 0) {
                return true;
            } else {
                return writers.includes(ctx.writer);
            }
        };

        const deepCopy = <T extends TValue>(value: T): T => {
            if (value && typeof value === "object") {
                const obj: TObject = (Array.isArray(value) ? [] : {}) as TObject;
                for (const k in value) {
                    let v = (value as TObject)[k];
                    if (!k.startsWith("!")) {
                        v = deepCopy(v);
                    }
                    obj[k] = v;
                }
                return obj as T;
            } else {
                return value;
            }
        };

        for (const sheet of this.sheets) {
            if (includeWriters(sheet.fields[0].writers)) {
                const newSheet: Sheet = {
                    name: sheet.name,
                    path: sheet.path,
                    ignore: sheet.ignore,
                    processors: structuredClone(sheet.processors),
                    fields: structuredClone(sheet.fields).filter((f) => includeWriters(f.writers)),
                    data: {},
                };
                copyTag(sheet.data, newSheet.data);
                newWorkbook.add(newSheet);
                for (const key of keys(sheet.data)) {
                    const row = sheet.data[key] as TRow;
                    const newRow: TRow = {};
                    copyTag(row, newRow);
                    newSheet.data[key] = newRow;
                    for (const field of newSheet.fields) {
                        newRow[field.name] = deepCopy(row[field.name]);
                    }
                }
            }
        }

        return newWorkbook;
    }
}

export class Context {
    readonly writer: string;
    readonly tag: string;

    private readonly _workbooks: Record<string, Workbook> = {};

    constructor(writer: string, tag: string) {
        this.writer = writer;
        this.tag = tag;
    }

    get workbooks(): readonly Workbook[] {
        return Object.values(this._workbooks).sort((a, b) =>
            a.path.localeCompare(b.path)
        ) as readonly Workbook[];
    }

    add(workbook: Workbook) {
        assert(workbook.context === this, `Context mismatch`);
        this._workbooks[workbook.path] = workbook;
    }

    remove(path: string): void;
    remove(workbook: Workbook): void;
    remove(pathOrWorkbook: Workbook | string) {
        if (typeof pathOrWorkbook === "string") {
            delete this._workbooks[pathOrWorkbook];
        } else {
            delete this._workbooks[pathOrWorkbook.path];
        }
    }

    get(path: string) {
        const found = Object.keys(this._workbooks)
            .filter((file) => file.endsWith(path))
            .filter((file) => basename(file) === basename(path));
        if (found.length === 0) {
            error(`File not found: ${path}`);
        } else if (found.length > 1) {
            error(`Multiple files found: ${found.join(", ")}`);
        }
        return this._workbooks[found[0]];
    }
}

export type Convertor = (str: string) => TValue;
export type Checker = (cell: TCell, row: TObject, field: Field, errors: string[]) => boolean;
export type CheckerParser = (ctx: Context, ...args: string[]) => Checker;
type CheckerType = {
    readonly name: string;
    readonly force: boolean;
    readonly source: string;
    readonly args: string[];
    readonly refer: string;
    exec: Checker;
};

export type Processor = (workbook: Workbook, sheet: Sheet, ...args: string[]) => Promise<void>;
type ProcessorType = {
    readonly name: string;
    readonly option: ProcessorOption;
    readonly exec: Processor;
};
type ProcessorOption = {
    /** Automatically added to every workbook. */
    readonly required: boolean;
    /** The priority of the processor, higher value means lower priority */
    readonly priority: number;
    readonly stage:
        | "after-read"
        | "pre-parse"
        | "after-parse"
        | "pre-check"
        | "after-check"
        | "pre-stringify"
        | "stringify"
        | "after-stringify";
};

export type Writer = (workbook: Workbook, processor: string, data: TObject | TArray) => void;

export const options = {
    suppressCheckers: [] as string[],
    suppressProcessors: [] as string[],
    suppressWriters: [] as string[],
};

export const DEFAULT_WRITER = "__xlsx_default_writer__";
export const DEFAULT_TAG = "__xlsx_default_tag__";
export const checkerParsers: Record<string, CheckerParser> = {};
export const convertors: Record<string, Convertor> = {};
export const processors: Record<string, ProcessorType> = {};
export const writers: Record<string, Writer> = {};

const MAX_ERRORS = 50;
const MAX_HEADERS = 6;
const contexts: Context[] = [];
const doings: string[] = [];
let runningContext: Context | undefined;

export const doing = (msg: string) => {
    doings.push(msg);
    return new (class {
        [Symbol.dispose]() {
            doings.pop();
        }
    })();
};

export function error(msg: string): never {
    let str = "";
    if (doings.length > 0) {
        str = "\n    doing:\n" + doings.map((v) => `      -> ${v}`).join("\n");
    }
    throw new Error(msg + str);
}

export function assert(condition: unknown, msg: string): asserts condition {
    if (!condition) {
        error(msg);
    }
}

export const copyTag = (src: object & Tag, dest: object & Tag) => {
    Object.keys(src)
        .filter((k) => k.startsWith("!"))
        .forEach((k) => ((dest as TObject)[k] = (src as TObject)[k]));
};

export const typeOf = (value: TValue) => {
    if (value && typeof value === "object" && value["!type"]) {
        return value["!type"];
    }
    return typeof value;
};

export const checkType = <T>(value: TValue, type: Type | string) => {
    const t = typeOf(value);
    if (t === type) {
        return value as T;
    }
    console.error(`checking value: `, value);
    throw new Error(`Expect type '${type}', but got '${t}'`);
};

export const isNull = (value: TValue): value is null | undefined => {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === "object" && value["!type"] === Type.Cell) {
        const cell = value as unknown as TCell;
        if (cell.v === null || cell.v === undefined) {
            return true;
        }
    }
    return false;
};

export const isNotNull = (value: TValue): value is Exclude<TValue, null | undefined> => {
    return !isNull(value);
};

export const ignoreField = (obj: object & Tag, field: string, ignored: boolean) => {
    obj["!ignore"] ??= {};
    obj["!ignore"][field] = ignored;
};

/**
 * Convert a cell to a string.
 * @param cell - The cell to convert.
 * @returns The string value of the cell, or empty string if the cell.v is null or undefined.
 */
export const toString = (cell?: TCell) => {
    if (isNull(cell)) {
        return "";
    }
    if (typeof cell.v === "string") {
        return cell.v.trim();
    }
    return String(cell.v);
};

const toRef = (col: number, row: number) => {
    const COLUMN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let ret = "";
    while (true) {
        const c = col % 26;
        ret = COLUMN[c] + ret;
        col = (col - c) / 26 - 1;
        if (col < 0) {
            break;
        }
    }
    return `${ret}${row + 1}`;
};

export function registerType(typename: string, convertor: Convertor): void {
    assert(typeof convertor === "function", `Convertor must be a function: '${typename}'`);
    if (convertors[typename]) {
        console.warn(`Overwrite previous registered convertor '${typename}'`);
    }
    convertors[typename] = convertor;
}

export const registerChecker = (name: string, parser: CheckerParser) => {
    if (checkerParsers[name]) {
        console.warn(`Overwrite previous registered checker parser '${name}'`);
    }
    checkerParsers[name] = parser;
};

/**
 * Register a processor.
 * @param name - The name of the processor.
 * @param processor - The processor function.
 * @param option - The options of the processor.
 */
export const registerProcessor = (
    name: string,
    processor: Processor,
    option?: Partial<ProcessorOption>
) => {
    if (processors[name]) {
        console.warn(`Overwrite previous registered processor '${name}'`);
    }
    processors[name] = {
        name,
        option: {
            required: option?.required ?? false,
            stage: option?.stage ?? "stringify",
            priority: option?.priority ?? 0,
        },
        exec: processor,
    };
};

export const registerWriter = (name: string, writer: Writer) => {
    if (writers[name]) {
        console.warn(`Overwrite previous registered writer '${name}'`);
    }
    writers[name] = writer;
};

const tokenizeArray = (str: string) => {
    str = str.trim();
    if (!str.startsWith("[") || !str.endsWith("]")) {
        error(`Invalid array string: '${str}'`);
    }

    const tokens: string[] = [];
    let current = "";
    let quote = "";
    let depth = 0;
    const content = str.slice(1, -1);
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (!quote) {
            if (char === '"' || char === "'") {
                quote = char;
                current = "";
            } else if (char === "{" || char === "[") {
                depth++;
                current += char;
            } else if (char === "}" || char === "]") {
                depth--;
                current += char;
            } else if (char === "," && depth === 0) {
                current = current.trim();
                if (current) {
                    tokens.push(current);
                    current = "";
                }
            } else {
                current += char;
            }
        } else {
            if (char === quote && content[i - 1] !== "\\") {
                quote = "";
            } else {
                current += char;
            }
        }
    }

    current = current.trim();
    if (current) {
        tokens.push(current);
    }

    return tokens;
};

const convertArray = (str: string, typename: string) => {
    typename = typename.replace("[]", "");
    const tokens = tokenizeArray(str);
    return tokens.map((s) => convertValue(s, typename));
};

export function convertValue(cell: TCell, typename: string): TCell;
export function convertValue(value: string, typename: string): TValue;
export function convertValue(cell: TCell | string, typename: string) {
    const convertor = convertors[typename.replace("?", "").replaceAll("[]", "")];
    if (!convertor) {
        error(`Convertor not found: '${typename}'`);
    }

    const rawtypename = typename.replace("?", "");
    let v = typeof cell === "string" ? cell : cell.v;

    if (typeof cell !== "string" && cell.t?.replace("?", "") === rawtypename) {
        return cell;
    }

    if (typename.includes("?") && (v === "" || v === null)) {
        if (typeof cell === "string") {
            return null;
        } else {
            cell.s = "null";
            cell.v = null;
            return cell;
        }
    }

    if (typeof v === "object") {
        error(`cell value is an object: ${JSON.stringify(v)}`);
    }

    v = String(v).trim();

    let result: TValue = null;

    try {
        if (typename.includes("[]")) {
            result = convertArray(v, rawtypename);
        } else {
            result = convertor(v) ?? null;
        }
    } catch (e) {
        console.error(e);
    }

    if (result === null) {
        let r = "";
        if (typeof cell === "object" && cell.r) {
            r = `at '${cell.r}'`;
        }
        error(`Convert value error: '${v}' -> type '${typename}' ${r}`);
    }

    if (typeof cell === "string") {
        return result;
    } else {
        cell.s = v;
        cell.v = result;
        cell.t = typename;
        return cell;
    }
}

const parseProcessor = (str: string) => {
    return str
        .split(/[;\n\r]+/)
        .map((s) => s.trim())
        .filter((s) => s)
        .map((s) => {
            /**
             * @Processor
             * @Processor(arg1, arg2, ...)
             * @processor({k1,k2}, id, key)
             * @processor([k1,k2], id, key)
             */
            const match = s.match(/^@(\w+)(?:\((.*?)\))?$/);
            const [, name = "", args = ""] = match ?? [];
            if (!name) {
                error(`Parse processor error: '${s}'`);
            } else if (!processors[name]) {
                error(`Processor not found: '${s}'`);
            }
            return {
                name,
                args: args
                    ? Array.from(args.matchAll(/{[^{}]+}|\[[^[\]]+\]|[^,]+/g)).map((a) =>
                          a[0].trim()
                      )
                    : [],
            };
        })
        .filter((p) => p.name);
};

const makeFilePath = (path: string) => (path.endsWith(".xlsx") ? path : path + ".xlsx");

export const parseChecker = (
    rowFile: string,
    rowSheet: string,
    refer: string,
    index: number,
    str: string
) => {
    if (str === "x" || (index === 0 && str.startsWith("!!"))) {
        return [];
    }
    if (str.trim() === "") {
        error(`No checker defined at ${refer}`);
    }
    return str
        .split(/[;\n\r]+/)
        .map((s) => s.trim())
        .filter((s) => s)
        .map((s) => {
            const force = s.startsWith("!");
            if (force) {
                s = s.slice(1);
            }
            using _ = doing(`Parsing checker at ${refer}: '${s}'`);
            let checker: CheckerType | undefined;
            if (s.startsWith("@")) {
                /**
                 * @Checker
                 * @Checker(arg1, arg2, ...)
                 */
                const [, name = "", arg = ""] = s.match(/^@(\w+)(?:\((.*?)\))?$/) ?? [];
                checker = {
                    name,
                    force,
                    source: s,
                    refer,
                    args: arg.split(",").map((a) => a.trim()),
                    exec: null!,
                };
            } else if (s.startsWith("[") && s.endsWith("]")) {
                /**
                 * [0, 1, "a", "b", "c", ...]
                 */
                checker = {
                    name: RANGE_CHECKER,
                    force,
                    source: s,
                    refer,
                    args: [s],
                    exec: null!,
                };
            } else if (s.endsWith("#")) {
                /**
                 * file#
                 * #
                 */
                const [, rowKey = "", rowFilter = "", colFile = ""] =
                    s.match(/^(?:\$([^&]*)?(?:&(.+))?==)?([^#]*)#$/) ?? [];
                checker = {
                    name: SHEET_CHECKER,
                    force,
                    source: s,
                    refer,
                    args: [rowFile, rowSheet, rowKey, rowFilter, makeFilePath(colFile || rowFile)],
                    exec: null!,
                };
            } else if (s.includes("#")) {
                /**
                 * $.id==task#main.id
                 * task#main.id
                 * #main.id
                 * $&key2=MAIN==#main.type&condition=mainline_event
                 */
                const [
                    ,
                    rowKey = "",
                    rowFilter = "",
                    colFile = "",
                    colSheet = "",
                    colKey = "",
                    colFilter = "",
                ] = s.match(/^(?:\$([^&]*)?(?:&(.+))?==)?([^#=]*)#([^.]+)\.(\w+)(?:&(.+))?$/) ?? [];
                if (!colSheet || !colKey) {
                    error(`Invalid index checker at ${refer}: '${s}'`);
                }
                checker = {
                    name: INDEX_CHECKER,
                    force,
                    source: s,
                    refer,
                    args: [
                        rowFile,
                        rowSheet,
                        rowKey,
                        rowFilter,
                        makeFilePath(colFile || rowFile),
                        colSheet,
                        colKey,
                        colFilter,
                    ],
                    exec: null!,
                };
            } else if (s !== "x") {
                /**
                 * value >= 0 && value <= 100
                 */
                checker = {
                    name: EXPR_CHECKER,
                    force,
                    source: s,
                    refer,
                    args: [s],
                    exec: null!,
                };
            }
            return checker;
        })
        .filter((v) => !!v);
};

const readCell = (sheetData: xlsx.WorkSheet, r: number, c: number) => {
    const cell: TCell = sheetData[r]?.[c] ?? {};
    cell.v = typeof cell.v === "string" ? cell.v.trim() : (cell.v ?? "");
    cell.r = toRef(c, r);
    cell.t = undefined;
    cell["!type"] = Type.Cell;
    return cell;
};

export const makeCell = (v: TValue, t?: string, r?: string, s?: string) => {
    return { "!type": Type.Cell, v: v ?? null, t, r, s } as TCell;
};

const readHeader = (path: string, data: xlsx.WorkBook) => {
    const ctx = getContext(DEFAULT_WRITER, DEFAULT_TAG)!;
    const requiredProcessors = Object.values(processors)
        .filter((p) => p.option.required)
        .reduce(
            (acc, p) => {
                acc[p.name] = 0;
                return acc;
            },
            {} as Record<string, number>
        );

    const workbook = ctx.get(path);
    const writerKeys = Object.keys(writers);

    let firstSheet: Sheet | null = null;

    for (const sheetName of data.SheetNames) {
        using _ = doing(`Reading sheet '${sheetName}' in '${path}'`);
        const sheetData = data.Sheets[sheetName];
        if (sheetName.startsWith("#") || !sheetData[0]) {
            continue;
        }

        const sheet: Sheet = {
            name: sheetName,
            path: path,
            ignore: false,
            processors: [],
            fields: [],
            data: {},
        };

        sheet.data["!type"] = Type.Sheet;
        sheet.data["!name"] = sheetName;

        const str = toString(readCell(sheetData, 0, 0));
        let start = 0;
        if (str.startsWith("@")) {
            sheet.processors.push(...parseProcessor(str));
            start = 1;
            for (const p of sheet.processors) {
                if (requiredProcessors[p.name] !== undefined) {
                    requiredProcessors[p.name]++;
                }
            }
        }

        if (!sheetData[start]) {
            continue;
        }

        const parsed: Record<string, boolean> = {};
        for (let c = 0; c < sheetData[start].length; c++) {
            const r = start;
            const name = toString(readCell(sheetData, r + 0, c));
            const typename = toString(readCell(sheetData, r + 1, c));
            const writer = toString(readCell(sheetData, r + 2, c));
            const checker = toString(readCell(sheetData, r + 3, c));
            const comment = toString(readCell(sheetData, r + 4, c));

            if (name && typename && writer !== "x") {
                const arr = writer
                    .split("|")
                    .map((w) => w.trim())
                    .filter((w) => c > 0 || !w.startsWith(">>"))
                    .filter((w) => w)
                    .map((w) => {
                        if (!writerKeys.includes(w)) {
                            error(`Writer not found: '${w}' at ${toRef(c, r + 2)}`);
                        }
                        return w;
                    });
                if (parsed[name]) {
                    error(`Duplicate field name: '${name}' at ${toRef(c, r)}`);
                }
                parsed[name] = true;
                sheet.fields.push({
                    path,
                    sheet: sheetName,
                    index: c,
                    name,
                    typename,
                    writers: arr.length ? arr : writerKeys.slice(),
                    checker: parseChecker(
                        basename(path),
                        sheetName,
                        `${toRef(c, r + 3)}`,
                        c,
                        checker
                    ),
                    comment,
                    refer: toRef(c, r),
                    ignore: false,
                });
            }
        }

        if (sheet.fields.length > 0) {
            firstSheet ??= sheet;
            workbook.add(sheet);
        }
    }

    if (firstSheet) {
        for (const name in requiredProcessors) {
            if (requiredProcessors[name] === 0) {
                firstSheet.processors.push({
                    name,
                    args: [],
                });
            }
        }
    }
};

const readBody = (path: string, data: xlsx.WorkBook) => {
    const ctx = getContext(DEFAULT_WRITER, DEFAULT_TAG)!;
    const workbook = ctx.get(path);
    for (const sheetName of data.SheetNames) {
        if (!workbook.has(sheetName)) {
            continue;
        }
        using _ = doing(`Reading sheet '${sheetName}' in '${path}'`);
        const sheetData = data.Sheets[sheetName];
        const sheet = workbook.get(sheetName);
        const start = toString(readCell(sheetData, 0, 0)).startsWith("@")
            ? MAX_HEADERS
            : MAX_HEADERS - 1;
        let maxRows = sheetData.length;
        for (let r = sheetData.length - 1; r >= start; r--) {
            const cell: TCell | undefined = sheetData[r]?.[0];
            if (!cell || cell.v === "") {
                maxRows = r;
            } else {
                break;
            }
        }
        for (let r = start; r < maxRows; r++) {
            const row: TRow = {};
            row["!type"] = Type.Row;
            for (const field of sheet.fields) {
                const cell: TCell = readCell(sheetData, r, field.index);
                if (field.typename === "auto") {
                    if (cell.v !== "-") {
                        error(`Expected '-' at ${toRef(0, r)}, but got '${cell.v}'`);
                    }
                    cell.v = r - start + 1;
                }
                row[field.name] = cell;
                if (field.index === 0) {
                    sheet.data[r + 1] = row;
                    if (field.name.startsWith("--")) {
                        ignoreField(row, field.name, true);
                        field.ignore = true;
                    }
                } else if (field.typename.startsWith("@")) {
                    const typename = field.typename.slice(1);
                    const refField = sheet.fields.find((f) => f.name === typename);
                    ignoreField(row, typename, true);
                    assert(refField, `Type field not found: ${typename} at ${field.refer}`);
                    refField.ignore = true;
                }
            }
        }
    }
};

const resolveChecker = () => {
    const writerKeys = Object.keys(writers);
    for (const ctx of contexts) {
        if (!writerKeys.includes(ctx.writer)) {
            continue;
        }
        for (const workbook of ctx.workbooks) {
            for (const sheet of workbook.sheets) {
                using _ = doing(`Resolving checker in '${workbook.path}#${sheet.name}'`);
                for (const field of sheet.fields) {
                    for (const checker of field.checker) {
                        const parser = checkerParsers[checker.name];
                        if (!parser) {
                            error(
                                `Checker parser not found at ${checker.refer}: '${checker.name}'`
                            );
                        }
                        using __ = doing(`Parsing checker at ${checker.refer}: ${checker.source}`);
                        assert(!checker.exec, `Checker already parsed: ${checker.refer}`);
                        checker.exec = parser(ctx, ...checker.args);
                    }
                }
            }
        }
    }
};

const parseBody = () => {
    const ctx = getContext(DEFAULT_WRITER, DEFAULT_TAG)!;
    for (const workbook of ctx.workbooks) {
        console.log(`parsing: '${workbook.path}'`);
        for (const sheet of workbook.sheets) {
            using _ = doing(`Parsing sheet '${sheet.name}' in '${workbook.path}'`);
            for (const row of values<TRow>(sheet.data)) {
                for (const field of sheet.fields) {
                    const cell = row[field.name];
                    checkType(cell, Type.Cell);
                    let typename = field.typename;
                    if (typename.startsWith("@")) {
                        typename = row[typename.slice(1)]?.v as string;
                        if (!typename) {
                            error(`type not found for ${cell.r}`);
                        }
                    }
                    convertValue(cell, typename);
                }
            }
        }
    }
};

const copyWorkbook = () => {
    for (const ctx of contexts.slice()) {
        for (const writer in writers) {
            if (options.suppressWriters.includes(writer)) {
                continue;
            }
            console.log(`creating context: writer=${writer} tag=${ctx.tag}`);
            const newCtx = addContext(new Context(writer, ctx.tag));
            for (const workbook of ctx.workbooks) {
                for (const sheet of workbook.sheets) {
                    using _ = doing(`Checking sheet '${sheet.name}' in '${workbook.path}'`);
                    const data: TObject = {};
                    copyTag(sheet.data, data);
                    const keyField = sheet.fields[0];
                    for (const row of values<TRow>(sheet.data)) {
                        const key = row[keyField.name].v as string;
                        if (key === "" || key === undefined || key === null) {
                            error(`Key is empty at ${row[keyField.name].r}`);
                        }
                        if (data[key]) {
                            const last = (data[key] as TRow)[keyField.name];
                            const curr = row[keyField.name];
                            error(`Duplicate key: ${key}, last: ${last.r}, current: ${curr.r}`);
                        }
                        data[key] = row;
                    }
                    sheet.data = data;
                }
                newCtx.add(workbook.clone(newCtx));
            }
        }
    }
};

const invokeChecker = (sheet: Sheet, field: Field, errors: string[]) => {
    const checkers = field.checker.filter((c) => !options.suppressCheckers.includes(c.name));
    for (const checker of checkers) {
        const errorValues: string[] = [];
        const errorDescs: string[] = [];
        for (const row of values<TRow>(sheet.data)) {
            const cell = row[field.name];
            checkType(cell, Type.Cell);
            if ((cell.v !== null || checker.force) && !checker.exec(cell, row, field, errorDescs)) {
                errorValues.push(`${cell.r}: ${cell.s}`);
                if (errorDescs.length > 0) {
                    for (const str of errorDescs) {
                        errorValues.push("    ❌ " + str);
                    }
                    errorDescs.length = 0;
                }
            }
        }
        if (errorValues.length > 0) {
            if (errorValues.length > MAX_ERRORS) {
                errorValues.length = MAX_ERRORS;
                errorValues.push("...");
            }
            errors.push(
                `builtin check:\n` +
                    `     path: ${field.path}\n` +
                    `    sheet: ${field.sheet}\n` +
                    `    field: ${field.name}\n` +
                    `  checker: ${checker.source}\n` +
                    `   values:\n` +
                    `      ${errorValues.join("\n      ")}\n`
            );
        }
    }
};

const performChecker = () => {
    const writerKeys = Object.keys(writers);
    for (const ctx of contexts) {
        if (!writerKeys.includes(ctx.writer)) {
            continue;
        }
        console.log(`performing checker: writer=${ctx.writer} tag=${ctx.tag}`);
        const errors: string[] = [];
        for (const workbook of ctx.workbooks) {
            for (const sheet of workbook.sheets) {
                for (const field of sheet.fields) {
                    const msg = `'${field.name}' at ${field.refer} in '${workbook.path}#${sheet.name}'`;
                    using _ = doing(`Checking ${msg}`);
                    try {
                        invokeChecker(sheet, field, errors);
                    } catch (e) {
                        error((e as Error).stack ?? String(e));
                    }
                }
            }
        }
        if (errors.length > 0) {
            throw new Error(errors.join("\n"));
        }
    }
};

const performProcessor = async (stage: ProcessorOption["stage"], writer?: string) => {
    type ProcessorEntry = {
        processor: ProcessorType;
        sheet: Sheet;
        args: string[];
        name: string;
    };
    const writerKeys = writer ? [writer] : Object.keys(writers);
    for (const ctx of contexts.slice()) {
        if (!writerKeys.includes(ctx.writer)) {
            continue;
        }
        runningContext = ctx;
        console.log(`performing processor: stage=${stage} writer=${ctx.writer} tag=${ctx.tag}`);
        for (const workbook of ctx.workbooks) {
            const arr: ProcessorEntry[] = [];
            for (const sheet of workbook.sheets) {
                for (const { name, args } of sheet.processors) {
                    const processor = processors[name];
                    if (processor.option.stage !== stage) {
                        continue;
                    }
                    arr.push({
                        processor: processor,
                        sheet: sheet,
                        args: args,
                        name: name,
                    });
                }
            }
            arr.sort((a, b) => a.processor.option.priority - b.processor.option.priority);
            for (const { processor, sheet, args, name } of arr) {
                using _ = doing(
                    `Performing processor '${name}' in '${workbook.path}#${sheet.name}'`
                );
                try {
                    await processor.exec(workbook, sheet, ...args);
                } catch (e) {
                    error((e as Error).stack ?? String(e));
                }
            }
        }
        runningContext = undefined;
    }
};

export const parse = async (fs: string[], headerOnly: boolean = false) => {
    const ctx = addContext(new Context(DEFAULT_WRITER, DEFAULT_TAG));
    for (const file of fs) {
        ctx.add(new Workbook(ctx, file));
    }
    for (const file of fs) {
        console.log(`reading: '${file}'`);
        const data = xlsx.readFile(file, {
            dense: true,
            cellHTML: false,
            cellFormula: false,
            cellText: false,
            raw: true,
            sheetRows: headerOnly ? MAX_HEADERS : undefined,
        });
        readHeader(file, data);
        if (!headerOnly) {
            readBody(file, data);
        }
    }
    await performProcessor("after-read", DEFAULT_WRITER);
    if (!headerOnly) {
        await performProcessor("pre-parse", DEFAULT_WRITER);
        parseBody();
        await performProcessor("after-parse", DEFAULT_WRITER);
        copyWorkbook();
        await performProcessor("pre-check");
        resolveChecker();
        performChecker();
        await performProcessor("after-check");
        await performProcessor("pre-stringify");
        await performProcessor("stringify");
        await performProcessor("after-stringify");
    }
};

export const write = (workbook: Workbook, processor: string, data: object) => {
    const writer = workbook.context.writer;
    assert(!!writers[writer], `Writer not found: ${writer}`);
    writers[writer](workbook, processor, data as TObject | TArray);
};

export const getRunningContext = () => {
    if (!runningContext) {
        throw new Error(`No running context`);
    }
    return runningContext;
};

export const getContexts = (): readonly Context[] => {
    return contexts;
};

export const getContext = (writer: string, tag: string) => {
    return contexts.find((c) => c.writer === writer && c.tag === tag);
};

export const addContext = (context: Context) => {
    if (getContext(context.writer, context.tag)) {
        throw new Error(`Context already exists: writer=${context.writer}, tag=${context.tag}`);
    }
    contexts.push(context);
    return context;
};

export const removeContext = (context: Context) => {
    const index = contexts.indexOf(context);
    if (index !== -1) {
        contexts.splice(index, 1);
    }
};

import { basename, dirname } from "path";
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
    ["!stringify"]?: (v: TValue, ctx: StringifyContext) => void;
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
    index: number;
    name: string;
    sheet: string;
    path: string;
    typename: string;
    realtype?: string;
    ignore: boolean;
    writers: string[];
    checker: CheckerType[];
    comment: string;
    refer: string;
};

export type Sheet = {
    name: string;
    path: string;
    ignore: boolean;
    processors: { name: string; args: string[] }[];
    fields: Field[];
    data: TObject;
};

export type Workbook = {
    path: string;
    writer: string;
    sheets: Record<string, Sheet>;
};

export type Convertor = (str: string) => TValue;
export type Checker = (cell: TCell, row: TObject, field: Field, errors: string[]) => boolean;
export type CheckerParser = (...args: string[]) => Checker;
type CheckerType = {
    name: string;
    force: boolean;
    source: string;
    args: string[];
    refer: string;
    exec: Checker;
};

export type Processor = (workbook: Workbook, sheet: Sheet, ...args: string[]) => Promise<void>;
type ProcessorType = {
    name: string;
    option: ProcessorOption;
    exec: Processor;
};
type ProcessorOption = {
    required: boolean;
    priority: number;
    stage:
        | "after-read"
        | "pre-parse"
        | "after-parse"
        | "pre-check"
        | "after-check"
        | "pre-stringify"
        | "stringify"
        | "after-stringify";
};

export type Writer = (path: string, data: TObject, processor: string) => void;

const MAX_ERRORS = 50;
const MAX_HEADERS = 6;
const DEFAULT_WRITER = "__xlsx_default_writer__";
let currentWriter = DEFAULT_WRITER;
/** writer -> path -> workbook */
const workbooks: Record<string, Record<string, Workbook>> = {};
export const checkerParsers: Record<string, CheckerParser> = {};
export const convertors: Record<string, Convertor> = {};
export const processors: Record<string, ProcessorType> = {};
export const writers: Record<string, Writer> = {};
const doings: string[] = [];

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

export const ignoreField = (value: object & Tag, field: string, ignored: boolean) => {
    value["!ignore"] ??= {};
    value["!ignore"][field] = ignored;
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
                current += char;
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
            current += char;
            if (char === quote && content[i - 1] !== "\\") {
                quote = "";
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

const resolveFile = (base: string, target: string) => {
    const dir = basename(dirname(base));
    const file = `${dir}/${target}`;
    const found = Object.keys(workbooks[DEFAULT_WRITER])
        .filter((v) => v.endsWith(file))
        .filter((v) => basename(v) === basename(file));
    return found.length === 1 ? file : target;
};

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
                        colFile ? resolveFile(rowFile, makeFilePath(colFile)) : rowFile,
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
    const requiredProcessors = Object.values(processors)
        .filter((p) => p.option.required)
        .reduce(
            (acc, p) => {
                acc[p.name] = 0;
                return acc;
            },
            {} as Record<string, number>
        );

    const workbook = workbooks[DEFAULT_WRITER][path];
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
                    checker: parseChecker(path, sheetName, `${toRef(c, r + 3)}`, c, checker),
                    comment,
                    refer: toRef(c, r),
                    ignore: false,
                });
            }
        }

        if (sheet.fields.length > 0) {
            firstSheet ??= sheet;
            workbook.sheets[sheetName] = sheet;
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
    const workbook = workbooks[DEFAULT_WRITER][path];
    for (const sheetName of data.SheetNames) {
        using _ = doing(`Reading sheet '${sheetName}' in '${path}'`);
        const sheetData = data.Sheets[sheetName];
        if (!workbook.sheets[sheetName]) {
            continue;
        }
        const sheet = workbook.sheets[sheetName];
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
                    sheet.data[cell.v as string] = row;
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
    for (const writer in writers) {
        currentWriter = writer;
        for (const workbook of Object.values(workbooks[writer])) {
            for (const sheet of Object.values(workbook.sheets)) {
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
                        checker.exec = parser(...checker.args);
                    }
                }
            }
        }
    }
    currentWriter = DEFAULT_WRITER;
};

const parseBody = () => {
    for (const workbook of Object.values(workbooks[DEFAULT_WRITER])) {
        console.log(`parsing: '${workbook.path}'`);
        for (const sheet of Object.values(workbook.sheets)) {
            using _ = doing(`Parsing sheet '${sheet.name}' in '${workbook.path}'`);
            const remap = !["string", "int", "auto"].includes(sheet.fields[0].typename);
            for (const key of keys(sheet.data)) {
                const row = sheet.data[key] as TRow;
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
                if (remap) {
                    delete sheet.data[key];
                    const newKey = row[sheet.fields[0].name].v as string;
                    sheet.data[newKey] = row;
                }
            }
        }
    }
    console.log("copying workbook");
    for (const writer in writers) {
        workbooks[writer] = {};
        for (const workbook of Object.values(workbooks[DEFAULT_WRITER])) {
            workbooks[writer][workbook.path] = copyOf(workbook, writer);
        }
    }
};

const invokeChecker = (sheet: Sheet, field: Field, errors: string[]) => {
    for (const checker of field.checker) {
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
    console.log("performing checker");
    for (const writer in writers) {
        currentWriter = writer;
        const errors: string[] = [];
        for (const workbook of Object.values(workbooks[writer])) {
            for (const sheetName in workbook.sheets) {
                const sheet = workbook.sheets[sheetName];
                for (const field of sheet.fields) {
                    const msg = `'${field.name}' at ${field.refer} in '${workbook.path}#${sheetName}'`;
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
    currentWriter = DEFAULT_WRITER;
};

const performProcessor = async (stage: ProcessorOption["stage"], writer?: string) => {
    type ProcessorEntry = {
        processor: ProcessorType;
        sheet: Sheet;
        args: string[];
        name: string;
    };
    console.log(`performing processor: stage=${stage}`);
    for (const k in writers) {
        currentWriter = writer ?? k;
        for (const workbook of Object.values(workbooks[currentWriter])) {
            const arr: ProcessorEntry[] = [];
            for (const sheetName in workbook.sheets) {
                const sheet = workbook.sheets[sheetName];
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
    }
    currentWriter = DEFAULT_WRITER;
};

export const parse = async (fs: string[], headerOnly: boolean = false) => {
    workbooks[DEFAULT_WRITER] ||= {};
    for (const file of fs) {
        workbooks[DEFAULT_WRITER][file] = {
            path: file,
            writer: DEFAULT_WRITER,
            sheets: {},
        };
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
        await performProcessor("after-parse");
        await performProcessor("pre-check");
        resolveChecker();
        performChecker();
        await performProcessor("after-check");
        await performProcessor("pre-stringify");
        await performProcessor("stringify");
        await performProcessor("after-stringify");
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

const copyTag = (src: object & Tag, dest: object & Tag) => {
    Object.keys(src)
        .filter((k) => k.startsWith("!"))
        .forEach((k) => ((dest as TObject)[k] = (src as TObject)[k]));
};

const copyOf = (workbook: Workbook, writer: string, headerOnly: boolean = false) => {
    const result: Workbook = { ...workbook, writer, sheets: {} };

    for (const sheetName in workbook.sheets) {
        const sheet = workbook.sheets[sheetName];
        if (sheet.fields[0].writers.includes(writer)) {
            const resultSheet: Sheet = {
                name: sheet.name,
                path: sheet.path,
                ignore: sheet.ignore,
                processors: structuredClone(sheet.processors),
                fields: structuredClone(sheet.fields).filter((f) => f.writers.includes(writer)),
                data: {},
            };
            copyTag(sheet.data, resultSheet.data);
            result.sheets[sheetName] = resultSheet;
            if (!headerOnly) {
                for (const key of keys(sheet.data)) {
                    const row = sheet.data[key] as TRow;
                    const copiedRow: TRow = {};
                    copyTag(row, copiedRow);
                    resultSheet.data[key] = copiedRow;
                    for (const field of resultSheet.fields) {
                        copiedRow[field.name] = deepCopy(row[field.name]);
                    }
                }
            }
        }
    }
    return result;
};

/**
 * Get a workbook by path.
 * @param path - The path of the workbook.
 * @param writer - The writer of the workbook.
 * @returns The workbook.
 * @throws An error if the workbook is not found.
 */
export const getWorkbook = (path: string, writer?: string) => {
    writer ??= currentWriter;
    const found = Object.keys(workbooks[writer])
        .filter((file) => file.endsWith(path))
        .filter((file) => basename(file) === basename(path));
    if (found.length === 0) {
        error(`File not found: ${path}`);
    } else if (found.length > 1) {
        error(`Multiple files found: ${found.join(", ")}`);
    }
    return workbooks[writer][found[0]];
};

export const getWorkbooks = (writer?: string) => {
    writer ??= currentWriter;
    return workbooks[writer];
};

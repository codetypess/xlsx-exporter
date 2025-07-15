import xlsx from "xlsx";
import { type StringifyContext } from "./stringify";
import { checkType, filterKeys, filterValues, isNullOrUndefined, toRef, toString } from "./util";

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
    /** writer */
    ["!writer"]?: string[];
    /** row index */
    ["!index"]?: number;
    /** field */
    ["!field"]?: Field;
    /** row data */
    ["!row"]?: TObject;
    /** row key */
    ["!key"]?: TCell;
};

export type TCell = {
    /** converted value */
    v: unknown;
    /** location: A1 */
    r: string;
    /** original string value */
    s: string;
} & Tag;

export type TValue = boolean | number | string | null | undefined | TObject | TArray | TCell;
export type TObject = { [k: string | number]: TValue } & Tag;
export type TArray = TValue[] & Tag;
export type TRow = { [k: string]: TCell } & Tag;

export type Field = {
    sheet: string;
    path: string;
    index: number;
    name: string;
    typename: string;
    writers: string[];
    checker: CheckerType[];
    comment: string;
    refer: string;
};

export type Sheet = {
    name: string;
    processors: { name: string; args: string[] }[];
    fields: Field[];
    data: TObject;
};

export type Workbook = {
    path: string;
    sheets: Record<string, Sheet>;
};

export type Convertor = (str: string) => unknown | null;
type RealType = "int" | "float" | "string" | "bool" | null;
type ConvertorType = { realtype?: RealType; exec: Convertor };

export type Checker = (cell: TCell, row: TObject, field: Field, errors: string[]) => boolean;
export type CheckerParser = (...args: string[]) => Checker;
type CheckerType = {
    name: string;
    force: boolean;
    def: string;
    exec: Checker;
};

export type Processor = (workbook: Workbook, sheet: Sheet, ...args: string[]) => void;
type ProcessorType = {
    name: string;
    priority: number;
    required: boolean;
    exec: Processor;
};

export type Writer = (path: string, data: TObject, processor: string) => void;

const MAX_ERRORS = 50;
const MAX_HEADERS = 6;
// eslint-disable-next-line prefer-const
export let debug = true;
export const files: Record<string, Workbook> = {};
export const checkerParsers: Record<string, CheckerParser> = {};
export const convertors: Record<string, ConvertorType> = {};
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
    if (doings.length > 0) {
        console.log(" -> " + doings.join("\n -> "));
    }
    throw new Error(msg);
}

export function assert(condition: boolean, msg: string): asserts condition {
    if (!condition) {
        error(msg);
    }
}

export function debugAssert(condition: boolean, msg?: string): asserts condition {
    if (!condition && debug) {
        error(msg ?? "Debug assertion failed");
    }
}

export function registerType(typename: string, convertor: Convertor): void;
export function registerType(typename: string, realtype: RealType, convertor: Convertor): void;
export function registerType(
    typename: string,
    realtypeOrConvertor: RealType | Convertor,
    convertor?: Convertor
): void {
    let realtype: RealType | null = null;
    if (!convertor) {
        convertor = realtypeOrConvertor as Convertor;
        realtype = null;
    } else {
        realtype = realtypeOrConvertor as RealType;
    }
    assert(typeof convertor === "function", `Convertor must be a function: '${typename}'`);
    assert(!convertors[typename], `Type '${typename}' already registered`);
    convertors[typename] = { realtype, exec: convertor };
}

export const registerChecker = (name: string, parser: CheckerParser) => {
    assert(!checkerParsers[name], `Checker parser '${name}' already registered`);
    checkerParsers[name] = parser;
};

/**
 * Register a processor.
 * @param name - The name of the processor.
 * @param processor - The processor function.
 * @param priority - The priority of the processor.
 * @param required - Whether the processor is required.
 */
export const registerProcessor = (
    name: string,
    processor: Processor,
    priority: number = 0,
    required: boolean = false
) => {
    assert(!processors[name], `Processor '${name}' already registered`);
    processors[name] = {
        name,
        priority,
        required: required,
        exec: processor,
    };
};

export const registerWriter = (name: string, writer: Writer) => {
    assert(!writers[name], `Writer '${name}' already registered`);
    writers[name] = writer;
};

export function convertValue(cell: TCell, typename: string): TCell;
export function convertValue(value: string, typename: string): TValue;
export function convertValue(cell: TCell | string, typename: string) {
    const convertor = convertors[typename.replace("?", "")];
    if (!convertor) {
        error(`Convertor not found: '${typename}'`);
    }
    if (typeof cell === "string") {
        const v = convertor.exec(cell);
        if (v === null || v === undefined || v === "") {
            error(`Convert value error: '${cell}' => type '${typename}'`);
        }
        return v as TValue;
    } else {
        if (typename.endsWith("?") && cell.v === "") {
            cell.s = "null";
            cell.v = null;
        } else {
            const v = cell.v;
            cell.s = toString(cell);
            cell.v = convertor.exec(cell.s);
            if (cell.v === null || cell.v === undefined || cell.v === "") {
                error(`Convert value error at ${cell.r}: '${v}' => type '${typename}'`);
            }
        }
        return cell;
    }
}

const parseProcessor = (str: string) => {
    return str
        .split(/[;\n\r]+/)
        .filter((s) => s.trim())
        .map((s) => {
            /**
             * @Processor
             * @Processor(arg1, arg2, ...)
             */
            const match = s.match(/@(\w+)(?:\((.*?)\))?/);
            const [, name = "", args = ""] = match ?? [];
            if (!processors[name]) {
                error(`Processor not found: '${name}'`);
            }
            return {
                name,
                args: args ? args.split(",").map((a) => a.trim()) : [],
            };
        })
        .filter((p) => p.name);
};

const parseChecker = (path: string, refer: string, str: string) => {
    if (str === "x") {
        return [];
    }
    return str
        .split(/[;\n\r]+/)
        .filter((s) => !!s.trim())
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
                const [, name = "", arg = ""] = s.match(/@(\w+)(?:\((.*?)\))?/) ?? [];
                const parser = checkerParsers[name];
                if (!parser) {
                    error(`Checker parser not found at ${refer}: '${name}'`);
                }
                checker = {
                    name,
                    force,
                    def: s,
                    exec: parser(...arg.split(",").map((a) => a.trim())),
                };
            } else if (s.startsWith("[") && s.endsWith("]")) {
                /**
                 * [0, 1, "a", "b", "c", ...]
                 */
                const parser = checkerParsers[RANGE_CHECKER];
                checker = {
                    name: RANGE_CHECKER,
                    force,
                    def: s,
                    exec: parser(s),
                };
            } else if (s.endsWith("#")) {
                /**
                 * file#
                 * #
                 */
                const parser = checkerParsers[SHEET_CHECKER];
                const [, file = ""] = s.match(/^([^#]*)#$/) ?? [];
                checker = {
                    name: SHEET_CHECKER,
                    force,
                    def: s,
                    exec: parser(file || path),
                };
            } else if (s.includes("#")) {
                /**
                 * id=task#main.id
                 * task#main.id
                 * #main.id
                 */
                const [, idx = "", file = "", sheet = "", key = ""] =
                    s.match(/^(?:\[?(\w+)\]?=)?([^=]*)#([^.]+)\.(\w+)$/) ?? [];
                if (!sheet || !key) {
                    error(`Invalid index checker at ${refer}: '${s}'`);
                }
                const parser = checkerParsers[INDEX_CHECKER];
                checker = {
                    name: INDEX_CHECKER,
                    force,
                    def: s,
                    exec: parser(file || path, sheet, key, idx),
                };
            } else if (s !== "x") {
                /**
                 * value >= 0 && value <= 100
                 */
                const parser = checkerParsers[EXPR_CHECKER];
                checker = {
                    name: EXPR_CHECKER,
                    force,
                    def: s,
                    exec: parser(s),
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
    cell["!type"] = Type.Cell;
    return cell;
};

const readHeader = (path: string, data: xlsx.WorkBook) => {
    const requiredProcessors = Object.values(processors)
        .filter((p) => p.required)
        .reduce(
            (acc, p) => {
                acc[p.name] = 0;
                return acc;
            },
            {} as Record<string, number>
        );
    const workbook: Workbook = {
        path: path,
        sheets: {},
    };
    files[path] = workbook;
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
            processors: [],
            fields: [],
            data: {},
        };

        sheet.data["!type"] = Type.Sheet;

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

        const parsed: Record<string, string> = {};
        for (let c = 0; c < sheetData[start].length; c++) {
            const r = start;
            const name = toString(readCell(sheetData, r + 0, c));
            const typename = toString(readCell(sheetData, r + 1, c));
            const writer = toString(readCell(sheetData, r + 2, c));
            const checker = toString(readCell(sheetData, r + 3, c));
            const comment = toString(readCell(sheetData, r + 4, c));

            if (!name || !typename) {
                break;
            } else if (writer !== "x") {
                const arr = writer
                    .split("|")
                    .map((w) => w.trim())
                    .filter((w) => w)
                    .map((w) => {
                        if (!writerKeys.includes(w) && c > 0) {
                            error(`Writer not found: '${w}' at ${toRef(c, r + 2)}`);
                        }
                        return w;
                    });
                assert(
                    !!convertors[typename.replace("?", "")],
                    `Type not found at ${toRef(c, r + 1)}: '${typename}'`
                );
                if (parsed[name]) {
                    error(`Duplicate field name: '${name}' at ${toRef(c, r)}`);
                }
                parsed[name] = toRef(c, r);
                sheet.fields.push({
                    path,
                    sheet: sheetName,
                    index: c,
                    name,
                    typename,
                    writers: c > 0 && arr.length ? arr : writerKeys.slice(),
                    checker: parseChecker(path, parsed[name], c === 0 ? "x" : checker),
                    comment,
                    refer: toRef(c, r),
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
    const workbook = files[path];
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
        loop: for (let r = start; r < sheetData.length; r++) {
            const row: TObject = {};
            row["!type"] = Type.Row;
            row["!index"] = r + 1;
            for (const field of sheet.fields) {
                const cell: TCell = readCell(sheetData, r, field.index);
                if (field.index === 0 && cell.v === "") {
                    break loop;
                }
                if (field.typename === "auto") {
                    cell.v = r - start + 1;
                }
                cell["!field"] = field;
                cell["!row"] = row;
                cell["!writer"] = field.writers;
                row[field.name] = cell;
                if (field.index === 0) {
                    row["!key"] = cell;
                    sheet.data[cell.v as string] = row;
                }
            }
        }
    }
};

const parseBody = () => {
    for (const file in files) {
        const workbook = files[file];
        console.log(`parsing: '${file}'`);
        for (const sheetName in workbook.sheets) {
            using _ = doing(`Parsing sheet '${sheetName}' in '${file}'`);
            const sheet = workbook.sheets[sheetName];
            for (const row of filterValues<TRow>(sheet.data)) {
                for (const field of sheet.fields) {
                    const cell = row[field.name];
                    checkType(cell, Type.Cell);
                    convertValue(cell, field.typename);
                }
            }
        }
    }
};

const invokeChecker = (sheet: Sheet, field: Field, errors: string[]) => {
    for (const checker of field.checker) {
        const errorValues: string[] = [];
        const errorDescs: string[] = [];
        for (const row of filterValues<TRow>(sheet.data)) {
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
                    `  checker: ${checker.def}\n` +
                    `   values:\n` +
                    `      ${errorValues.join("\n      ")}\n`
            );
        }
    }
};

const applyChecker = () => {
    const errors: string[] = [];
    for (const file in files) {
        const workbook = files[file];
        for (const sheetName in workbook.sheets) {
            const sheet = workbook.sheets[sheetName];
            for (const field of sheet.fields) {
                using _ = doing(`Checking field '${field.name}' in '${file}#${sheetName}'`);
                try {
                    invokeChecker(sheet, field, errors);
                } catch (e) {
                    console.error(e);
                    error(`Error checking field '${field.name}' in '${file}#${sheetName}'`);
                }
            }
        }
    }
    if (errors.length > 0) {
        throw new Error(errors.join("\n"));
    }
};

const applyProcessor = () => {
    type ProcessorEntry = {
        processor: ProcessorType;
        sheet: Sheet;
        args: string[];
        name: string;
    };
    for (const file in files) {
        const workbook = files[file];
        const arr: ProcessorEntry[] = [];
        for (const sheetName in workbook.sheets) {
            const sheet = workbook.sheets[sheetName];
            for (const { name, args } of sheet.processors) {
                arr.push({
                    processor: processors[name],
                    sheet: sheet,
                    args: args,
                    name: name,
                });
            }
        }
        arr.sort((a, b) => a.processor.priority - b.processor.priority);
        for (const { processor, sheet, args, name } of arr) {
            using _ = doing(`Applying processor '${name}' in '${file}#${sheet.name}'`);
            processor.exec(workbook, sheet, ...args);
        }
    }
};

export const parse = (files: string[], headerOnly: boolean = false) => {
    for (const file of files) {
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
    if (!headerOnly) {
        parseBody();
        applyChecker();
        applyProcessor();
    }
};

export const copyOf = (workbook: Workbook, writer: string, headerOnly: boolean = false) => {
    const result: Workbook = { ...workbook, sheets: {} };

    const copy = <T extends TValue>(value: T): T => {
        if (value && typeof value === "object") {
            if (value["!writer"] && !value["!writer"].includes(writer)) {
                return null as T;
            }
            const obj: TObject = (Array.isArray(value) ? [] : {}) as TObject;
            for (const k in value) {
                let v = (value as TObject)[k];
                if (!k.startsWith("!")) {
                    v = copy(v);
                }
                if (v !== null) {
                    obj[k] = v;
                }
            }
            return obj as T;
        } else {
            return value;
        }
    };

    for (const sheetName in workbook.sheets) {
        const sheet = workbook.sheets[sheetName];
        const resultSheet: Sheet = { ...sheet, data: {} };
        result.sheets[sheetName] = resultSheet;
        if (!headerOnly) {
            resultSheet.data = copy(sheet.data);
            if (sheet.data["!type"] === Type.Sheet) {
                for (const k of filterKeys(sheet.data)) {
                    const row = checkType<TRow>(sheet.data[k], Type.Row);
                    for (const k in row) {
                        if (!k.startsWith("!") && typeof row[k] === "object") {
                            row[k]["!row"] = row;
                        }
                    }
                }
            }
        }
        resultSheet.fields = sheet.fields.filter((f) => f.writers.includes(writer));
    }
    return result;
};

/**
 * Get a workbook by path.
 * @param path - The path of the workbook.
 * @returns The workbook.
 * @throws An error if the workbook is not found.
 */
export const get = (path: string) => {
    for (const file in files) {
        if (file.endsWith(path)) {
            return files[file];
        }
    }
    throw new Error(`File not found: ${path}`);
};

export const getRows = <T = TRow>(path: string, sheet: string) => {
    const workbook = get(path);
    const sheetData = workbook.sheets[sheet]?.data;
    if (!sheetData) {
        throw new Error(`Sheet not found: ${path}#${sheet}`);
    }
    return filterValues<TObject>(sheetData).map((v) => checkType<T>(v, Type.Row));
};

export const getColumn = (path: string, sheet: string, field: string) => {
    return getRows(path, sheet).map((row) => {
        const cell = row[field];
        return isNullOrUndefined(cell) ? null : checkType<TCell>(cell, Type.Cell);
    });
};

export type ColumnIndexer<T> = {
    has: (value: unknown) => boolean;
    get: (value: unknown) => T | null;
};

export const createColumnIndexer = <T = TRow>(
    path: string,
    sheetName: string,
    field: string,
    filter?: (row: T) => boolean
): ColumnIndexer<T> => {
    let workbook: Workbook | null = null;
    const cache: Map<unknown, TCell | null> = new Map();

    path = path.replace(/\.xlsx$/, "") + ".xlsx";

    const hasValue = (value: unknown): boolean => {
        if (cache.has(value)) {
            return !!cache.get(value);
        }
        workbook ??= get(path);
        for (const sheet of Object.values(workbook.sheets)) {
            if (sheet.name === sheetName || sheetName === "*") {
                getColumn(path, sheet.name, field).forEach((cell) => {
                    if (cell && (!filter || filter(cell["!row"] as T))) {
                        cache.set(cell.v, isNullOrUndefined(cell) ? null : cell);
                    }
                });
                if (cache.has(value)) {
                    return !!cache.get(value);
                }
            }
        }
        cache.set(value, null);
        return false;
    };

    const getRow = (value: unknown) => {
        if (hasValue(value)) {
            return cache.get(value)?.["!row"] as T | null;
        }
        return null;
    };

    return {
        has: hasValue,
        get: getRow,
    };
};

export interface RowIndexer<T> {
    has: (value: string | number) => boolean;
    get: (value: string | number) => T | null;
}

export const createRowIndexer = <T = TObject>(
    path: string,
    sheetName: string,
    filter?: (row: T) => boolean
): RowIndexer<T> => {
    let workbook: Workbook | null = null;
    const cache: Map<unknown, T | null> = new Map();

    path = path.replace(/\.xlsx$/, "") + ".xlsx";

    const hasValue = (value: string | number): boolean => {
        if (cache.has(value)) {
            return !!cache.get(value);
        }
        workbook ??= get(path);
        for (const sheet of Object.values(workbook.sheets)) {
            if (sheet.name === sheetName || sheetName === "*") {
                for (const row of filterValues<TRow>(sheet.data)) {
                    if (!filter || filter(row as T)) {
                        assert(!!row["!key"], "key not found");
                        cache.set(row["!key"]?.v, row as T);
                    }
                }
                if (cache.has(value)) {
                    return !!cache.get(value);
                }
            }
        }
        cache.set(value, null);
        return false;
    };

    const getRow = (value: string | number) => {
        if (hasValue(value)) {
            return cache.get(value) as T;
        }
        return null;
    };

    return {
        has: hasValue,
        get: getRow,
    };
};

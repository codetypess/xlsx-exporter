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
    /** writer */
    ["!writer"]?: string[];
    /** field */
    ["!field"]?: Field;
    /** row data */
    ["!row"]?: TRow;
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

export type Convertor = (str: string) => TValue;
export type RealType = "int" | "float" | "string" | "bool" | null;
type ConvertorType = { realtype?: RealType; exec: Convertor };

export type Checker = (cell: TCell, row: TObject, field: Field, errors: string[]) => boolean;
export type CheckerParser = (...args: string[]) => Checker;
type CheckerType = {
    name: string;
    force: boolean;
    def: string;
    args: string[];
    refer: string;
    exec: Checker;
};

export type Processor = (workbook: Workbook, sheet: Sheet, ...args: string[]) => void;
type ProcessorType = {
    name: string;
    option: ProcessorOption;
    exec: Processor;
};
type ProcessorOption = {
    required: boolean;
    priority: number;
    stage: "after-read" | "pre-parse" | "after-parse" | "pre-check" | "after-check" | "default";
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

export const toRef = (col: number, row: number) => {
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
 * @param option - The options of the processor.
 */
export const registerProcessor = (
    name: string,
    processor: Processor,
    option?: Partial<ProcessorOption>
) => {
    assert(!processors[name], `Processor '${name}' already registered`);
    processors[name] = {
        name,
        option: {
            required: option?.required ?? false,
            stage: option?.stage ?? "default",
            priority: option?.priority ?? 0,
        },
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
        const v = convertor.exec(cell) ?? null;
        if (v === null) {
            error(`Convert value error: '${cell}' => type '${typename}'`);
        }
        return v;
    } else {
        if (typename.endsWith("?") && (cell.v === "" || cell.v === null)) {
            cell.s = "null";
            cell.v = null;
        } else {
            if (cell.t?.replace("?", "") === typename.replace("?", "")) {
                return cell;
            }

            const v = cell.v;
            if (typeof v === "object") {
                error(`cell value is an object: ${JSON.stringify(v)}`);
            }

            cell.s = toString(cell);
            cell.t = typename;
            try {
                cell.v = convertor.exec(cell.s) ?? null;
            } catch (e) {
                console.error(e);
                cell.v = null;
            }
            if (cell.v === null) {
                error(`Convert value error at ${cell.r}: '${v}' => type '${typename}'`);
            }
        }
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

const parseChecker = (path: string, refer: string, index: number, str: string) => {
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
                    def: s,
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
                    def: s,
                    refer,
                    args: [s],
                    exec: null!,
                };
            } else if (s.endsWith("#")) {
                /**
                 * file#
                 * #
                 */
                const [, file = ""] = s.match(/^([^#]*)#$/) ?? [];
                checker = {
                    name: SHEET_CHECKER,
                    force,
                    def: s,
                    refer,
                    args: [makeFilePath(file || path)],
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
                    file = "",
                    sheet = "",
                    colKey = "",
                    colFilter = "",
                ] = s.match(/^(?:\$([^&]*)?(?:&(.+))?==)?([^#=]*)#([^.]+)\.(\w+)(?:&(.+))?$/) ?? [];
                if (!sheet || !colKey) {
                    error(`Invalid index checker at ${refer}: '${s}'`);
                }
                checker = {
                    name: INDEX_CHECKER,
                    force,
                    def: s,
                    refer,
                    args: [makeFilePath(file || path), sheet, rowKey, rowFilter, colKey, colFilter],
                    exec: null!,
                };
            } else if (s !== "x") {
                /**
                 * value >= 0 && value <= 100
                 */
                checker = {
                    name: EXPR_CHECKER,
                    force,
                    def: s,
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
                if (parsed[name]) {
                    error(`Duplicate field name: '${name}' at ${toRef(c, r)}`);
                }
                parsed[name] = `${sheetName}#${toRef(c, r)}`;
                sheet.fields.push({
                    path,
                    sheet: sheetName,
                    index: c,
                    name,
                    typename,
                    writers: c > 0 && arr.length ? arr : writerKeys.slice(),
                    checker: parseChecker(path, parsed[name], c, checker),
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
            for (const field of sheet.fields) {
                const cell: TCell = readCell(sheetData, r, field.index);
                if (field.index === 0 && cell.v === "") {
                    break loop;
                }
                if (field.typename === "auto") {
                    cell.v = r - start + 1;
                }
                cell["!field"] = field;
                cell["!row"] = row as TRow;
                cell["!writer"] = field.writers;
                row[field.name] = cell;
                if (field.index === 0) {
                    sheet.data[cell.v as string] = row;
                }
            }
        }
    }
};

const resolveChecker = () => {
    for (const file in files) {
        const workbook = files[file];
        for (const sheetName in workbook.sheets) {
            const sheet = workbook.sheets[sheetName];
            using _ = doing(`Resolving checker in '${file}#${sheetName}'`);
            for (const field of sheet.fields) {
                for (const checker of field.checker) {
                    const parser = checkerParsers[checker.name];
                    if (!parser) {
                        error(`Checker parser not found at ${checker.refer}: '${checker.name}'`);
                    }
                    checker.exec = parser(...checker.args);
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
            const remap = !["string", "int", "auto"].includes(sheet.fields[0].typename);
            for (const key of keys(sheet.data)) {
                const row = sheet.data[key] as TRow;
                for (const field of sheet.fields) {
                    const cell = row[field.name];
                    checkType(cell, Type.Cell);
                    convertValue(cell, field.typename);
                }
                if (remap) {
                    delete sheet.data[key];
                    const newKey = row[sheet.fields[0].name].v as string;
                    sheet.data[newKey] = row;
                }
            }
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
                    `  checker: ${checker.def}\n` +
                    `   values:\n` +
                    `      ${errorValues.join("\n      ")}\n`
            );
        }
    }
};

const applyChecker = () => {
    console.log("applying checker");
    const errors: string[] = [];
    for (const file in files) {
        const workbook = files[file];
        for (const sheetName in workbook.sheets) {
            const sheet = workbook.sheets[sheetName];
            for (const field of sheet.fields) {
                const msg = `'${field.name}' at ${field.refer} in '${file}#${sheetName}'`;
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
};

const applyProcessor = (stage: ProcessorOption["stage"]) => {
    type ProcessorEntry = {
        processor: ProcessorType;
        sheet: Sheet;
        args: string[];
        name: string;
    };
    console.log(`applying processor: stage=${stage}`);
    for (const file in files) {
        const workbook = files[file];
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
            using _ = doing(`Applying processor '${name}' in '${file}#${sheet.name}'`);
            try {
                processor.exec(workbook, sheet, ...args);
            } catch (e) {
                error((e as Error).stack ?? String(e));
            }
        }
    }
};

export const parse = (fs: string[], headerOnly: boolean = false) => {
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
    applyProcessor("after-read");
    if (!headerOnly) {
        applyProcessor("pre-parse");
        resolveChecker();
        parseBody();
        applyProcessor("after-parse");
        applyProcessor("pre-check");
        applyChecker();
        applyProcessor("after-check");
        applyProcessor("default");
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
                for (const key of keys(sheet.data)) {
                    const row = checkType<TRow>(sheet.data[key], Type.Row);
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
    const found = Object.keys(files).filter((file) => file.endsWith(path));
    if (found.length === 0) {
        error(`File not found: ${path}`);
    } else if (found.length > 1) {
        error(`Multiple files found: ${path}`);
    }
    return files[found[0]];
};

export const getRows = <T = TRow>(path: string, sheet: string) => {
    const workbook = get(path);
    const sheetData = workbook.sheets[sheet]?.data;
    if (!sheetData) {
        throw new Error(`Sheet not found: ${path}#${sheet}`);
    }
    return values<TObject>(sheetData).map((v) => checkType<T>(v, Type.Row));
};

export const getColumn = (path: string, sheet: string, field: string) => {
    return getRows(path, sheet).map((row) => checkType<TCell>(row[field], Type.Cell));
};

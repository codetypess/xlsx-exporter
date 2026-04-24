import { basename } from "path";
import {
    getTypedefOwner,
    hasTypedefChecker,
    resolveTypedefObjectByTypename,
    splitTypename,
    type TypedefField,
} from "../typedef";
import { values } from "../util";
import type { CheckerType } from "./contracts";
import { BuiltinChecker, type CheckerContext } from "./contracts";
import { assert, error, trace } from "./errors";
import { parseChecker } from "./parser";
import {
    checkerParsers,
    type ProcessorOption,
    processors,
    type ProcessorType,
    settings,
    writers,
} from "./registry";
import { type Field, type Sheet, type TCell, type TObject, type TRow, Type } from "./schema";
import { checkType, copyTag } from "./value";
import {
    addContext,
    clearRunningContext,
    Context,
    getContexts,
    setRunningContext,
    Workbook,
} from "./workbook";

const MAX_ERRORS = 50;
const typedefCheckerCache = new WeakMap<Context, Map<string, CheckerType[]>>();

type CheckerOrigin = {
    readonly typedef?: string;
    readonly definedAt?: string;
};

const removeLastArraySuffix = (typename: string) => {
    const optional = typename.endsWith("?");
    const clean = optional ? typename.slice(0, -1) : typename;
    return clean.replace(/\[\d*\]$/, "") + (optional ? "?" : "");
};

const stringifyCellValue = (value: unknown) => {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const makeSyntheticCell = (value: unknown, typename: string, location: string): TCell => {
    return {
        "!type": Type.Cell,
        v: (value ?? null) as TCell["v"],
        t: typename,
        r: location,
        s: stringifyCellValue(value),
    };
};

const makeSyntheticField = (
    name: string,
    typename: string,
    location: string,
    checkers: CheckerType[]
): Field => {
    return {
        index: 0,
        name,
        typename,
        writers: [],
        checkers,
        comment: "",
        location,
        ignore: false,
    };
};

const getTypedefFieldCheckers = (
    ctx: Context,
    ownerPath: string,
    ownerSheet: string,
    field: TypedefField,
    index: number
) => {
    if (!field.checkerSource) {
        return [];
    }
    let cache = typedefCheckerCache.get(ctx);
    if (!cache) {
        cache = new Map<string, CheckerType[]>();
        typedefCheckerCache.set(ctx, cache);
    }
    const cacheKey = [
        ownerPath,
        ownerSheet,
        field.name,
        field.checkerLocation ?? "",
        field.checkerSource,
        index,
    ].join("\n");
    let parsed = cache.get(cacheKey);
    if (!parsed) {
        parsed = parseChecker(
            basename(ownerPath),
            ownerSheet,
            field.checkerLocation ?? field.name,
            index,
            field.checkerSource
        );
        for (const checker of parsed) {
            resolveCheckerNode(ctx, checker);
        }
        cache.set(cacheKey, parsed);
    }
    return parsed;
};

const resolveCheckerNode = (ctx: Context, checker: CheckerType) => {
    const parser = checkerParsers[checker.name];
    if (!parser) {
        error(`Checker parser not found at ${checker.location}: '${checker.name}'`);
    }
    using _ = trace(`Parsing checker at ${checker.location}: ${checker.source}`);
    assert(!checker.exec, `Checker already parsed: ${checker.location}`);
    checker.exec = parser(ctx, ...checker.args);
    for (const child of checker.oneof) {
        resolveCheckerNode(ctx, child);
    }
    for (const refers of Object.values(checker.refers)) {
        for (const child of refers) {
            resolveCheckerNode(ctx, child);
        }
    }
};

export const resolveChecker = () => {
    const writerKeys = Object.keys(writers);
    for (const ctx of getContexts()) {
        if (!writerKeys.includes(ctx.writer)) {
            continue;
        }
        for (const workbook of ctx.workbooks) {
            for (const sheet of workbook.sheets) {
                using _ = trace(`Resolving checker in '${workbook.path}#${sheet.name}'`);
                for (const field of sheet.fields) {
                    for (const checker of field.checkers as CheckerType[]) {
                        resolveCheckerNode(ctx, checker);
                    }
                }
            }
        }
    }
};

export const copyWorkbook = () => {
    for (const ctx of getContexts().slice()) {
        for (const writer in writers) {
            if (settings.suppressWriters.has(writer)) {
                continue;
            }
            console.log(`creating context: writer=${writer} tag=${ctx.tag}`);
            const newCtx = addContext(new Context(writer, ctx.tag));
            for (const workbook of ctx.workbooks) {
                for (const sheet of workbook.sheets) {
                    using _ = trace(`Checking sheet '${sheet.name}' in '${workbook.path}'`);
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

const invokeCheckerNode = (ctx: CheckerContext, checker: CheckerType, forced: boolean = false) => {
    if (ctx.cell.v === null && !(forced || checker.force)) {
        return true;
    }
    if (checker.name !== BuiltinChecker.OneOf) {
        return checker.exec(ctx);
    }
    if (checker.oneof.length === 0) {
        ctx.errors.push("oneof requires at least one checker");
        return false;
    }

    const errors = ctx.errors;
    const branchErrors: string[] = [];
    for (const child of checker.oneof) {
        ctx.errors = [];
        if (invokeCheckerNode(ctx, child, forced || checker.force)) {
            ctx.errors = errors;
            return true;
        }
        if (ctx.errors.length === 0) {
            branchErrors.push(`oneof branch failed: ${child.source}`);
        } else {
            branchErrors.push(`oneof branch failed: ${child.source}`);
            for (const err of ctx.errors) {
                branchErrors.push(`  ${err}`);
            }
        }
    }
    ctx.errors = errors;
    ctx.errors.push(...branchErrors);
    return false;
};

const pushCheckerErrors = (
    errors: string[],
    workbook: Workbook,
    sheet: Sheet,
    fieldName: string,
    checker: CheckerType,
    errorValues: string[],
    origin?: CheckerOrigin
) => {
    if (errorValues.length === 0) {
        return;
    }
    if (errorValues.length > MAX_ERRORS) {
        errorValues.length = MAX_ERRORS;
        errorValues.push("...");
    }
    errors.push(
        `builtin check:\n` +
            `     path: ${workbook.path}\n` +
            `    sheet: ${sheet.name}\n` +
            `    field: ${fieldName}\n` +
            `  checker: ${checker.source}\n` +
            (origin?.typedef ? `  typedef: ${origin.typedef}\n` : "") +
            (origin?.definedAt ? `  defined: ${origin.definedAt}\n` : "") +
            `   values:\n` +
            `      ${errorValues.join("\n      ")}\n`
    );
};

const invokeReferChecker = (
    ctx: CheckerContext,
    cell: TCell,
    checkers: CheckerType[],
    errors: string[],
    origin?: CheckerOrigin
) => {
    for (const checker of checkers) {
        const errorValues: string[] = [];
        if (!invokeCheckerNode(ctx, checker)) {
            errorValues.push(`${cell.r}: ${cell.s}`);
            if (ctx.errors.length > 0) {
                for (const str of ctx.errors) {
                    errorValues.push("    ❌ " + str);
                }
                ctx.errors.length = 0;
            }
        }
        pushCheckerErrors(
            errors,
            ctx.workbook,
            ctx.sheet,
            ctx.field.name,
            checker,
            errorValues,
            origin
        );
    }
};

const invokeSyntheticCheckerSet = (
    workbook: Workbook,
    sheet: Sheet,
    row: TRow,
    cell: TCell,
    fieldName: string,
    displayFieldName: string,
    typename: string,
    checkers: CheckerType[],
    errors: string[],
    origin?: CheckerOrigin
) => {
    const ctx: CheckerContext = {
        workbook,
        sheet,
        field: makeSyntheticField(fieldName, typename, cell.r, checkers),
        row,
        cell,
        errors: [],
    };
    for (const checker of checkers) {
        const errorValues: string[] = [];
        if (!invokeCheckerNode(ctx, checker)) {
            errorValues.push(`${cell.r}: ${cell.s}`);
            if (ctx.errors.length > 0) {
                for (const str of ctx.errors) {
                    errorValues.push("    ❌ " + str);
                }
                ctx.errors.length = 0;
            }
        }
        if (checker.name === BuiltinChecker.Refer) {
            const refers = checker.refers[cell.r];
            if (refers) {
                invokeReferChecker(ctx, cell, refers, errors, origin);
            }
        }
        pushCheckerErrors(errors, workbook, sheet, displayFieldName, checker, errorValues, origin);
    }
};

const invokeTypedefChecker = (
    workbook: Workbook,
    sheet: Sheet,
    row: TRow,
    typename: string,
    value: unknown,
    fieldName: string,
    location: string,
    errors: string[]
) => {
    if (value === null || value === undefined) {
        return;
    }
    const meta = splitTypename(typename);
    if (meta.array) {
        assert(Array.isArray(value), `Typedef field '${fieldName}' expects an array`);
        const childTypename = removeLastArraySuffix(typename);
        value.forEach((item, index) => {
            invokeTypedefChecker(
                workbook,
                sheet,
                row,
                childTypename,
                item,
                `${fieldName}[${index}]`,
                `${location}[${index}]`,
                errors
            );
        });
        return;
    }
    const objectType = resolveTypedefObjectByTypename(typename, value);
    if (!objectType) {
        return;
    }
    const owner = getTypedefOwner(objectType.name);
    assert(!!owner, `Typedef owner not found: '${objectType.name}'`);
    assert(
        typeof value === "object" && !Array.isArray(value),
        `Typedef field '${fieldName}' expects an object`
    );
    const source = value as Record<string, unknown>;
    const nestedRow: TRow = {
        "!type": Type.Row,
        ...row,
    } as TRow;
    for (const child of objectType.fields) {
        nestedRow[child.name] = makeSyntheticCell(
            source[child.name],
            child.type,
            `${location}.${child.name}`
        );
    }
    for (const [index, child] of objectType.fields.entries()) {
        const childCell = checkType<TCell>(nestedRow[child.name], Type.Cell);
        const displayFieldName = `${fieldName}.${child.name}`;
        const originType =
            meta.base && meta.base !== objectType.name
                ? `${meta.base} -> ${objectType.name}.${child.name}`
                : `${objectType.name}.${child.name}`;
        const originLocation = child.checkerLocation
            ? `${owner.path}#${owner.sheet} ${child.checkerLocation}`
            : `${owner.path}#${owner.sheet}`;
        const origin: CheckerOrigin = {
            typedef: originType,
            definedAt: child.checkerSource ? originLocation : undefined,
        };
        const checkers = getTypedefFieldCheckers(
            workbook.context,
            owner.path,
            owner.sheet,
            child,
            index
        ).filter((checker) => !settings.suppressCheckers.has(checker.name));
        if (checkers.length > 0) {
            invokeSyntheticCheckerSet(
                workbook,
                sheet,
                nestedRow,
                childCell,
                child.name,
                displayFieldName,
                child.type,
                checkers,
                errors,
                origin
            );
        }
        invokeTypedefChecker(
            workbook,
            sheet,
            nestedRow,
            child.type,
            childCell.v,
            displayFieldName,
            childCell.r,
            errors
        );
    }
};

const invokeChecker = (workbook: Workbook, sheet: Sheet, field: Field, errors: string[]) => {
    const checkers = (field.checkers as CheckerType[]).filter(
        (c) => !settings.suppressCheckers.has(c.name)
    );
    const ctx: CheckerContext = {
        workbook,
        sheet,
        field,
        errors: [],
        cell: null!,
        row: null!,
    };
    for (const checker of checkers) {
        const errorValues: string[] = [];
        for (const row of values<TRow>(sheet.data)) {
            const cell = row[field.name];
            checkType(cell, Type.Cell);
            ctx.cell = cell;
            ctx.row = row;
            if (!invokeCheckerNode(ctx, checker)) {
                errorValues.push(`${cell.r}: ${cell.s}`);
                if (ctx.errors.length > 0) {
                    for (const str of ctx.errors) {
                        errorValues.push("    ❌ " + str);
                    }
                    ctx.errors.length = 0;
                }
            }
            if (checker.name === BuiltinChecker.Refer) {
                const refers = checker.refers[cell.r];
                if (refers) {
                    invokeReferChecker(ctx, cell, refers, errors);
                }
            }
        }
        pushCheckerErrors(errors, workbook, sheet, field.name, checker, errorValues);
    }
    const shouldSearchTypedefChecker =
        field.typename.startsWith("@") || hasTypedefChecker(field.realtype ?? field.typename);
    if (!shouldSearchTypedefChecker) {
        return;
    }
    for (const row of values<TRow>(sheet.data)) {
        const cell = row[field.name];
        checkType(cell, Type.Cell);
        if (!cell.t) {
            continue;
        }
        invokeTypedefChecker(workbook, sheet, row, cell.t, cell.v, field.name, cell.r, errors);
    }
};

export const performChecker = () => {
    const writerKeys = Object.keys(writers);
    for (const ctx of getContexts()) {
        if (!writerKeys.includes(ctx.writer)) {
            continue;
        }
        console.log(`performing checker: writer=${ctx.writer} tag=${ctx.tag}`);
        const errors: string[] = [];
        for (const workbook of ctx.workbooks) {
            for (const sheet of workbook.sheets) {
                for (const field of sheet.fields) {
                    const msg = `'${field.name}' at ${field.location} in '${workbook.path}#${sheet.name}'`;
                    using _ = trace(`Checking ${msg}`);
                    try {
                        invokeChecker(workbook, sheet, field, errors);
                    } catch (e) {
                        error((e as Error).stack ?? String(e));
                    }
                }
            }
        }
        if (errors.length > 0) {
            throw new Error(`tag: ${ctx.tag} writer: ${ctx.writer}\n` + errors.join("\n"));
        }
    }
};

export const performProcessor = async (stage: ProcessorOption["stage"], writer?: string) => {
    type ProcessorEntry = {
        processor: ProcessorType;
        sheet: Sheet;
        args: string[];
        name: string;
    };
    const writerKeys = writer ? [writer] : Object.keys(writers);
    for (const ctx of getContexts().slice()) {
        if (!writerKeys.includes(ctx.writer)) {
            continue;
        }
        setRunningContext(ctx);
        console.log(`performing processor: stage=${stage} writer=${ctx.writer} tag=${ctx.tag}`);
        for (const workbook of ctx.workbooks) {
            const arr: ProcessorEntry[] = [];
            for (const sheet of workbook.sheets) {
                for (const { name, args } of sheet.processors) {
                    const processor = processors[name];
                    if (processor.option.stage !== stage || settings.suppressProcessors.has(name)) {
                        continue;
                    }
                    arr.push({
                        processor,
                        sheet,
                        args,
                        name,
                    });
                }
            }
            arr.sort((a, b) => a.processor.option.priority - b.processor.option.priority);
            for (const { processor, sheet, args, name } of arr) {
                using _ = trace(
                    `Performing processor '${name}' in '${workbook.path}#${sheet.name}'`
                );
                try {
                    await processor.exec(workbook, sheet, ...args);
                } catch (e) {
                    error((e as Error).stack ?? String(e));
                }
            }
        }
        clearRunningContext();
    }
};

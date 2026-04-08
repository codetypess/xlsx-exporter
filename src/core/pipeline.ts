import { values } from "../util.js";
import { addContext, clearRunningContext, getContexts, setRunningContext } from "./context.js";
import type { CheckerType } from "./contracts.js";
import { BuiltinChecker, type CheckerContext } from "./contracts.js";
import { assert, doing, error } from "./errors.js";
import {
    checkerParsers,
    options,
    type ProcessorOption,
    processors,
    type ProcessorType,
    writers,
} from "./registry.js";
import { type Field, type Sheet, type TCell, type TObject, type TRow, Type } from "./schema.js";
import { checkType, copyTag } from "./value.js";
import { Context, Workbook } from "./workbook.js";

const MAX_ERRORS = 50;

export const resolveChecker = () => {
    const writerKeys = Object.keys(writers);
    for (const ctx of getContexts()) {
        if (!writerKeys.includes(ctx.writer)) {
            continue;
        }
        for (const workbook of ctx.workbooks) {
            for (const sheet of workbook.sheets) {
                using _ = doing(`Resolving checker in '${workbook.path}#${sheet.name}'`);
                for (const field of sheet.fields) {
                    const checkers = (field.checkers as CheckerType[]).slice();
                    (field.checkers as CheckerType[]).forEach((v) => {
                        if (v.name === BuiltinChecker.Refer) {
                            checkers.push(...Object.values(v.refers).flat());
                        }
                    });
                    for (const checker of checkers) {
                        const parser = checkerParsers[checker.name];
                        if (!parser) {
                            error(
                                `Checker parser not found at ${checker.location}: '${checker.name}'`
                            );
                        }
                        using __ = doing(
                            `Parsing checker at ${checker.location}: ${checker.source}`
                        );
                        assert(!checker.exec, `Checker already parsed: ${checker.location}`);
                        checker.exec = parser(ctx, ...checker.args);
                    }
                }
            }
        }
    }
};

export const copyWorkbook = () => {
    for (const ctx of getContexts().slice()) {
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

const invokeReferChecker = (
    ctx: CheckerContext,
    cell: TCell,
    checkers: CheckerType[],
    errors: string[]
) => {
    for (const checker of checkers) {
        const errorValues: string[] = [];
        if ((cell.v !== null || checker.force) && !checker.exec(ctx)) {
            errorValues.push(`${cell.r}: ${cell.s}`);
            if (ctx.errors.length > 0) {
                for (const str of ctx.errors) {
                    errorValues.push("    ❌ " + str);
                }
                ctx.errors.length = 0;
            }
        }
        if (errorValues.length > 0) {
            if (errorValues.length > MAX_ERRORS) {
                errorValues.length = MAX_ERRORS;
                errorValues.push("...");
            }
            errors.push(
                `builtin check:\n` +
                    `     path: ${ctx.workbook.path}\n` +
                    `    sheet: ${ctx.sheet.name}\n` +
                    `    field: ${ctx.field.name}\n` +
                    `  checker: ${checker.source}\n` +
                    `   values:\n` +
                    `      ${errorValues.join("\n      ")}\n`
            );
        }
    }
};

const invokeChecker = (workbook: Workbook, sheet: Sheet, field: Field, errors: string[]) => {
    const checkers = (field.checkers as CheckerType[]).filter(
        (c) => !options.suppressCheckers.includes(c.name)
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
            if ((cell.v !== null || checker.force) && !checker.exec(ctx)) {
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
        if (errorValues.length > 0) {
            if (errorValues.length > MAX_ERRORS) {
                errorValues.length = MAX_ERRORS;
                errorValues.push("...");
            }
            errors.push(
                `builtin check:\n` +
                    `     path: ${workbook.path}\n` +
                    `    sheet: ${sheet.name}\n` +
                    `    field: ${field.name}\n` +
                    `  checker: ${checker.source}\n` +
                    `   values:\n` +
                    `      ${errorValues.join("\n      ")}\n`
            );
        }
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
                    using _ = doing(`Checking ${msg}`);
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
                    if (
                        processor.option.stage !== stage ||
                        options.suppressProcessors.includes(name)
                    ) {
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
        clearRunningContext();
    }
};

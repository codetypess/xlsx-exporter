import type { Field, Sheet, TArray, TCell, TObject, TRow, TValue } from "./schema.js";
import type { Context, Workbook } from "./workbook.js";

export type CheckerType = {
    readonly name: string;
    readonly force: boolean;
    readonly source: string;
    readonly args: string[];
    readonly location: string;
    readonly refers: Record<string, CheckerType[]>;
    exec: Checker;
};

export type CheckerContext = {
    workbook: Workbook;
    sheet: Sheet;
    cell: TCell;
    row: TRow;
    field: Field;
    errors: string[];
};

export const enum BuiltinChecker {
    Refer = "refer",
    Size = "size",
    Follow = "follow",
    Unique = "unique",
    Range = "xlsx.checker.range",
    Index = "xlsx.checker.index",
    Expr = "xlsx.checker.expr",
    Sheet = "xlsx.checker.sheet",
}

export type Convertor = (str: string) => TValue;
export type Checker = (ctx: CheckerContext) => boolean;
export type CheckerParser = (ctx: Context, ...args: string[]) => Checker;
export type Processor = (workbook: Workbook, sheet: Sheet, ...args: string[]) => Promise<void>;
export type Writer = (workbook: Workbook, processor: string, data: TObject | TArray) => void;

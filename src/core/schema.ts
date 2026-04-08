import type { StringifyContext } from "../stringify.js";
import type { CheckerType } from "./contracts.js";

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
    readonly typename: string;
    readonly writers: string[];
    readonly checkers: CheckerType[];
    readonly comment: string;
    readonly location: string;
    realtype?: string;
    ignore: boolean;
};

export type Sheet = {
    readonly name: string;
    readonly processors: { name: string; args: string[] }[];
    readonly fields: Field[];
    ignore: boolean;
    data: TObject;
};

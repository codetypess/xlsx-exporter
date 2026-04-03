// AUTO GENERATED, DO NOT MODIFY!

import {
    ColumnIndexer,
    Context,
    RowIndexer,
} from "../../index.js";
import {
    ItemDefineRow,
    ItemFollowRow,
    ItemItemRow,
    ItemMapArrRow,
    ItemMapFieldRow,
    ItemMapObjRow,
    ItemMapRow,
    TaskBranchRow,
    TaskConfRow,
    TaskDefineRow,
    TaskEventsRow,
    TaskExchangeRow,
    TaskMainRow,
    TaskWeeklyRow,
    TypedefMainRow,
    TypedefTypedefRow,
} from "./workbook-typedef.js";

type Filter<T> = (row: T) => boolean;

const cacheRowIndexers = new Map<string, RowIndexer<unknown>>();
const cacheColumnIndexers = new Map<string, ColumnIndexer<unknown>>();

const createRowIndexer = <T>(
    ctx: Context,
    path: string,
    sheet: string,
    filter?: Filter<unknown>
) => {
    if (filter) {
        return new RowIndexer(ctx, path, sheet, filter);
    } else {
        const key = `${ctx.writer}:${ctx.tag}:${path}:${sheet}`;
        let indexer = cacheRowIndexers.get(key);
        if (!indexer) {
            indexer = new RowIndexer(ctx, path, sheet);
            cacheRowIndexers.set(key, indexer as RowIndexer<unknown>);
        }
        return indexer as RowIndexer<T>;
    }
};

const createColumnIndexer = <T>(
    ctx: Context,
    path: string,
    sheet: string,
    field: string,
    filter?: Filter<unknown>
) => {
    if (filter) {
        return new ColumnIndexer(ctx, path, sheet, field, filter);
    } else {
        const key = `${ctx.writer}:${ctx.tag}:${path}:${sheet}:${field}`;
        let indexer = cacheColumnIndexers.get(key);
        if (!indexer) {
            indexer = new ColumnIndexer(ctx, path, sheet, field);
            cacheColumnIndexers.set(key, indexer as ColumnIndexer<unknown>);
        }
        return indexer as ColumnIndexer<T>;
    }
};

// file: test/res/item.xlsx
export class ItemIndexer {
    static getRowIndexer(ctx: Context, sheet: "define", filter?: Filter<ItemDefineRow>): RowIndexer<ItemDefineRow>;
    static getRowIndexer(ctx: Context, sheet: "follow", filter?: Filter<ItemFollowRow>): RowIndexer<ItemFollowRow>;
    static getRowIndexer(ctx: Context, sheet: "item", filter?: Filter<ItemItemRow>): RowIndexer<ItemItemRow>;
    static getRowIndexer(ctx: Context, sheet: "map", filter?: Filter<ItemMapRow>): RowIndexer<ItemMapRow>;
    static getRowIndexer(ctx: Context, sheet: "map_arr", filter?: Filter<ItemMapArrRow>): RowIndexer<ItemMapArrRow>;
    static getRowIndexer(ctx: Context, sheet: "map_field", filter?: Filter<ItemMapFieldRow>): RowIndexer<ItemMapFieldRow>;
    static getRowIndexer(ctx: Context, sheet: "map_obj", filter?: Filter<ItemMapObjRow>): RowIndexer<ItemMapObjRow>;
    static getRowIndexer(ctx: Context, sheet: "define" | "follow" | "item" | "map" | "map_arr" | "map_field" | "map_obj", filter?: Filter<ItemDefineRow> | Filter<ItemFollowRow> | Filter<ItemItemRow> | Filter<ItemMapRow> | Filter<ItemMapArrRow> | Filter<ItemMapFieldRow> | Filter<ItemMapObjRow>): unknown {
        return createRowIndexer(ctx, "item.xlsx", sheet, filter as Filter<unknown>);
    }
    
    static getColumnIndexer(ctx: Context, sheet: "define", field: keyof ItemDefineRow, filter?: Filter<ItemDefineRow>): ColumnIndexer<ItemDefineRow>;
    static getColumnIndexer(ctx: Context, sheet: "follow", field: keyof ItemFollowRow, filter?: Filter<ItemFollowRow>): ColumnIndexer<ItemFollowRow>;
    static getColumnIndexer(ctx: Context, sheet: "item", field: keyof ItemItemRow, filter?: Filter<ItemItemRow>): ColumnIndexer<ItemItemRow>;
    static getColumnIndexer(ctx: Context, sheet: "map", field: keyof ItemMapRow, filter?: Filter<ItemMapRow>): ColumnIndexer<ItemMapRow>;
    static getColumnIndexer(ctx: Context, sheet: "map_arr", field: keyof ItemMapArrRow, filter?: Filter<ItemMapArrRow>): ColumnIndexer<ItemMapArrRow>;
    static getColumnIndexer(ctx: Context, sheet: "map_field", field: keyof ItemMapFieldRow, filter?: Filter<ItemMapFieldRow>): ColumnIndexer<ItemMapFieldRow>;
    static getColumnIndexer(ctx: Context, sheet: "map_obj", field: keyof ItemMapObjRow, filter?: Filter<ItemMapObjRow>): ColumnIndexer<ItemMapObjRow>;
    static getColumnIndexer(ctx: Context, sheet: "define" | "follow" | "item" | "map" | "map_arr" | "map_field" | "map_obj", field: string, filter?: Filter<ItemDefineRow> | Filter<ItemFollowRow> | Filter<ItemItemRow> | Filter<ItemMapRow> | Filter<ItemMapArrRow> | Filter<ItemMapFieldRow> | Filter<ItemMapObjRow>): unknown {
        return createColumnIndexer(ctx, "item.xlsx", sheet, field, filter as Filter<unknown>);
    }
    
}

// file: test/res/task.xlsx
export class TaskIndexer {
    static getRowIndexer(ctx: Context, sheet: "branch", filter?: Filter<TaskBranchRow>): RowIndexer<TaskBranchRow>;
    static getRowIndexer(ctx: Context, sheet: "conf", filter?: Filter<TaskConfRow>): RowIndexer<TaskConfRow>;
    static getRowIndexer(ctx: Context, sheet: "define", filter?: Filter<TaskDefineRow>): RowIndexer<TaskDefineRow>;
    static getRowIndexer(ctx: Context, sheet: "events", filter?: Filter<TaskEventsRow>): RowIndexer<TaskEventsRow>;
    static getRowIndexer(ctx: Context, sheet: "exchange", filter?: Filter<TaskExchangeRow>): RowIndexer<TaskExchangeRow>;
    static getRowIndexer(ctx: Context, sheet: "main", filter?: Filter<TaskMainRow>): RowIndexer<TaskMainRow>;
    static getRowIndexer(ctx: Context, sheet: "weekly", filter?: Filter<TaskWeeklyRow>): RowIndexer<TaskWeeklyRow>;
    static getRowIndexer(ctx: Context, sheet: "branch" | "conf" | "define" | "events" | "exchange" | "main" | "weekly", filter?: Filter<TaskBranchRow> | Filter<TaskConfRow> | Filter<TaskDefineRow> | Filter<TaskEventsRow> | Filter<TaskExchangeRow> | Filter<TaskMainRow> | Filter<TaskWeeklyRow>): unknown {
        return createRowIndexer(ctx, "task.xlsx", sheet, filter as Filter<unknown>);
    }
    
    static getColumnIndexer(ctx: Context, sheet: "branch", field: keyof TaskBranchRow, filter?: Filter<TaskBranchRow>): ColumnIndexer<TaskBranchRow>;
    static getColumnIndexer(ctx: Context, sheet: "conf", field: keyof TaskConfRow, filter?: Filter<TaskConfRow>): ColumnIndexer<TaskConfRow>;
    static getColumnIndexer(ctx: Context, sheet: "define", field: keyof TaskDefineRow, filter?: Filter<TaskDefineRow>): ColumnIndexer<TaskDefineRow>;
    static getColumnIndexer(ctx: Context, sheet: "events", field: keyof TaskEventsRow, filter?: Filter<TaskEventsRow>): ColumnIndexer<TaskEventsRow>;
    static getColumnIndexer(ctx: Context, sheet: "exchange", field: keyof TaskExchangeRow, filter?: Filter<TaskExchangeRow>): ColumnIndexer<TaskExchangeRow>;
    static getColumnIndexer(ctx: Context, sheet: "main", field: keyof TaskMainRow, filter?: Filter<TaskMainRow>): ColumnIndexer<TaskMainRow>;
    static getColumnIndexer(ctx: Context, sheet: "weekly", field: keyof TaskWeeklyRow, filter?: Filter<TaskWeeklyRow>): ColumnIndexer<TaskWeeklyRow>;
    static getColumnIndexer(ctx: Context, sheet: "branch" | "conf" | "define" | "events" | "exchange" | "main" | "weekly", field: string, filter?: Filter<TaskBranchRow> | Filter<TaskConfRow> | Filter<TaskDefineRow> | Filter<TaskEventsRow> | Filter<TaskExchangeRow> | Filter<TaskMainRow> | Filter<TaskWeeklyRow>): unknown {
        return createColumnIndexer(ctx, "task.xlsx", sheet, field, filter as Filter<unknown>);
    }
    
}

// file: test/res/typedef.xlsx
export class TypedefIndexer {
    static getRowIndexer(ctx: Context, sheet: "main", filter?: Filter<TypedefMainRow>): RowIndexer<TypedefMainRow>;
    static getRowIndexer(ctx: Context, sheet: "typedef", filter?: Filter<TypedefTypedefRow>): RowIndexer<TypedefTypedefRow>;
    static getRowIndexer(ctx: Context, sheet: "main" | "typedef", filter?: Filter<TypedefMainRow> | Filter<TypedefTypedefRow>): unknown {
        return createRowIndexer(ctx, "typedef.xlsx", sheet, filter as Filter<unknown>);
    }
    
    static getColumnIndexer(ctx: Context, sheet: "main", field: keyof TypedefMainRow, filter?: Filter<TypedefMainRow>): ColumnIndexer<TypedefMainRow>;
    static getColumnIndexer(ctx: Context, sheet: "typedef", field: keyof TypedefTypedefRow, filter?: Filter<TypedefTypedefRow>): ColumnIndexer<TypedefTypedefRow>;
    static getColumnIndexer(ctx: Context, sheet: "main" | "typedef", field: string, filter?: Filter<TypedefMainRow> | Filter<TypedefTypedefRow>): unknown {
        return createColumnIndexer(ctx, "typedef.xlsx", sheet, field, filter as Filter<unknown>);
    }
    
}



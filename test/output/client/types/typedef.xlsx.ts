// AUTO GENERATED DO NOT MODIFY!
// MERGED FROM build/client/types/typedef.xlsx.ts AND test/output/client/types/typedef.xlsx.ts

import {
    TaskArgs,
} from "../define/index";

export interface GeneratedTypedefCoinRow {
    /**
     * ### (location: A1) (checker: x)
     */
    readonly id: number;
    /**
     * 条件 (location: C1) (checker: x)
     */
    readonly condition: string;
}

export interface GeneratedTypedefMainRow {
    /**
     * ### (location: A1) (checker: x)
     */
    readonly id: number;
    /**
     * 条件 (location: C1) (checker: x)
     */
    readonly condition: string;
    /**
     * 参数 (location: D1) (checker: x)
     */
    readonly args: TaskArgs;
}

export interface GeneratedTypedefTable {
    main: Record<number | string, GeneratedTypedefMainRow>;
}

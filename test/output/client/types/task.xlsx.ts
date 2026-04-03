// AUTO GENERATED DO NOT MODIFY!
// MERGED FROM build/client/types/task.xlsx.ts AND test/output/client/types/task.xlsx.ts

import {
    Items,
    TaskType,
} from "../define/index.js";

export interface GeneratedTaskBranchRow {
    /**
     * ### (location: A1) (checker: x)
     */
    readonly id: number;
    /**
     * 任务组 (location: C1) (checker: x)
     */
    readonly group: number;
    /**
     * 显示排序 (location: D1) (checker: x)
     */
    readonly sort: number;
    /**
     * 任务类型 (location: E1) (checker: x)
     */
    readonly type: TaskType;
    /**
     * 名字 (location: F1) (checker: x)
     */
    readonly name: string;
    /**
     * 描述 (location: G1) (checker: x)
     */
    readonly desc: string;
    /**
     * 后置任务 (location: H1) (checker: #branch.id)
     */
    readonly next_task?: number;
    /**
     * 条件 (location: I1) (checker: x)
     */
    readonly condition: string;
    /**
     * 累计 (location: J1) (checker: x)
     */
    readonly total?: boolean;
    /**
     * 参数 (location: K1) (checker: x)
     */
    readonly args: Record<string, number | string>; // override
    /**
     * 奖励 (location: M1) (checker: $[*].id==item#item.id)
     */
    readonly reward: Items;
    /**
     * 任务icon (location: N1) (checker: x)
     */
    readonly icon: string;
    /**
     *  (location: O1) (checker: x)
     */
    readonly custom?: string;
    /**
     * 完成后自动提交 (location: P1) (checker: x)
     */
    readonly auto_submit?: number;
}

export interface GeneratedTaskEventsRow {
    /**
     * ### (location: A1) (checker: x)
     */
    readonly id: number;
    /**
     * 显示排序 (location: C1) (checker: x)
     */
    readonly sort: number;
    /**
     * 任务类型 (location: D1) (checker: x)
     */
    readonly type: number;
    /**
     * 描述 (location: E1) (checker: x)
     */
    readonly desc: string;
    /**
     * 奖励 (location: H1) (checker: $[*].id==item#item.id)
     */
    readonly reward: Items;
    /**
     * vip奖励 (location: I1) (checker: $[*].id==item#*.id)
     */
    readonly vip_reward: Items;
    /**
     * 任务icon (location: J1) (checker: x)
     */
    readonly icon: string;
}

export interface GeneratedTaskExchangeRow {
    /**
     * ### (location: A1) (checker: x)
     */
    readonly id: number;
    /**
     * 显示排序 (location: C1) (checker: x)
     */
    readonly sort: number;
    /**
     * 任务类型 (location: D1) (checker: x)
     */
    readonly type: number;
    /**
     * 描述 (location: E1) (checker: x)
     */
    readonly desc: string;
    /**
     * 后置任务 (location: F1) (checker: task#*.id)
     */
    readonly next_task?: number;
    /**
     * 累计 (location: H1) (checker: x)
     */
    readonly total?: boolean;
    /**
     * 参数 (location: I1) (checker: x)
     */
    readonly args: Record<string, number | string>; // override
    /**
     * 奖励 (location: J1) (checker: @ItemArrayChecker)
     */
    readonly reward: Items;
    /**
     * 任务icon (location: K1) (checker: x)
     */
    readonly icon: string;
    /**
     * 任务npc和对话 (location: L1) (checker: x)
     */
    readonly custom?: Record<string, number | string>; // override
}

export interface GeneratedTaskMainRow {
    /**
     * ### (location: A1) (checker: x)
     */
    readonly id: number;
    /**
     * 显示排序 (location: C1) (checker: $ > 0 && $ < 20)
     */
    readonly sort: number;
    /**
     * 任务类型 (location: D1) (checker: #define.value&key1=TASK_TYPE)
     */
    readonly type: TaskType;
    /**
     * 描述 (location: E1) (checker: x)
     */
    readonly desc: string;
    /**
     * 后置任务 (location: F1) (checker: task#*.id&type=MAIN)
     */
    readonly next_task?: number;
    /**
     * 支线任务 (location: G1) (checker: $[*]==#branch.id)
     */
    readonly branch_tasks?: readonly number[];
    /**
     * 条件 (location: H1) (checker: x)
     */
    readonly condition: string;
    /**
     * 累计 (location: I1) (checker: x)
     */
    readonly total?: boolean;
    /**
     * 参数 (location: J1) (checker: @TaskArgsChecker)
     */
    readonly args: Record<string, number | string>; // override
    /**
     * 奖励 (location: K1) (checker: @ItemArrayChecker)
     */
    readonly reward: Items;
    /**
     * 任务icon (location: L1) (checker: x)
     */
    readonly icon: string;
    /**
     *  (location: M1) (checker: x)
     */
    readonly custom?: Record<string, number | string>; // override
    /**
     * 完成后自动提交 (location: N1) (checker: [1])
     */
    readonly auto_submit?: number;
}

export interface GeneratedTaskWeeklyRow {
    /**
     * ### (location: A1) (checker: x)
     */
    readonly id: number;
    /**
     * 显示排序 (location: C1) (checker: x)
     */
    readonly sort: number;
    /**
     * 任务类型 (location: D1) (checker: x)
     */
    readonly type: number;
    /**
     * 描述 (location: E1) (checker: x)
     */
    readonly desc: string;
    /**
     * 奖励 (location: H1) (checker: @ItemArrayChecker)
     */
    readonly reward: Items;
    /**
     * 任务icon (location: I1) (checker: x)
     */
    readonly icon: string;
}

export interface GeneratedTaskTable {
    main: Record<number | string, GeneratedTaskMainRow>;
    branch: Record<number | string, GeneratedTaskBranchRow>;
    events: Record<number | string, GeneratedTaskEventsRow>;
    exchange: Record<number | string, GeneratedTaskExchangeRow>;
    weekly: Record<number | string, GeneratedTaskWeeklyRow>;
}

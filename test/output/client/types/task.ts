// AUTO GENERATED, DO NOT MODIFY!

// file: test/res/task.xlsx
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
    readonly type: number;
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
    readonly args: unknown;
    /**
     * 奖励 (location: M1) (checker: $[*].id==item#item.id)
     */
    readonly reward: unknown;
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

// file: test/res/task.xlsx
export interface GeneratedTaskConfRow {
    /**
     * ### (location: A2) (checker: x)
     */
    readonly id: number;
    /**
     * 键 (location: B2) (checker: x)
     */
    readonly key: string;
    /**
     * 值 (location: C2) (checker: x)
     */
    readonly value: string;
    /**
     * 值类型 (location: D2) (checker: x)
     */
    readonly value_type: string;
    /**
     * 描述 (location: E2) (checker: x)
     */
    readonly value_comment: string;
}

// file: test/res/task.xlsx
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
    readonly reward: unknown;
    /**
     * vip奖励 (location: I1) (checker: $[*].id==item#*.id)
     */
    readonly vip_reward: unknown;
    /**
     * 任务icon (location: J1) (checker: x)
     */
    readonly icon: string;
}

// file: test/res/task.xlsx
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
    readonly args: unknown;
    /**
     * 奖励 (location: J1) (checker: @ItemArrayChecker)
     */
    readonly reward: unknown;
    /**
     * 任务icon (location: K1) (checker: x)
     */
    readonly icon: string;
    /**
     * 任务npc和对话 (location: L1) (checker: x)
     */
    readonly custom?: unknown;
}

// file: test/res/task.xlsx
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
     * 支线任务 (location: G1) (checker: $[*]==#branch.id)
     */
    readonly branch_tasks?: unknown;
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
    readonly args: unknown;
    /**
     * 奖励 (location: K1) (checker: @ItemArrayChecker)
     */
    readonly reward: unknown;
    /**
     * 任务icon (location: L1) (checker: x)
     */
    readonly icon: string;
    /**
     *  (location: M1) (checker: x)
     */
    readonly custom?: unknown;
    /**
     * 完成后自动提交 (location: N1) (checker: [1])
     */
    readonly auto_submit?: number;
}

// file: test/res/task.xlsx
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
    readonly reward: unknown;
    /**
     * 任务icon (location: I1) (checker: x)
     */
    readonly icon: string;
}

/**
 * path: test/res/task.xlsx
 */
export interface GeneratedTaskTable {
    readonly branch: { [key: number | string]: GeneratedTaskBranchRow };
    readonly conf: { [key: number | string]: GeneratedTaskConfRow };
    readonly events: { [key: number | string]: GeneratedTaskEventsRow };
    readonly exchange: { [key: number | string]: GeneratedTaskExchangeRow };
    readonly main: { [key: number | string]: GeneratedTaskMainRow };
    readonly weekly: { [key: number | string]: GeneratedTaskWeeklyRow };
}

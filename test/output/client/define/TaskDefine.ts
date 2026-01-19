export type TaskConditionKey =
    | "building_level"
    | "mainline_event"
    | "open_chest"
    | "receive_chest"
    | "receive_item"
    | "role_level";

/**
 * 任务条件
 */
export enum TaskCondition {
    /**
     * 指定建筑达到x级
     */
    building_level = "building_level",
    /**
     * 主线事件
     */
    mainline_event = "mainline_event",
    /**
     * 打开宝箱
     */
    open_chest = "open_chest",
    /**
     * 捡到指定数量的指定类型宝箱
     */
    receive_chest = "receive_chest",
    /**
     * 获得累计x个指定道具
     */
    receive_item = "receive_item",
    /**
     * 等级达到10级
     */
    role_level = "role_level",
}

export type TaskStateKey =
    | "NOT_RECEIVED"
    | "DOING"
    | "DONE"
    | "COMPLETE";

/**
 * 任务状态
 */
export enum TaskState {
    /**
     * 未接取任务
     */
    NOT_RECEIVED = 1,
    /**
     * 任务进行中
     */
    DOING = 2,
    /**
     * 任务完成可领取奖励
     */
    DONE = 3,
    /**
     * 任务完结
     */
    COMPLETE = 4,
}

export type TaskTypeKey =
    | "MAIN"
    | "BRANCH"
    | "DAILY"
    | "WEEKLY"
    | "EVENTS"
    | "PASSES"
    | "EXCHANGE";

/**
 * 任务类型
 */
export enum TaskType {
    /**
     * 主线任务
     */
    MAIN = 1,
    /**
     * 支线任务
     */
    BRANCH = 2,
    /**
     * 日常任务
     */
    DAILY = 3,
    /**
     * 周常任务
     */
    WEEKLY = 4,
    /**
     * 活动任务
     */
    EVENTS = 5,
    /**
     * xx任务
     */
    PASSES = 6,
    /**
     * 兑换任务
     */
    EXCHANGE = 7,
}


export const TaskDefine = {
    TASK: {
        /**
         * 新手最后一个任务id
         */
        BEGINNER_LAST_TASK_ID: 1023,
    },
} as const;
// AUTO GENERATED, DO NOT MODIFY!
// file: test/res/typedef.xlsx

/** 杀怪任务 */
export interface TaskArgKillMonster {
    /** 参数类型 */
    kind: "kill_monster";
    /** 怪物ID */
    id: number;
    /** 怪物数量 */
    count: number;
}

/** 捡金币 */
export interface TaskArgCollectCoin {
    /** 参数类型 */
    kind: "collect_coin";
    /** 金币ID */
    id: number;
    /** 金币数量 */
    count: number;
    /** 限时 */
    duration: number;
}

/** 任务参数 */
export type TaskArgs = TaskArgKillMonster | TaskArgCollectCoin;


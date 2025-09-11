// AUTO GENERATED, DO NOT MODIFY!

// file: test/res/item.xlsx
export interface ItemDefine {
    /**
     * ### (location: A2) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 注释 (location: B2) (checker: x) (writer: client|server)
     */
    comment: { v?:string };
    /**
     *  (location: C2) (checker: x) (writer: client|server)
     */
    key1: { v:string };
    /**
     *  (location: D2) (checker: x) (writer: client|server)
     */
    key2: { v?:string };
    /**
     * 注释 (location: E2) (checker: x) (writer: client|server)
     */
    value_comment: { v?:string };
    /**
     *  (location: F2) (checker: x) (writer: client|server)
     */
    value: { v:unknown };
    /**
     *  (location: G2) (checker: x) (writer: client|server)
     */
    value_type: { v:string };
    /**
     *  (location: H2) (checker: x) (writer: client|server)
     */
    enum: { v?:string };
}

// file: test/res/item.xlsx
export interface ItemFollow {
    /**
     * ### (location: A1) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 物品类型 (location: B1) (checker: x) (writer: client|server)
     */
    name: { v?:string };
    /**
     *  (location: C1) (checker: @follow(name)) (writer: client|server)
     */
    value: { v?:string };
}

// file: test/res/item.xlsx
export interface ItemItem {
    /**
     * ### (location: A1) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 注释 (location: B1) (checker: x) (writer: client|server)
     */
    comment: { v:string };
    /**
     * 物品名称 (location: C1) (checker: x) (writer: client|server)
     */
    name: { v:string };
    /**
     * 物品说明 (location: D1) (checker: x) (writer: client)
     */
    desc: { v:string };
    /**
     * 物品类型 config.ITEM_TYPE (location: E1) (checker: x) (writer: client|server)
     */
    item_type: { v:number };
    /**
     * 背包类型 config.BAG_TYPE (location: F1) (checker: x) (writer: client|server)
     */
    bag_id: { v:number };
    /**
     * 可否堆叠 (location: G1) (checker: x) (writer: client|server)
     */
    stack: { v?:number };
    /**
     * 品质(颜色) (location: H1) (checker: x) (writer: client|server)
     */
    quality: { v:number };
    /**
     * 参数 (location: I1) (checker: x) (writer: client|server)
     */
    args: { v?:unknown };
    /**
     * 背包是否隐藏 (location: J1) (checker: x) (writer: client|server)
     */
    hide: { v?:boolean };
}

// file: test/res/item.xlsx
export interface ItemMap {
    /**
     * 注释 (location: B2) (checker: x) (writer: client|server)
     */
    comment: { v:string };
    /**
     *  (location: C2) (checker: x) (writer: client|server)
     */
    kind: { v:number };
    /**
     *  (location: D2) (checker: x) (writer: client|server)
     */
    level: { v:number };
    /**
     * 物品名称 (location: E2) (checker: x) (writer: client|server)
     */
    name: { v:string };
}

// file: test/res/item.xlsx
export interface ItemMapArr {
    /**
     * ### (location: A2) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 注释 (location: B2) (checker: x) (writer: client|server)
     */
    comment: { v:string };
    /**
     *  (location: C2) (checker: x) (writer: client|server)
     */
    kind: { v:number };
    /**
     *  (location: D2) (checker: x) (writer: client|server)
     */
    level: { v:number };
    /**
     * 物品名称 (location: E2) (checker: x) (writer: client|server)
     */
    name: { v:string };
}

// file: test/res/item.xlsx
export interface ItemMapField {
    /**
     * ### (location: A2) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 注释 (location: B2) (checker: x) (writer: client|server)
     */
    comment: { v:string };
    /**
     *  (location: C2) (checker: x) (writer: client|server)
     */
    kind: { v:number };
    /**
     *  (location: D2) (checker: x) (writer: client|server)
     */
    level: { v:number };
    /**
     * 物品名称 (location: E2) (checker: x) (writer: client|server)
     */
    name: { v:string };
}

// file: test/res/item.xlsx
export interface ItemMapObj {
    /**
     * ### (location: A2) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 注释 (location: B2) (checker: x) (writer: client|server)
     */
    comment: { v:string };
    /**
     *  (location: C2) (checker: x) (writer: client|server)
     */
    kind: { v:number };
    /**
     *  (location: D2) (checker: x) (writer: client|server)
     */
    level: { v:number };
    /**
     * 物品名称 (location: E2) (checker: x) (writer: client|server)
     */
    name: { v:string };
}

// file: test/res/task.xlsx
export interface TaskBranch {
    /**
     * ### (location: A1) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 任务组 (location: C1) (checker: x) (writer: client|server)
     */
    group: { v:number };
    /**
     * 显示排序 (location: D1) (checker: x) (writer: client|server)
     */
    sort: { v:number };
    /**
     * 任务类型 (location: E1) (checker: x) (writer: client|server)
     */
    type: { v:number };
    /**
     * 名字 (location: F1) (checker: x) (writer: client)
     */
    name: { v:string };
    /**
     * 描述 (location: G1) (checker: x) (writer: client|server)
     */
    desc: { v:string };
    /**
     * 后置任务 (location: H1) (checker: #branch.id) (writer: client|server)
     */
    next_task: { v?:number };
    /**
     * 条件 (location: I1) (checker: x) (writer: client|server)
     */
    condition: { v:string };
    /**
     * 累计 (location: J1) (checker: x) (writer: client|server)
     */
    total: { v?:boolean };
    /**
     * 参数 (location: K1) (checker: x) (writer: client|server)
     */
    args: { v:unknown };
    /**
     * 参数类型 (location: L1) (checker: x) (writer: client|server)
     */
    args_type: { v:string };
    /**
     * 奖励 (location: M1) (checker: $[*].id==item#item.id) (writer: client|server)
     */
    reward: { v:unknown };
    /**
     * 任务icon (location: N1) (checker: x) (writer: client)
     */
    icon: { v:string };
    /**
     *  (location: O1) (checker: x) (writer: client)
     */
    custom: { v?:string };
    /**
     * 完成后自动提交 (location: P1) (checker: x) (writer: client)
     */
    auto_submit: { v?:number };
}

// file: test/res/task.xlsx
export interface TaskConf {
    /**
     * ### (location: A2) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 键 (location: B2) (checker: x) (writer: client|server)
     */
    key: { v:string };
    /**
     * 值 (location: C2) (checker: x) (writer: client|server)
     */
    value: { v:string };
    /**
     * 值类型 (location: D2) (checker: x) (writer: client|server)
     */
    value_type: { v:string };
    /**
     * 描述 (location: E2) (checker: x) (writer: client|server)
     */
    value_comment: { v:string };
}

// file: test/res/task.xlsx
export interface TaskDefine {
    /**
     * ### (location: A2) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 注释 (location: B2) (checker: x) (writer: client|server)
     */
    comment: { v?:string };
    /**
     *  (location: C2) (checker: x) (writer: client|server)
     */
    key1: { v:string };
    /**
     *  (location: D2) (checker: x) (writer: client|server)
     */
    key2: { v?:string };
    /**
     * 注释 (location: E2) (checker: x) (writer: client|server)
     */
    value_comment: { v?:string };
    /**
     *  (location: F2) (checker: $&key2=MAIN==#main.type&condition=mainline_event) (writer: client|server)
     */
    value: { v:unknown };
    /**
     *  (location: G2) (checker: x) (writer: client|server)
     */
    value_type: { v:string };
    /**
     *  (location: H2) (checker: x) (writer: client|server)
     */
    enum: { v?:string };
    /**
     *  (location: I2) (checker: x) (writer: client|server)
     */
    enum_option: { v?:boolean };
}

// file: test/res/task.xlsx
export interface TaskEvents {
    /**
     * ### (location: A1) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 显示排序 (location: C1) (checker: x) (writer: client|server)
     */
    sort: { v:number };
    /**
     * 任务类型 (location: D1) (checker: x) (writer: client|server)
     */
    type: { v:number };
    /**
     * 描述 (location: E1) (checker: x) (writer: client|server)
     */
    desc: { v:string };
    /**
     * 条件 (location: F1) (checker: x) (writer: server)
     */
    condition: { v:string };
    /**
     * 参数 (location: G1) (checker: x) (writer: server)
     */
    args: { v:unknown };
    /**
     * 奖励 (location: H1) (checker: $[*].id==item#item.id) (writer: client|server)
     */
    reward: { v:unknown };
    /**
     * vip奖励 (location: I1) (checker: $[*].id==item#*.id) (writer: client|server)
     */
    vip_reward: { v:unknown };
    /**
     * 任务icon (location: J1) (checker: x) (writer: client)
     */
    icon: { v:string };
}

// file: test/res/task.xlsx
export interface TaskExchange {
    /**
     * ### (location: A1) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 显示排序 (location: C1) (checker: x) (writer: client|server)
     */
    sort: { v:number };
    /**
     * 任务类型 (location: D1) (checker: x) (writer: client|server)
     */
    type: { v:number };
    /**
     * 描述 (location: E1) (checker: x) (writer: client|server)
     */
    desc: { v:string };
    /**
     * 后置任务 (location: F1) (checker: task#*.id) (writer: client|server)
     */
    next_task: { v?:number };
    /**
     * 条件 (location: G1) (checker: x) (writer: server)
     */
    condition: { v:string };
    /**
     * 累计 (location: H1) (checker: x) (writer: client|server)
     */
    total: { v?:boolean };
    /**
     * 参数 (location: I1) (checker: x) (writer: client|server)
     */
    args: { v:unknown };
    /**
     * 奖励 (location: J1) (checker: @ItemArrayChecker) (writer: client|server)
     */
    reward: { v:unknown };
    /**
     * 任务icon (location: K1) (checker: x) (writer: client)
     */
    icon: { v:string };
    /**
     * 任务npc和对话 (location: L1) (checker: x) (writer: client)
     */
    custom: { v?:unknown };
}

// file: test/res/task.xlsx
export interface TaskMain {
    /**
     * ### (location: A1) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 显示排序 (location: C1) (checker: $ > 0 && $ < 20) (writer: client|server)
     */
    sort: { v:number };
    /**
     * 任务类型 (location: D1) (checker: #define.value&key1=TASK_TYPE) (writer: client|server)
     */
    type: { v:number };
    /**
     * 描述 (location: E1) (checker: x) (writer: client|server)
     */
    desc: { v:string };
    /**
     * 后置任务 (location: F1) (checker: task#*.id) (writer: client|server)
     */
    next_task: { v?:number };
    /**
     * 支线任务 (location: G1) (checker: $[*]==#branch.id) (writer: client|server)
     */
    branch_tasks: { v?:number[] };
    /**
     * 条件 (location: H1) (checker: x) (writer: client|server)
     */
    condition: { v:string };
    /**
     * 累计 (location: I1) (checker: x) (writer: client|server)
     */
    total: { v?:boolean };
    /**
     * 参数 (location: J1) (checker: @TaskArgsChecker) (writer: client|server)
     */
    args: { v:unknown };
    /**
     * 奖励 (location: K1) (checker: @ItemArrayChecker) (writer: client|server)
     */
    reward: { v:unknown };
    /**
     * 任务icon (location: L1) (checker: x) (writer: client)
     */
    icon: { v:string };
    /**
     *  (location: M1) (checker: x) (writer: client)
     */
    custom: { v?:unknown };
    /**
     * 完成后自动提交 (location: N1) (checker: [1]) (writer: client)
     */
    auto_submit: { v?:number };
}

// file: test/res/task.xlsx
export interface TaskWeekly {
    /**
     * ### (location: A1) (checker: x) (writer: client|server)
     */
    id: { v:number };
    /**
     * 显示排序 (location: C1) (checker: x) (writer: client|server)
     */
    sort: { v:number };
    /**
     * 任务类型 (location: D1) (checker: x) (writer: client|server)
     */
    type: { v:number };
    /**
     * 描述 (location: E1) (checker: x) (writer: client|server)
     */
    desc: { v:string };
    /**
     * 条件 (location: F1) (checker: x) (writer: server)
     */
    condition: { v:string };
    /**
     * 参数 (location: G1) (checker: x) (writer: server)
     */
    args: { v:unknown };
    /**
     * 奖励 (location: H1) (checker: @ItemArrayChecker) (writer: client|server)
     */
    reward: { v:unknown };
    /**
     * 任务icon (location: I1) (checker: x) (writer: client)
     */
    icon: { v:string };
}


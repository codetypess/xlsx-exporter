/**
 * 背包类型
 */
export enum BagType {
    /**
     * 道具背包
     */
    ITEM = 1,
    /**
     * 宝箱背包
     */
    CHEST = 2,
}

/**
 * 物品子类型
 */
export enum ItemType {
    /**
     * 【开宝箱专用】宝箱
     */
    CHEST = 1,
    /**
     * 经验丹
     */
    EXP = 2,
    /**
     * 金币
     */
    COIN = 3,
    /**
     * 钻石
     */
    DIAMOND = 4,
}

export enum QualityType {
    /**
     * 绿
     */
    GREEN = 1,
    /**
     * 蓝
     */
    BLUE = 2,
    /**
     * 紫
     */
    PURPLE = 3,
    /**
     * 橙
     */
    ORANGE = 4,
    /**
     * 红
     */
    RED = 5,
}


export const ItemDefine = {
    /**
     * 背包类型
     */
    BAG_TYPE: BagType,
    /**
     * 首位唯一id
     */
    FIRST_ITEM_UID: 1000000,
    /**
     * 物品子类型
     */
    ITEM_TYPE: ItemType,
    QUALITY: QualityType,
}
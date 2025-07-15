return {
    ---@enum BagType
    -- 背包类型
    BAG_TYPE = {
        -- 道具背包
        ITEM = 1,
        -- 宝箱背包
        CHEST = 2,
    },
    -- 首位唯一id
    FIRST_ITEM_UID = 1000000,
    ---@enum ItemType
    -- 物品子类型
    ITEM_TYPE = {
        -- 【开宝箱专用】宝箱
        CHEST = 1,
        -- 经验丹
        EXP = 2,
        -- 金币
        COIN = 3,
        -- 钻石
        DIAMOND = 4,
    },
    ---@enum QualityType
    QUALITY = {
        -- 绿
        GREEN = 1,
        -- 蓝
        BLUE = 2,
        -- 紫
        PURPLE = 3,
        -- 橙
        ORANGE = 4,
        -- 红
        RED = 5,
    },
}
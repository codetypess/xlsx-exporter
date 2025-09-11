return {
  branch = {
    [200101] = {
      args = {
        amount = 1,
        lv = 5,
      },
      condition = "upgrade_skill",
      desc = "支线·升级1个技能至5级",
      group = 1,
      id = 200101,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 1,
      total = false,
      type = 2,
    },
    [200102] = {
      args = {
        amount = 1,
        lv = 10,
      },
      condition = "upgrade_skill",
      desc = "支线·升级1个技能至10级",
      group = 1,
      id = 200102,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 2,
      total = false,
      type = 2,
    },
    [200103] = {
      args = {
        amount = 4,
        lv = 10,
      },
      condition = "upgrade_skill",
      desc = "支线·升级4个技能至10级",
      group = 1,
      id = 200103,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 3,
      total = false,
      type = 2,
    },
    [200104] = {
      args = {
        amount = 8,
        lv = 10,
      },
      condition = "upgrade_skill",
      desc = "支线·升级8个技能至10级",
      group = 1,
      id = 200104,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 4,
      total = false,
      type = 2,
    },
    [200105] = {
      args = {
        amount = 12,
        lv = 10,
      },
      condition = "upgrade_skill",
      desc = "支线·升级12个技能至10级",
      group = 1,
      id = 200105,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 5,
      total = false,
      type = 2,
    },
    [200106] = {
      args = {
        amount = 16,
        lv = 10,
      },
      condition = "upgrade_skill",
      desc = "支线·升级16个技能至10级",
      group = 1,
      id = 200106,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 6,
      total = false,
      type = 2,
    },
    [200107] = {
      args = {
        amount = 20,
        lv = 10,
      },
      condition = "upgrade_skill",
      desc = "支线·升级20个技能至10级",
      group = 1,
      id = 200107,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 7,
      total = false,
      type = 2,
    },
    [200201] = {
      args = {
        amount = 6,
        lv = 20,
      },
      condition = "own_soldier_level",
      desc = "支线·拥有6个20级士兵",
      group = 2,
      id = 200201,
      next_task = 200202,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 1,
      total = false,
      type = 2,
    },
    [200202] = {
      args = {
        amount = 9,
        lv = 20,
      },
      condition = "own_soldier_level",
      desc = "支线·拥有9个20级士兵",
      group = 2,
      id = 200202,
      next_task = 200203,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 2,
      total = false,
      type = 2,
    },
    [200203] = {
      args = {
        amount = 12,
        lv = 20,
      },
      condition = "own_soldier_level",
      desc = "支线·拥有12个20级士兵",
      group = 2,
      id = 200203,
      next_task = 200204,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 3,
      total = false,
      type = 2,
    },
    [200204] = {
      args = {
        amount = 15,
        lv = 20,
      },
      condition = "own_soldier_level",
      desc = "支线·拥有15个20级士兵",
      group = 2,
      id = 200204,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 4,
      total = false,
      type = 2,
    },
  },
  conf = {
    -- 玩家集结最大时间
    ASSEMBLE_TIME_MAX = 25200,
    -- 玩家集结最小时间
    ASSEMBLE_TIME_MIN = 1800,
    -- 攻城时长(秒数）
    GATE_SIEGE_TIME = 1200,
    -- 部队攻打建筑时间间隔(秒数）
    TROOP_SIEGE_INTERVAL = 3,
  },
  events = {
    [5001] = {
      args = {
        lv = 10,
      },
      condition = "role_level",
      desc = "等级达到10级",
      id = 5001,
      reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 2,
          id = 10102,
        },
      },
      sort = 1,
      type = 5,
      vip_reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 2,
          id = 10102,
        },
      },
    },
    [5002] = {
      args = {
        lv = 20,
      },
      condition = "role_level",
      desc = "等级达到20级",
      id = 5002,
      reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 3,
          id = 10102,
        },
      },
      sort = 2,
      type = 5,
      vip_reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 3,
          id = 10102,
        },
      },
    },
    [5003] = {
      args = {
        lv = 30,
      },
      condition = "role_level",
      desc = "等级达到30级",
      id = 5003,
      reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 4,
          id = 10102,
        },
      },
      sort = 3,
      type = 5,
      vip_reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 4,
          id = 10102,
        },
      },
    },
    [5004] = {
      args = {
        lv = 40,
      },
      condition = "role_level",
      desc = "等级达到40级",
      id = 5004,
      reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 5,
          id = 10102,
        },
      },
      sort = 4,
      type = 5,
      vip_reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 5,
          id = 10102,
        },
      },
    },
  },
  exchange = {
    [7001] = {
      args = {
        amount = 20,
        id = 30601,
      },
      condition = "exchange_item",
      desc = "和城市的商人进行一次交易",
      id = 7001,
      reward = {
        {
          count = 10,
          id = 30801,
        },
      },
      sort = 2,
      type = 7,
    },
    [7002] = {
      args = {
        amount = 30,
        id = 30601,
      },
      condition = "exchange_item",
      desc = "和城市的商人进行一次交易",
      id = 7002,
      reward = {
        {
          count = 15,
          id = 30801,
        },
      },
      sort = 3,
      type = 7,
    },
    [7003] = {
      args = {
        amount = 40,
        id = 30601,
      },
      condition = "exchange_item",
      desc = "和城市的商人进行一次交易",
      id = 7003,
      reward = {
        {
          count = 20,
          id = 30801,
        },
      },
      sort = 4,
      type = 7,
    },
    [7004] = {
      args = {
        amount = 40,
        id = 30601,
      },
      condition = "exchange_item",
      desc = "和城市的商人进行一次交易",
      id = 7004,
      reward = {
        {
          count = 20,
          id = 30801,
        },
        {
          count = 1,
          id = 30802,
        },
      },
      sort = 5,
      type = 7,
    },
  },
  main = {
    [1001] = {
      args = {
        amount = 1,
        id = 5,
        type = 17,
      },
      branch_tasks = {
      },
      condition = "mainline_event",
      desc = "主线任务1",
      id = 1001,
      next_task = 1002,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 1,
      total = true,
      type = 1,
    },
    [1002] = {
      args = {
        amount = 1,
        id = 71001,
        type = 6,
      },
      condition = "mainline_event",
      desc = "主线任务2",
      id = 1002,
      next_task = 1003,
      reward = {
        {
          count = 20,
          id = 10201,
        },
      },
      sort = 2,
      total = true,
      type = 1,
    },
    [1003] = {
      args = {
        amount = 1,
        id = 30008,
        type = 5,
      },
      condition = "mainline_event",
      desc = "主线任务3",
      id = 1003,
      next_task = 1014,
      reward = {
        {
          count = 10,
          id = 10201,
        },
        {
          count = 1,
          id = 41101,
        },
      },
      sort = 3,
      total = true,
      type = 1,
    },
    [1013] = {
      args = {
        amount = 1,
        pool_id = 10001,
      },
      condition = "recruit_pool",
      desc = "主线任务12",
      id = 1013,
      reward = {
        {
          count = 20,
          id = 10201,
        },
      },
      sort = 12,
      total = false,
      type = 1,
    },
    [1014] = {
      args = {
        amount = 1,
      },
      branch_tasks = {
        200105,
      },
      condition = "troop_soldier_amount",
      desc = "主线任务4",
      id = 1014,
      next_task = 100301,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 4,
      total = false,
      type = 1,
    },
    [100001] = {
      args = {
        amount = 1,
        id = 11219,
        type = 5,
      },
      condition = "mainline_event",
      desc = "主线任务8",
      id = 100001,
      next_task = 100002,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 8,
      total = true,
      type = 1,
    },
    [100002] = {
      args = {
        amount = 3,
        id = 1003,
        type = 19,
      },
      condition = "mainline_event",
      desc = "主线任务9",
      id = 100002,
      next_task = 100003,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 9,
      total = true,
      type = 1,
    },
    [100003] = {
      args = {
        amount = 1,
        id = 1012,
        type = 19,
      },
      condition = "mainline_event",
      desc = "主线任务10",
      id = 100003,
      next_task = 100304,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 10,
      total = true,
      type = 1,
    },
    [100301] = {
      args = {
        amount = 1,
        id = 71002,
        type = 6,
      },
      branch_tasks = {
        200106,
      },
      condition = "mainline_event",
      desc = "主线任务5",
      id = 100301,
      next_task = 100302,
      reward = {
        {
          count = 20,
          id = 10201,
        },
        {
          count = 1,
          id = 20601,
        },
      },
      sort = 5,
      total = true,
      type = 1,
    },
    [100302] = {
      args = {
        amount = 10,
        type = 11,
      },
      condition = "mainline_event",
      desc = "主线任务6",
      id = 100302,
      next_task = 100303,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 6,
      total = true,
      type = 1,
    },
    [100303] = {
      args = {
        amount = 1,
        id = 2,
        type = 9,
      },
      condition = "mainline_event",
      desc = "主线任务7",
      id = 100303,
      next_task = 100001,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 7,
      total = true,
      type = 1,
    },
    [100304] = {
      args = {
        amount = 1,
        id = 17101,
        type = 5,
      },
      condition = "mainline_event",
      desc = "主线任务11",
      id = 100304,
      next_task = 1013,
      reward = {
        {
          count = 10,
          id = 10201,
        },
      },
      sort = 11,
      total = true,
      type = 1,
    },
  },
  weekly = {
    [4001] = {
      args = {
        amount = 10,
      },
      condition = "cost_energy",
      desc = "花费10点体力",
      id = 4001,
      reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 2,
          id = 10102,
        },
      },
      sort = 1,
      type = 4,
    },
    [4002] = {
      args = {
        amount = 20,
      },
      condition = "cost_energy",
      desc = "花费20点体力",
      id = 4002,
      reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 3,
          id = 10102,
        },
      },
      sort = 2,
      type = 4,
    },
    [4003] = {
      args = {
        amount = 30,
      },
      condition = "cost_energy",
      desc = "花费30点体力",
      id = 4003,
      reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 4,
          id = 10102,
        },
      },
      sort = 3,
      type = 4,
    },
    [4004] = {
      args = {
        amount = 40,
      },
      condition = "cost_energy",
      desc = "花费40点体力",
      id = 4004,
      reward = {
        {
          count = 1,
          id = 10101,
        },
        {
          count = 5,
          id = 10102,
        },
      },
      sort = 4,
      type = 4,
    },
  },
}
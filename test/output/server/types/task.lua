-- AUTO GENERATED, DO NOT MODIFY!

---file: test/res/task.xlsx
---@class xlsx.server.TaskBranch
---@field id integer ###
---@field group integer 任务组
---@field sort integer 显示排序
---@field type integer 任务类型
---@field desc string 描述
---@field next_task? integer 后置任务
---@field condition string 条件
---@field total? boolean 累计
---@field args xlsx.server.table 参数
---@field reward xlsx.server.items 奖励

---file: test/res/task.xlsx
---@class xlsx.server.TaskConf
---@field id integer ###
---@field key string 键
---@field value string 值
---@field value_type string 值类型
---@field value_comment string 描述

---file: test/res/task.xlsx
---@class xlsx.server.TaskEvents
---@field id integer ###
---@field sort integer 显示排序
---@field type integer 任务类型
---@field desc string 描述
---@field condition string 条件
---@field args xlsx.server.table 参数
---@field reward xlsx.server.items 奖励
---@field vip_reward xlsx.server.items vip奖励

---file: test/res/task.xlsx
---@class xlsx.server.TaskExchange
---@field id integer ###
---@field sort integer 显示排序
---@field type integer 任务类型
---@field desc string 描述
---@field next_task? integer 后置任务
---@field condition string 条件
---@field total? boolean 累计
---@field args xlsx.server.table 参数
---@field reward xlsx.server.items 奖励

---file: test/res/task.xlsx
---@class xlsx.server.TaskMain
---@field id integer ###
---@field sort integer 显示排序
---@field type integer 任务类型
---@field desc string 描述
---@field next_task? integer 后置任务
---@field branch_tasks? xlsx.server.table 支线任务
---@field condition string 条件
---@field total? boolean 累计
---@field args xlsx.server.table 参数
---@field reward xlsx.server.items 奖励

---file: test/res/task.xlsx
---@class xlsx.server.TaskWeekly
---@field id integer ###
---@field sort integer 显示排序
---@field type integer 任务类型
---@field desc string 描述
---@field condition string 条件
---@field args xlsx.server.table 参数
---@field reward xlsx.server.items 奖励


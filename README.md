# XLSX Exporter

将遵循固定表头约定的 `.xlsx` 工作簿转换为可校验的数据模型，并按需输出为 JSON、TypeScript、Lua 等文件。

项目内置：

- `.xlsx` 读取与多 Sheet 处理，底层基于 `fastxlsx`
- 多 writer 输出管线，可同时生成 client / server 结果
- 类型转换、索引校验、表达式校验、长度校验等能力
- `define`、`config`、`map`、`collapse`、`column`、`typedef` 等处理器
- TypeScript / Lua 类型生成、workbook indexer、Zod schema 辅助能力

## 安装

仓库内开发：

```bash
npm i
```

常用命令：

```bash
npm run check
npm run test
```

## 快速开始

最小接入流程只有两步：

1. 注册一个或多个 writer，定义不同 `processor` 的输出行为。
2. 调用 `parse()` 读取工作簿并触发转换、校验和输出。

```ts
import * as xlsx from "xlsx-exporter";

const OUTPUT_DIR = "output";

xlsx.registerWriter("client", (workbook, processor, data) => {
    if (processor === "define") {
        const defineName = String(data["!name"] ?? workbook.name);
        const exportName = xlsx.toPascalCase(defineName);
        xlsx.writeFile(
            `${OUTPUT_DIR}/client/define/${defineName}.ts`,
            xlsx.stringifyTs(data, {
                indent: 4,
                marshal: `export const ${exportName} = `,
            })
        );
        return;
    }

    if (processor === "stringify") {
        xlsx.writeFile(
            `${OUTPUT_DIR}/client/data/${workbook.name}.json`,
            xlsx.stringifyJson(data, { indent: 2 })
        );
        return;
    }

    if (processor === "gen-type") {
        const content = xlsx.genTsType(workbook, (typename) => ({ type: typename }));
        xlsx.writeFile(`${OUTPUT_DIR}/client/types/${workbook.name}.ts`, content);
        return;
    }

    if (processor === "typedef") {
        const typedefWorkbook = data as xlsx.TypedefWorkbook;
        const content = xlsx.genTsTypedef(typedefWorkbook, (typename) => ({
            type: typename,
        }));
        if (content) {
            xlsx.writeFile(
                `${OUTPUT_DIR}/client/types/${workbook.name}.${typedefWorkbook.sheet}.ts`,
                content
            );
        }
    }
});

xlsx.registerWriter("server", (workbook, processor, data) => {
    if (processor === "stringify") {
        xlsx.writeFile(
            `${OUTPUT_DIR}/server/data/${workbook.name}.lua`,
            xlsx.stringifyLua(data, {
                indent: 4,
                marshal: "return ",
            })
        );
        return;
    }

    if (processor === "gen-type") {
        const content = xlsx.genLuaType(workbook, (typename) => ({ type: typename }));
        xlsx.writeFile(`${OUTPUT_DIR}/server/types/${workbook.name}.lua`, content);
    }
});

await xlsx.parse(["test/res/item.xlsx", "test/res/task.xlsx", "test/res/typedef.xlsx"]);
```

完整示例见 [test/test.ts](test/test.ts)。

## 工作流程

`parse(files, headerOnly?)` 的主流程如下：

1. 读取每个工作簿的表头与数据。
2. 执行 `after-read`、`pre-parse`、`after-parse` 等阶段处理器。
3. 按已注册 writer 克隆上下文，并根据导出列过滤字段。
4. 解析并执行所有 checker。
5. 执行 `pre-stringify`、`stringify`、`after-stringify` 阶段处理器。
6. 在对应阶段触发 writer 回调。

如果只需要读取表头，可传入 `true`：

```ts
await xlsx.parse(["test/res/item.xlsx"], true);
```

## Excel 结构约定

### 表头布局

如果第一行是 processor 行，Sheet 结构如下：

| 行号 | 含义         | 示例                                     |
| ---- | ------------ | ---------------------------------------- |
| 1    | Sheet 处理器 | `@define;@stringify(merge)`              |
| 2    | 字段名       | `id`, `name`, `reward`                   |
| 3    | 字段类型     | `int`, `string`, `item[]`, `@value_type` |
| 4    | writer 过滤  | `client`, `server`                       |
| 5    | checker      | `@size(3)`, `item#item.id`, `$ >= 1`     |
| 6    | 注释         | 任意字段说明                             |
| 7+   | 数据行       | 实际业务数据                             |

如果没有 processor 行，则第 1 行直接是字段名，数据从第 6 行开始。

### 常见规则

- 第一列默认会被当作主键列。
- writer 行留空表示对所有已注册 writer 生效。
- writer 行写 `x` 表示该列完全不导出。
- 多 writer 使用 `|` 分隔，例如 `client|server`。
- 类型后缀 `?` 表示可选，例如 `string?`。
- 数组类型支持 `int[]`、`string[2]`、`int[][]`。
- 类型写成 `@fieldName` 时，表示“当前行另一个字段的值决定真实类型”。
- 第一列常见写 `>>`、`!!!`、`###` 作为视觉标记，解析时会忽略这些约定符号。

### Sheet 示例

```text
@define;@stringify(merge)
id      name    reward      reward_type  tags
int     string  @reward_type string      int[]
>>      client  client      x            client|server
!!!     x       item#item.id x           @size(3)
###     ID      名字        奖励         奖励类型      标签
1       sword   [1001,2]    item         [1,2,3]
```

## 内置类型

| 类型     | 说明                                               |
| -------- | -------------------------------------------------- |
| `int`    | 整数                                               |
| `float`  | 浮点数                                             |
| `bool`   | 布尔值                                             |
| `string` | 字符串                                             |
| `json`   | JSON / JSON5 字符串                                |
| `table`  | Lua table 风格字符串，如 `{1,2}`、`{id=1,count=2}` |
| `auto`   | 自动行号，单元格需填 `-`，解析后按数据行序号生成   |

补充规则：

- `?` 表示可选，如 `string?`、`int[]?`。
- `[n]` 表示定长数组，如 `int[3]`。
- `[]` 表示动态数组，支持多维。
- 可通过 `registerType()` 注册自定义类型。

## 内置处理器

| 处理器                         | 阶段            | 作用                                                                           |
| ------------------------------ | --------------- | ------------------------------------------------------------------------------ |
| `@define`                      | `pre-stringify` | 将定义表转换为对象，并以 `define` 事件直接交给 writer                          |
| `@config`                      | `pre-stringify` | 将 `key/value/value_type/value_comment` 表转换为配置对象，参与后续 `stringify` |
| `@map(value, ...keys)`         | `pre-stringify` | 将行数据重组为多级 map                                                         |
| `@collapse(...keys)`           | `pre-stringify` | 按 key 折叠为多级数组结构                                                      |
| `@column(idxKey, ...foldKeys)` | `pre-stringify` | 按主键聚合多行，并将指定列折叠为数组                                           |
| `@stringify(rule)`             | `stringify`     | 使用某个 stringify 规则输出工作簿数据                                          |
| `@typedef`                     | `after-read`    | 读取 typedef sheet、注册类型，并在后续触发 `typedef` 事件                      |
| `@gen-type`                    | `stringify`     | 触发类型生成事件，通常在 writer 中调用 `genTsType` / `genLuaType`              |

内置 required processors 会自动补齐到工作簿中，因此通常不需要手动声明：

- `@stringify`
- `@gen-type`
- `@auto-register`

### 内置 stringify 规则

| 规则     | 说明                                        |
| -------- | ------------------------------------------- |
| `simple` | 默认规则，输出 `{ [sheetName]: sheetData }` |
| `merge`  | 将所有 sheet 的行合并到同一个对象中         |

自定义规则：

```ts
xlsx.registerStringify("task", (workbook) => {
    const result: Record<string, unknown> = {};
    for (const sheet of workbook.sheets) {
        result[sheet.name] = sheet.data;
    }
    return result;
});
```

## Checker 说明

常用写法

- `x`
  关闭当前列检查。
- `!@Checker(...)`
  给 checker 加 `!` 前缀后，即使单元格为空也会执行检查。
- `[1,2,3]`
  范围检查，值必须命中数组中的某一项。
- `$ >= 1 && $ <= 9`
  表达式检查，`$` 表示当前单元格的值。
- `@size(10)`
  当前值必须是数组，且长度为 `10`。
- `@follow(field)`
  如果目标列有值，则当前列也必须有值；如果目标列为空，当前列也必须为空。
- `@unique`
  当前列的值在同一 Sheet 中必须唯一。

### 索引检查

索引检查以 `#` 为核心操作符，用于验证当前值、当前值中的子路径，或当前值中的数组元素是否能在目标表中找到。

常用形式：

```text
[文件名]#[工作表名].[列名]
$==[文件名]#[工作表名].[列名]&[列过滤器]
$[路径][&行过滤器]==[文件名]#[工作表名].[列名][&列过滤器]
```

规则说明：

- 文件名可省略，省略时表示当前工作簿。
- 工作表名可写 `*`，表示任意 Sheet。
- `==` 左侧描述“从当前单元格里取什么值去查”。
- `==` 右侧描述“去哪个文件、哪个 Sheet、哪一列查”。
- 过滤器使用 `&` 连接多个 `字段=值` 条件。
- checker 之间使用 `;` 分隔。

示例：

```text
#skill.id
battle/battle_skill#skill.id
battle/battle_skill#*.id
$==equipment#equipment.id&part=1
$[*]==activity/battle_pass#task.task_id
$[.]==#technology.tech_id
$&key1=COLLECTION_ITEM_ID==item#item.id
$.star?==hero#hero_star.star;$.stage?==hero#hero_stage.stage_parameter
```

### 路径表达式

在索引检查左侧，`$` 表示当前单元格的值：

- `$.id`
  取对象属性。
- `$[0]`
  取数组指定下标。
- `$[*]`
  遍历数组全部元素。
- `$[.]`
  取对象全部键名。
- `?`
  可选访问；路径不存在时跳过，不报错。

示例：

```text
$.rewards[*].item_id
$.config.targets[0]
$.attrs?[*][0]
```

## typedef

`@typedef` 用于把某个 Sheet 声明为类型定义源，并自动注册对应 convertor。

typedef Sheet 至少需要这些字段：

- `comment`
- `key1`
- `key2`
- `value_type`
- `value_comment`

行为说明：

- `key1` 表示类型名。
- `key2` 表示字段名；如果包含 `|`，则会被解析为 union 成员列表。
- `value_type` 表示字段类型，支持引用内置类型、已有 typedef，或字面量类型（如 `#1`、`#FOO`）。
- `typedef` 会在 writer 中以 `processor === "typedef"` 的形式出现，可配合 `genTsTypedef()` / `genLuaTypedef()` 输出。

相关 API：

- `genTsTypedef()`
- `genLuaTypedef()`
- `getTypedefWorkbook()`
- `getTypedef()`

## 常用 API

### 核心入口

| API                                          | 说明                      |
| -------------------------------------------- | ------------------------- |
| `parse(files, headerOnly?)`                  | 读取工作簿并执行完整管线  |
| `registerWriter(name, writer)`               | 注册 writer               |
| `registerType(name, convertor)`              | 注册自定义类型            |
| `registerChecker(name, parser)`              | 注册自定义 checker        |
| `registerProcessor(name, processor, option)` | 注册自定义处理器          |
| `registerStringify(name, rule)`              | 注册自定义 stringify 规则 |

### 输出与文件

| API               | 说明                     |
| ----------------- | ------------------------ |
| `stringifyJson()` | 序列化为 JSON            |
| `stringifyLua()`  | 序列化为 Lua             |
| `stringifyTs()`   | 序列化为 TypeScript 常量 |
| `writeFile()`     | 直接写文件               |
| `writeJson()`     | 写 JSON 文件             |
| `writeLua()`      | 写 Lua 文件              |
| `writeTs()`       | 写 TypeScript 文件       |

### 类型与工具

| API                    | 说明                                     |
| ---------------------- | ---------------------------------------- |
| `genTsType()`          | 为单个 workbook 生成 TypeScript 行类型   |
| `genLuaType()`         | 为单个 workbook 生成 Lua 注解类型        |
| `genTsTypedef()`       | 为 typedef workbook 生成 TypeScript 类型 |
| `genLuaTypedef()`      | 为 typedef workbook 生成 Lua 类型        |
| `genXlsxType()`        | 为整个 context 生成汇总 TypeScript 类型  |
| `genWorkbookIndexer()` | 生成 workbook 查询器                     |
| `tsToZod()`            | 将 TypeScript 类型文件转成 Zod schema    |

## 自定义扩展

### 自定义类型

```ts
xlsx.registerType("item", (raw) => {
    const [id, count] = xlsx.convertValue(raw, "json") as [number, number];
    return { id, count };
});
```

### 自定义 checker

```ts
xlsx.registerChecker("Positive", () => {
    return ({ cell }) => typeof cell.v === "number" && cell.v > 0;
});
```

Excel 中可这样使用：

```text
@Positive
```

### 自定义 processor

```ts
xlsx.registerProcessor(
    "post_stringify",
    async (workbook) => {
        console.log("after stringify:", workbook.path);
    },
    {
        stage: "after-stringify",
        required: true,
        priority: 999,
    }
);
```

说明：

- `required: true` 表示该 processor 会自动挂到工作簿上。
- `priority` 数值越小越早执行。

## 项目结构

- [index.ts](index.ts)
  公共入口，注册内置类型、checker、processor，并导出全部 API。
- [src/xlsx.ts](src/xlsx.ts)
  核心解析流程、上下文管理、writer 调度、checker 执行。
- [src/processor.ts](src/processor.ts)
  内置 processor 与 stringify rule。
- [src/checker.ts](src/checker.ts)
  内置 checker 与索引检查实现。
- [src/typedef.ts](src/typedef.ts)
  typedef 注册与 TS / Lua 类型生成。
- [src/zod.ts](src/zod.ts)
  `tsToZod()` 实现。
- [test/](test)
  端到端示例、回归测试和生成结果样例。

## 检查器详细语法（附录）

### 高级索引检查器

**核心机制**：

- `#` 是“取表”操作符，用于指定目标表格位置。
- 根据是否有行表达式、行过滤器或列过滤器来选择语法形式。

### 表格结构说明

基于项目中 Excel 文件的标准结构：

```text
第1行: @define;@stringify(表名)           // 处理器定义
第2行: id | comment | key1 | key2 | ...   // 字段名
第3行: int | string? | string | ...        // 字段类型
第4行: >> |   |   |   | ...               // 可选的状态标记
第5行: !!! | x | x | x | ...             // 必填字段标记
第6行: ### | 注释 |   |   | ...           // 字段注释
第7行开始: 实际数据
```

### 语法形式

**核心操作符说明**：

- **`#`** 是“取表”操作符，用于指定目标表格位置。
- **`==`** 是分隔符，在特定情况下使用。

#### 1. 简单形式（直接检查当前单元格值）

```text
[文件名]#[工作表名].[列名]
```

#### 2. 带列过滤器形式（左边有筛选时，左边必须有 $）

```text
$[表达式]==[文件名]#[工作表名].[列名]&[列过滤器]
```

#### 3. 完整形式（有行表达式或行过滤器）

```text
$[行键表达式][&行过滤器]==[文件名]#[工作表名].[列名][&列过滤器]
```

**文件名规则**：

- **当前文件内查找**：可以省略文件名，如 `#hero.id`
- **跨文件引用**：必须指定文件名，如 `hero#hero.id`

**关键规则**：

- **左边有过滤器时**：左边必须要有 `$` 表达式，使用 `==` 分隔
- **有行表达式或行过滤器时**：使用 `==` 分隔
- **简单检查当前单元格值时**：直接使用 `#` 取表操作符

### 行键表达式语法

#### 重要说明

在行键表达式中，`$` 代表**当前单元格的值**，而不是当前行的值。这意味着：

- 如果当前单元格包含简单值，例如数字、字符串，则 `$` 就是该值
- 如果当前单元格包含 JSON 对象，则可以用 `$.property` 访问对象属性
- 如果当前单元格包含数组，则可以用 `$[index]` 访问数组元素

#### 基本路径

- `.property`：访问对象属性
- `[index]`：访问数组元素，从 `0` 开始
- `[*]`：遍历数组所有元素
- `[.]`：获取对象所有键名

#### 可选访问

在路径后加 `?` 表示可选访问，如果路径不存在则跳过而不报错：

- `.property?`：可选属性访问
- `[index]?`：可选数组元素访问

#### 复杂路径示例

- `$.id`：获取当前单元格值，如果是对象，则读取 `id` 属性
- `$.rewards[*].item_id`：获取当前单元格值中 `rewards` 数组所有元素的 `item_id`
- `$.config.targets[0]`：获取当前单元格值中 `config.targets` 的第一个元素

### 过滤器语法

过滤器使用 `&` 连接多个条件，格式为 `字段名=值`：

- `type=MAIN`：当前行的 `type` 字段等于 `MAIN`
- `quality=1&enabled=true`：当前行的 `quality` 字段为 `1` 且 `enabled` 字段为 `true`

**注意**：

- 过滤器中的 `=` 是单等号，用于字段匹配
- `==` 是双等号，用于分隔整个检查表达式的左右两部分

### 使用示例

#### 基于项目实际案例的示例

以下示例均来自项目里真实的 checker 使用方式。

#### 示例 1：简单索引检查

```yaml
# 检查功能开启ID是否存在
# 来源：activity.xlsx -> activity工作表
func_id: open_func#func.id

# 检查英雄ID是否存在
# 来源：battle/battle_robot.xlsx -> hero工作表
hero_id: hero#hero.id

# 检查怪物ID是否存在
# 来源：activity/battle_pass.xlsx -> monster工作表
monster_id: monster#troop.id

# 检查价格是否在价格表中存在
# 来源：activity/accumulate_recharge.xlsx -> reward工作表
cost: price#price.cny
```

#### 示例 2：带列过滤器的检查

```yaml
# 检查装备ID是否在对应部位的装备中存在
# 来源：battle/battle_test.xlsx -> t1工作表
eq_part_1: $==equipment#equipment.id&part=1 # 头盔
eq_part_2: $==equipment#equipment.id&part=2 # 战甲
eq_part_6: $==equipment#equipment.id&part=6 # 武器

# 检查联盟道具购买价格中的道具ID
# 来源：alliance.xlsx -> item工作表
buy_price: $[*].id==#item.id
```

#### 示例 3：带行过滤器的检查

```yaml
# 只有当key1为COLLECTION_ITEM_ID时才检查物品ID
# 来源：activity/wusheng_road.xlsx -> define工作表
value: $&key1=COLLECTION_ITEM_ID==item#item.id

# 根据不同条件检查不同表（多条件可选验证）
# 来源：activity/upstar_limit.xlsx -> task工作表
args: $.star?==hero#hero_star.star;$.stage?==hero#hero_stage.stage_parameter
```

#### 示例 4：数组元素检查

```yaml
# 检查任务数组中每个ID是否都存在
# 来源：activity/battle_pass.xlsx -> typeInfo工作表
daily_tasks: $[*]==activity/battle_pass#task.task_id
weekly_tasks: $[*]==activity/battle_pass#task.task_id

# 检查技能动作ID数组
# 来源：battle/battle_skill.xlsx -> skill工作表
carry_actions: $[*]==battle/battle_skill#action.id

# 检查技能标签数组
# 来源：battle/battle_skill.xlsx -> buff工作表
granted_tags: $[*]==#define.key2&key1=SKILL_TAG
```

#### 示例 5：对象键检查

```yaml
# 检查前置科技条件（对象的键）
# 来源：alliance.xlsx -> technology工作表
pre_tech_cond: $[.]==#technology.tech_id
```

#### 示例 6：条件性检查

```yaml
# 根据不同属性检查不同表（可选属性验证）
# 来源：activity/upstar_limit.xlsx -> task工作表
args: $.star?==hero#hero_star.star;$.stage?==hero#hero_stage.stage_parameter

# 复杂的属性检查（多层可选验证）
# 来源：alliance.xlsx -> technology工作表
base: $.higner_attrs?[*][0]==attr#higher_attr.id;$.attrs?[*][0]==attr#attr.id
```

#### 示例 7：跨目录文件引用

```yaml
# 检查传送点奖励
# 来源：activity/novice_limit_time.xlsx -> drop工作表
transferId: battle/battle_pve_map#transfer.id

# 检查NPC状态
# 来源：battle/battle_npc_state.xlsx -> npcState工作表
npc_id: battle/battle_npc#npc.id

# 检查获取途径ID
# 来源：activity/battle_pass.xlsx -> task工作表
getwayid: item#itemGetWay.id
```

#### 示例 8：复杂嵌套检查

```yaml
# 检查属性数组，每个元素的第一个值必须是属性ID
# 来源：battle/battle_skill_lv.xlsx -> attr工作表
attr: $[*][0]==attr#attr.id

# 检查任务ID（支持通配符）
# 来源：battle/battle_interaction_resource.xlsx -> resource工作表
born_task_id: task#*.id

# 检查资产ID
# 来源：alliance.xlsx -> building工作表
asset_id: asset#assets.id
```

### 常见应用场景

#### 1. 外键关系验证

最常见的用法，验证 ID 字段的外键关系：

```yaml
# 活动功能开启检查
# 来源：activity.xlsx -> activity工作表
func_id: open_func#func.id

# 英雄ID验证
# 来源：battle/battle_robot.xlsx -> hero工作表
hero_id: hero#hero.id

# 怪物ID验证（跨文件）
# 来源：activity/battle_pass.xlsx -> monster工作表
monster_id: monster#troop.id

# 资产ID验证
# 来源：alliance.xlsx -> building工作表
asset_id: asset#assets.id
```

#### 2. 带条件的验证

根据其他字段值进行条件性检查：

```yaml
# 装备部位验证：根据装备部位检查对应的装备
# 来源：battle/battle_test.xlsx -> t1工作表
eq_part_1: $==equipment#equipment.id&part=1 # 头盔
eq_part_6: $==equipment#equipment.id&part=6 # 武器

# 价格验证：检查价格是否在价格表中存在
# 来源：activity/daily_recharge.xlsx -> reward工作表
recharge_limit: price#price.cny
# 来源：activity/gift_push.xlsx -> gifts工作表
cost: price#price.cny
```

#### 3. 数组和集合验证

验证数组中每个元素或对象的键：

```yaml
# 任务列表验证
# 来源：activity/battle_pass.xlsx -> typeInfo工作表
daily_tasks: $[*]==activity/battle_pass#task.task_id
weekly_tasks: $[*]==activity/battle_pass#task.task_id

# 技能动作验证
# 来源：battle/battle_skill.xlsx -> skill工作表
carry_actions: $[*]==battle/battle_skill#action.id

# 对象键验证（前置科技）
# 来源：alliance.xlsx -> technology工作表
pre_tech_cond: $[.]==#technology.tech_id

# 属性数组验证（数组元素的第一个值）
# 来源：battle/battle_skill_lv.xlsx -> attr工作表
attr: $[*][0]==attr#attr.id
```

#### 4. 复杂条件验证

根据行过滤器进行复杂的条件验证：

```yaml
# 根据key1字段值决定是否验证
# 来源：activity/wusheng_road.xlsx -> define工作表
value: $&key1=COLLECTION_ITEM_ID==item#item.id

# 标签验证：根据标签类型进行验证
# 来源：battle/battle_skill.xlsx -> buff工作表
granted_tags: $[*]==#define.key2&key1=SKILL_TAG
ongoing_require_tags: $[*]==#define.key2&key1=SKILL_TAG
```

#### 5. 多条件可选验证

使用 `?` 进行可选字段验证：

```yaml
# 根据不同属性检查不同表
# 来源：activity/upstar_limit.xlsx -> task工作表
args: $.star?==hero#hero_star.star;$.stage?==hero#hero_stage.stage_parameter

# 复杂属性验证
# 来源：alliance.xlsx -> technology工作表
base: $.higner_attrs?[*][0]==attr#higher_attr.id;$.attrs?[*][0]==attr#attr.id
percent: $.higner_attrs?[*][0]==attr#higher_attr.id;$.attrs?[*][0]==attr#attr.id
```

#### 6. 跨目录文件验证

验证不同子目录中的表格引用：

```yaml
# 战斗相关验证
# 来源：activity/novice_limit_time.xlsx -> drop工作表
transferId: battle/battle_pve_map#transfer.id
# 来源：battle/battle_npc_state.xlsx -> npcState工作表
npc_id: battle/battle_npc#npc.id

# 活动相关验证
# 来源：activity/battle_pass.xlsx -> task工作表
getwayid: item#itemGetWay.id

# 技能相关验证
# 来源：battle/battle_test.xlsx -> ft1工作表
skill1_id: battle/battle_skill#skill.id
```

#### 7. 通配符表名验证

使用通配符匹配多个工作表：

```yaml
# 支持任意工作表的任务ID
# 来源：battle/battle_interaction_resource.xlsx -> resource工作表
born_task_id: task#*.id

# 支持任意工作表的功能ID
# 来源：activity/fund.xlsx -> fundInfo工作表
func_jump: open_func#*.id
```

### 语法规则总结

基于项目实际使用情况的完整语法总结：

#### 基本规则

- **`#` 是“取表”操作符**：指定目标表格
- **文件名可省略**：当前文件内用 `#表名.列名`，跨文件用 `文件名#表名.列名`
- **支持子目录**：如 `battle/battle_skill#skill.id`
- **支持通配符**：如 `task#*.id`，匹配任意工作表

#### 路径表达式语法

`$`：当前单元格值

`$.property`：对象属性

`$[index]`：数组元素

`$[*]`：数组所有元素

`$[.]`：对象所有键

`$.property?`：可选属性，不存在时跳过

`$[*][0]`：数组元素的第一个值

#### 实际使用模式

```yaml
# 模式1：简单ID验证
hero_id: hero#hero.id

# 模式2：带列过滤器的验证
eq_part_1: $==equipment#equipment.id&part=1

# 模式3：数组元素验证
tasks: $[*]==activity/battle_pass#task.task_id

# 模式4：对象键验证
tech_cond: $[.]==#technology.tech_id

# 模式5：条件验证
value: $&key1=ITEM_ID==item#item.id

# 模式6：可选属性验证
args: $.star?==hero#hero_star.star

# 模式7：跨目录验证
npc_id: battle/battle_npc#npc.id
```

#### `!@checker`

所有检查器前缀带 `!`，就表明不管当前单元格有没有值，都要执行检查。

## 许可证

MIT

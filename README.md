# XLSX Exporter

一个强大的 Excel 文件转换工具，支持将 Excel 文件转换为多种编程语言的配置文件和数据文件。

## 功能特性

- 📊 **Excel 解析** - 支持解析.xlsx 格式的 Excel 文件
- 🔄 **多语言输出** - 支持输出 TypeScript、Lua、JSON 等格式
- 🏷️ **类型定义生成** - 自动生成 TypeScript 和 Lua 的类型定义
- ✅ **数据验证** - 内置数据检查器确保数据质量
- 🔧 **可扩展架构** - 支持自定义转换器、检查器和处理器
- 📝 **注释支持** - 保留 Excel 中的注释信息
- 🎯 **配置驱动** - 通过 Excel 表格配置数据结构

## 安装

```bash
npm i
```

## 快速开始

### 1. 准备 Excel 文件

Excel 文件需要按照特定格式组织：

- 第 1 行是配置表格处理器（可选）
- 第 2 行是字段名：id, comment ...
- 第 3 行是数据类型：int, float, string, string? ...
- 第 4 行是导出：x 代表不导出，client 只导客户端，server 只导服务端，不填默认导出双端
- 第 5 行是检查：x 代表不检查，可用的检查器见下面
- 第 6 行是注释

<table style="text-align: center;">
  <tr>
    <td colspan="8" style="text-align: left; background-color: #f0f0f0; font-weight: bold;">@config;@stringify(merge);@typedef</td>
  </tr>
  <tr>
    <th>id</th>
    <th>name</th>
    <th>desc</th>
    <th>positon</th>
    <th>item</th>
    <th>task</th>
    <th>reward</th>
    <th>cond</th>
  </tr>
  <tr>
    <td>int</td>
    <td>string</td>
    <td>string?</td>
    <td>int</td>
    <td>int</td>
    <td>int</td>
    <td>int</td>
    <td>int</td>
  </tr>
  <tr>
    <td>>></td>
    <td>client</td>
    <td>server</td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td>!!!</td>
    <td>@TreeChker</td>
    <td>x</td>
    <td>[0,1,2]</td>
    <td>item#item.id</td>
    <td>task#*.id</td>
    <td>id==reward#*.id<br />@CheckReward</td>
    <td>#level.id</td>
  </tr>
  <tr>
    <td>###</td>
    <td>名字</td>
    <td>描述</td>
    <td>位置</td>
    <td>物品</td>
    <td>任务</td>
    <td>奖励</td>
    <td>条件</td>
  </tr>
  <tr>
    <td>1</td>
    <td>关哥</td>
    <td>大长枪</td>
    <td>1</td>
    <td>{101, 103}</td>
    <td>666</td>
    <td>{id = 3}</td>
    <td>1</td>
  </tr>
  <tr>
    <td>2</td>
    <td>张飞</td>
    <td>大长枪</td>
    <td>1</td>
    <td>101</td>
    <td>{666}</td>
    <td>{id=4}</td>
    <td>{1， 2， 3}</td>
  </tr>
</table>

### 2. 基本用法

```typescript
import * as xlsx from "xlsx-exporter";

// 注册输出适配器
xlsx.registerWriter("client", (path, data, processor) => {
    // 处理客户端输出
});

xlsx.registerWriter("server", (path, data, processor) => {
    // 处理服务端输出
});

// 解析Excel文件
xlsx.parse(["path/to/your/file.xlsx"]);
```

### 3. 完整示例

```typescript
import * as xlsx from "xlsx-exporter";
import { toPascalCase } from "./src/util";

const OUTPUT_DIR = "output";

// 注册客户端输出适配器
xlsx.registerWriter("client", (path, data, processor) => {
    if (processor === "config") {
        // 生成TypeScript配置文件
        const name = toPascalCase(`${xlsx.filename(path)}_${data["!name"]}`);
        const marshal = `export const ${name} = `;
        xlsx.writeFile(
            `${OUTPUT_DIR}/client/config/${name}.ts`,
            xlsx.stringifyTs(data, { indent: 4, marshal })
        );
    } else if (processor === "stringify") {
        // 生成JSON数据文件
        const name = xlsx.filename(path);
        xlsx.writeFile(
            `${OUTPUT_DIR}/client/data/${name}.json`,
            xlsx.stringifyJson(data, { indent: 2 })
        );
    } else if (processor === "typedef") {
        // 生成TypeScript类型定义
        const name = xlsx.filename(path);
        const types = xlsx.generateTsTypedef(path, "client");
        const content = `// AUTO GENERATED, DO NOT MODIFY!\n\n${types}`;
        xlsx.writeFile(`${OUTPUT_DIR}/client/types/${name}.ts`, content);
    }
});

// 注册服务端输出适配器
xlsx.registerWriter("server", (path, data, processor) => {
    if (processor === "config") {
        // 生成Lua配置文件
        const name = `${xlsx.filename(path)}_${data["!name"]}`;
        const marshal = `return `;
        xlsx.writeFile(
            `${OUTPUT_DIR}/server/config/${name}.lua`,
            xlsx.stringifyLua(data, { indent: 4, marshal })
        );
    } else if (processor === "stringify") {
        // 生成Lua数据文件
        const name = xlsx.filename(path);
        const marshal = `return `;
        xlsx.writeFile(
            `${OUTPUT_DIR}/server/data/${name}.lua`,
            xlsx.stringifyLua(data, { indent: 2, marshal })
        );
    } else if (processor === "typedef") {
        // 生成Lua类型定义
        const name = xlsx.filename(path);
        const types = xlsx.generateLuaTypedef(path, "server");
        const content = `-- AUTO GENERATED, DO NOT MODIFY!\n\n${types}`;
        xlsx.writeFile(`${OUTPUT_DIR}/server/types/${name}.lua`, content);
    }
});

// 解析Excel文件
xlsx.parse(["data/item.xlsx", "data/task.xlsx"]);
```

## 支持的数据类型

- `int` - 整数
- `float` - 浮点数
- `string` - 字符串
- `bool` - 布尔值
- `json` - JSON 对象
- `table` - lua 表格数据
- `auto` - 自动类型推断

## 数据验证

### 内置多种数据检查器：

- `size` - 数据大小检查
- `range` - 数值范围检查
- `index` - 索引验证
- `follow` - 依赖关系检查
- `expr` - 表达式验证

### 检查器

- #skill.id
  当前列的值必须在当前表的 `skill` 分页中的 `id` 字段中找到
- battle/battle_skill#skill.id
  当前列的值必须在 `battle_skill` 表的 `skill` 分页中的 `id` 字段中找到
- battle/battle_skill#\*.id
  当前列的值必须在 `battle_skill` 表的任意分页中的 `id` 字段中找到
- battle/battle_skill#skill.id=id
  当前列的子字段 `id` 值必须在 `battle_skill` 表的 `skill` 分页中的 `id` 字段中找到
- value >= 1 && value <= 9
  表达式检查，示例在 recharge.xlsx 的 discount 字段
- [1,2,3,4]
  检查值在不在这个数组内
- @size(10) 表示字段要是 table 属性，而且长度只能为 10
  检查 table 字段的长度
- @follow(field)
  表示当前单元格有没有值要与目标列一致。

### 高级索引检查器

[file]#<sheet|\*>.`<key>`[=$[.`<key>`][&<key=value>]...]]

[] 表示可选项，<> 表示必选项

- #skill.id=$.id
- #\*.id=$.id
- battle_skill#skill.id=$.id
- task#main.type=$.id&#main.branch=3&key2=TASK_TYPE

高级索引检查器带有键值对过滤器，以#sheet开头的，归类到列筛选，其余归类到行筛选，\$ 表示当前单元格的值，\$.id 表示取当前单元格的字段 id 的值，如果当前单元格是数组，则取数组子项的字段 id 的值。一旦有行筛选就表明并不是所有这一列都会参与检查，只有满足所有行筛选项的值才会进行下一步检查。如果有列筛选，就表明筛选到的值所在行，必须也满足所有列筛选项。

### !@checker

所有检查器前缀带 “!”，就表明，不管当前单元格有没有值，都要执行检查。

## 输出格式

### JSON&TS 输出

```typescript
// 配置文件
export const ItemConfig = {
    BAG_TYPE: BagType,
    FIRST_ITEM_UID: 1000000,
    ITEM_TYPE: ItemType,
    QUALITY: QualityType,
}

// 数据文件
{
  "10101": {
    "id": 10101,
    "name": "普通宝箱",
    "quality": 1,
    "stack": 1
  }
}
```

### Lua 输出

```lua
-- 配置文件
return {
    BAG_TYPE = {
        ITEM = 1,
        CHEST = 2,
    },
    FIRST_ITEM_UID = 1000000,
}

-- 数据文件
return {
    ["10101"] = {
        id = 10101,
        name = "普通宝箱",
        quality = 1,
        stack = 1
    }
}
```

## 高级用法

### 自定义类型转换器

```typescript
// 注册自定义类型
xlsx.registerType("custom", (str: string) => {
    // 自定义转换逻辑
    return customConvert(str);
});
```

### 自定义数据检查器

```typescript
// 注册自定义检查器
xlsx.registerChecker("CustomChecker", (...args: string[]) => {
    return (cell, row, field, errors) => {
        // 自定义验证逻辑
        return true;
    };
});
```

### 自定义处理器

```typescript
// 注册自定义处理器
xlsx.registerProcessor(
    "CustomProcessor",
    (workbook, sheet, ...args) => {
        // 自定义处理逻辑
    },
    100
); // 优先级
```

## 开发和调试

运行测试：

```bash
npm run test
```

## 许可证

MIT License

## 支持

如果您遇到问题或有建议，请在 GitHub 上提交 issue。

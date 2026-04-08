import { tableConvertor } from "../src/core/table.js";

const tryParse = (str: string) => {
    try {
        return tableConvertor(str);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        console.error(e.message);
        return null;
    }
};

// 演示 Lua table 解析功能
function testLuaTableParser() {
    console.log("=== Lua Table 解析器测试 ===\n");

    // 测试数组格式
    console.log("1. 数组格式测试:");
    const arrayTests = [
        "{1, 2, 3}",
        '{"hello", "world", "test"}',
        "{1, 'mixed', 3.14, true, false, nil}",
        "{}",
    ];

    arrayTests.forEach((test, index) => {
        console.log(`  测试 ${index + 1}: ${test}`);
        const result = tryParse(test);
        console.log(`  结果:`, JSON.stringify(result, null, 2));
        console.log(`  类型: ${Array.isArray(result) ? "数组" : "对象"}\n`);
    });

    // 测试对象格式
    console.log("2. 对象格式测试:");
    const objectTests = [
        `{name = "张三", age = 25}`,
        `{x = 10, y = 20, z = 30}`,
        `{enabled = true, count = 42, message = "hello"}`,
        `{key1 = "value1", key2 = nil, key3 = false}`,
        `{key1 = "value1", key2 = nil, 3, 4, 5}`,
        `{[201] = "value201", [202] = 202}`,
    ];

    objectTests.forEach((test, index) => {
        console.log(`  测试 ${index + 1}: ${test}`);
        const result = tryParse(test);
        console.log(`  结果:`, JSON.stringify(result, null, 2));
        console.log(`  类型: ${Array.isArray(result) ? "数组" : "对象"}\n`);
    });

    // 测试嵌套结构
    console.log("3. 嵌套结构测试:");
    const nestedTests = [
        `{1, 2, {a = "nested"}}`,
        `{player = {name = "李四", level = 10}, items = {1, 2, 3}}`,
        `{config = {debug = true, timeout = 5000}, data = {"item1", "item2"}}`,
    ];

    nestedTests.forEach((test, index) => {
        console.log(`  测试 ${index + 1}: ${test}`);
        const result = tryParse(test);
        console.log(`  结果:`, JSON.stringify(result, null, 2));
        console.log(`  类型: ${Array.isArray(result) ? "数组" : "对象"}\n`);
    });

    // 测试错误情况
    console.log("4. 错误输入测试:");
    const errorTests = [
        "invalid",
        "{unclosed",
        "not a table",
        "",
        null,
        undefined,
        "{1a}",
        "{'1}",
        "{1a=2}",
        "{'a = 2}",
        "{1a = 2}",
    ];

    errorTests.forEach((test, index) => {
        console.log(`  测试 ${index + 1}: ${test}`);
        const result = tryParse(test as string);
        console.log(`  结果: ${result === null ? "null (解析失败)" : JSON.stringify(result)}\n`);
    });
}

testLuaTableParser();

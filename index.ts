import {
    ExprCheckerParser,
    FollowCheckerParser,
    IndexCheckerParser,
    RangeCheckerParser,
    ReferCheckerParser,
    SheetCheckerParser,
    SizeCheckerParser,
    UniqueCheckerParser,
} from "./src/checker.js";
import {
    boolConvertor,
    floatConvertor,
    intConvertor,
    jsonConvertor,
    stringConvertor,
} from "./src/convertor.js";
import {
    AutoRegisterProcessor,
    CollapseProcessor,
    ColumnProcessor,
    ConfigProcessor,
    DefineProcessor,
    GenTypeProcessor,
    MapProcessor,
    mergeSheet,
    TypedefProcessor,
    TypedefWriteProcessor,
    registerStringify,
    simpleSheet,
    StringifyProcessor,
} from "./src/processor.js";
import { tableConvertor } from "./src/table.js";
import { BuiltinChecker, registerChecker, registerProcessor, registerType } from "./src/xlsx.js";

export * from "./src/checker.js";
export * from "./src/convertor.js";
export * from "./src/indexer.js";
export * from "./src/processor.js";
export * from "./src/stringify.js";
export * from "./src/table.js";
export * from "./src/transform.js";
export * from "./src/typedef.js";
export * from "./src/util.js";
export * from "./src/xlsx.js";
export * from "./src/zod.js";

registerType("auto", intConvertor);
registerType("bool", boolConvertor);
registerType("float", floatConvertor);
registerType("int", intConvertor);
registerType("json", jsonConvertor);
registerType("string", stringConvertor);
registerType("table", tableConvertor);

registerChecker(BuiltinChecker.Expr, ExprCheckerParser);
registerChecker(BuiltinChecker.Follow, FollowCheckerParser);
registerChecker(BuiltinChecker.Index, IndexCheckerParser);
registerChecker(BuiltinChecker.Range, RangeCheckerParser);
registerChecker(BuiltinChecker.Refer, ReferCheckerParser);
registerChecker(BuiltinChecker.Sheet, SheetCheckerParser);
registerChecker(BuiltinChecker.Size, SizeCheckerParser);
registerChecker(BuiltinChecker.Unique, UniqueCheckerParser);

registerProcessor("define", DefineProcessor, { stage: "pre-stringify" });
registerProcessor("config", ConfigProcessor, { stage: "pre-stringify", priority: 800 });
registerProcessor("map", MapProcessor, { stage: "pre-stringify", priority: 800 });
registerProcessor("collapse", CollapseProcessor, { stage: "pre-stringify", priority: 800 });
registerProcessor("column", ColumnProcessor, { stage: "pre-stringify", priority: 800 });
registerProcessor("typedef", TypedefProcessor, { stage: "after-read" });
registerProcessor("typedef-write", TypedefWriteProcessor, {
    stage: "pre-stringify",
    priority: -100,
});
registerProcessor("stringify", StringifyProcessor, {
    stage: "stringify",
    priority: 900,
    required: true,
});
registerProcessor("gen-type", GenTypeProcessor, {
    stage: "stringify",
    priority: 999,
    required: true,
});
registerProcessor("auto-register", AutoRegisterProcessor, {
    required: true,
    stage: "after-read",
    priority: 999,
});

registerStringify("merge", mergeSheet);
registerStringify("simple", simpleSheet);

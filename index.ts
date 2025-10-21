import {
    ExprCheckerParser,
    FollowCheckerParser,
    IndexCheckerParser,
    RangeCheckerParser,
    SheetCheckerParser,
    SizeCheckerParser,
} from "./src/checker";
import {
    boolConvertor,
    floatConvertor,
    intConvertor,
    jsonConvertor,
    stringConvertor,
} from "./src/convertor";
import {
    AutoRegisterProcessor,
    CollapseProcessor,
    ColumnProcessor,
    ConfigProcessor,
    DefineProcessor,
    MapProcessor,
    mergeSheet,
    registerStringify,
    simpleSheet,
    StringifyProcessor,
    TypedefProcessor,
} from "./src/processor";
import { tableConvertor } from "./src/table";
import {
    EXPR_CHECKER,
    INDEX_CHECKER,
    RANGE_CHECKER,
    registerChecker,
    registerProcessor,
    registerType,
    SHEET_CHECKER,
} from "./src/xlsx";

export * from "./src/checker";
export * from "./src/convertor";
export * from "./src/indexer";
export * from "./src/processor";
export * from "./src/stringify";
export * from "./src/table";
export * from "./src/transform";
export * from "./src/typedef";
export * from "./src/util";
export * from "./src/xlsx";

registerType("bool", boolConvertor);
registerType("int", intConvertor);
registerType("auto", intConvertor);
registerType("string", stringConvertor);
registerType("float", floatConvertor);
registerType("json", jsonConvertor);
registerType("table", tableConvertor);

registerChecker("size", SizeCheckerParser);
registerChecker("follow", FollowCheckerParser);
registerChecker(EXPR_CHECKER, ExprCheckerParser);
registerChecker(RANGE_CHECKER, RangeCheckerParser);
registerChecker(INDEX_CHECKER, IndexCheckerParser);
registerChecker(SHEET_CHECKER, SheetCheckerParser);

registerProcessor("define", DefineProcessor, { stage: "pre-stringify" });
registerProcessor("config", ConfigProcessor, { stage: "pre-stringify", priority: 800 });
registerProcessor("map", MapProcessor, { stage: "pre-stringify", priority: 800 });
registerProcessor("collapse", CollapseProcessor, { stage: "pre-stringify", priority: 800 });
registerProcessor("column", ColumnProcessor, { stage: "pre-stringify", priority: 800 });
registerProcessor("stringify", StringifyProcessor, {
    stage: "stringify",
    priority: 900,
    required: true,
});
registerProcessor("typedef", TypedefProcessor, {
    stage: "stringify",
    priority: 999,
    required: true,
});
registerProcessor("auto-register", AutoRegisterProcessor, { required: true, stage: "after-read" });

registerStringify("merge", mergeSheet);
registerStringify("simple", simpleSheet);

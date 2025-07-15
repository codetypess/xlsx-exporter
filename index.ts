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
    ConfigProcessor,
    DefineProcessor,
    FoldProcessor,
    MapProcessor,
    mergeSheet,
    registerStringifyRule,
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
export * from "./src/processor";
export * from "./src/stringify";
export * from "./src/table";
export * from "./src/transform";
export * from "./src/typedef";
export * from "./src/util";
export * from "./src/xlsx";

registerType("bool", boolConvertor);
registerType("int", intConvertor);
registerType("auto", "int", intConvertor);
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

registerProcessor("define", DefineProcessor);
registerProcessor("config", ConfigProcessor, 800);
registerProcessor("map", MapProcessor, 800);
registerProcessor("fold", FoldProcessor, 800);
registerProcessor("stringify", StringifyProcessor, 900, true);
registerProcessor("typedef", TypedefProcessor, 999, true);

registerStringifyRule("merge", mergeSheet);
registerStringifyRule("simple", simpleSheet);

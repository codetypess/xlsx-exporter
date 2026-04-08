import {
    ExprCheckerParser,
    FollowCheckerParser,
    IndexCheckerParser,
    RangeCheckerParser,
    ReferCheckerParser,
    SheetCheckerParser,
    SizeCheckerParser,
    UniqueCheckerParser,
} from "../builtins/checkers.js";
import {
    boolConvertor,
    floatConvertor,
    intConvertor,
    jsonConvertor,
    stringConvertor,
} from "../builtins/convertors.js";
import {
    AutoRegisterProcessor,
    CollapseProcessor,
    ColumnProcessor,
    ConfigProcessor,
    DefineProcessor,
    GenTypeProcessor,
    MapProcessor,
    mergeSheet,
    registerStringify,
    simpleSheet,
    StringifyProcessor,
    TypedefProcessor,
    TypedefWriteProcessor,
} from "../builtins/processors.js";
import { BuiltinChecker } from "../core/contracts.js";
import { registerChecker, registerProcessor, registerType } from "../core/registry.js";
import { tableConvertor } from "../core/table.js";

let registered = false;

export const registerBuiltins = () => {
    if (registered) {
        return;
    }
    registered = true;

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
};

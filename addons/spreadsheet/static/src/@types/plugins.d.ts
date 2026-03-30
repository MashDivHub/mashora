declare module "@spreadsheet" {
    import { CommandResult, CorePlugin, UIPlugin } from "@mashora/o-spreadsheet";
    import { CommandResult as CR } from "@spreadsheet/o_spreadsheet/cancelled_reason";
    type MashoraCommandResult = CommandResult | typeof CR;

    export interface MashoraCorePlugin extends CorePlugin {
        getters: MashoraCoreGetters;
        dispatch: MashoraCoreDispatch;
        allowDispatch(command: AllCoreCommand): string | string[];
        beforeHandle(command: AllCoreCommand): void;
        handle(command: AllCoreCommand): void;
    }

    export interface MashoraCorePluginConstructor {
        new (config: unknown): MashoraCorePlugin;
    }

    export interface MashoraUIPlugin extends UIPlugin {
        getters: MashoraGetters;
        dispatch: MashoraDispatch;
        allowDispatch(command: AllCommand): string | string[];
        beforeHandle(command: AllCommand): void;
        handle(command: AllCommand): void;
    }

    export interface MashoraUIPluginConstructor {
        new (config: unknown): MashoraUIPlugin;
    }
}

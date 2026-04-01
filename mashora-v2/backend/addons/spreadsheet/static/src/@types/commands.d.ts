import { FieldMatching } from "./global_filter.d";
import {
    CorePlugin,
    UIPlugin,
    DispatchResult,
    CommandResult,
    AddPivotCommand,
    UpdatePivotCommand,
    CancelledReason,
} from "@mashora/o-spreadsheet";
import * as MashoraCancelledReason from "@spreadsheet/o_spreadsheet/cancelled_reason";

type CoreDispatch = CorePlugin["dispatch"];
type UIDispatch = UIPlugin["dispatch"];
type CoreCommand = Parameters<CorePlugin["allowDispatch"]>[0];
type Command = Parameters<UIPlugin["allowDispatch"]>[0];

// TODO look for a way to remove this and use the real import * as MashoraCancelledReason
type MashoraCancelledReason = string;

declare module "@spreadsheet" {
    interface MashoraCommandDispatcher {
        dispatch<T extends MashoraCommandTypes, C extends Extract<MashoraCommand, { type: T }>>(
            type: {} extends Omit<C, "type"> ? T : never
        ): MashoraDispatchResult;
        dispatch<T extends MashoraCommandTypes, C extends Extract<MashoraCommand, { type: T }>>(
            type: T,
            r: Omit<C, "type">
        ): MashoraDispatchResult;
    }

    interface MashoraCoreCommandDispatcher {
        dispatch<T extends MashoraCoreCommandTypes, C extends Extract<MashoraCoreCommand, { type: T }>>(
            type: {} extends Omit<C, "type"> ? T : never
        ): MashoraDispatchResult;
        dispatch<T extends MashoraCoreCommandTypes, C extends Extract<MashoraCoreCommand, { type: T }>>(
            type: T,
            r: Omit<C, "type">
        ): MashoraDispatchResult;
    }

    interface MashoraDispatchResult extends DispatchResult {
        readonly reasons: (CancelledReason | MashoraCancelledReason)[];
        isCancelledBecause(reason: CancelledReason | MashoraCancelledReason): boolean;
    }

    type MashoraCommandTypes = MashoraCommand["type"];
    type MashoraCoreCommandTypes = MashoraCoreCommand["type"];

    type MashoraDispatch = UIDispatch & MashoraCommandDispatcher["dispatch"];
    type MashoraCoreDispatch = CoreDispatch & MashoraCoreCommandDispatcher["dispatch"];

    // CORE

    export interface ExtendedAddPivotCommand extends AddPivotCommand {
        pivot: ExtendedPivotCoreDefinition;
    }

    export interface ExtendedUpdatePivotCommand extends UpdatePivotCommand {
        pivot: ExtendedPivotCoreDefinition;
    }

    export interface AddThreadCommand {
        type: "ADD_COMMENT_THREAD";
        threadId: number;
        sheetId: string;
        col: number;
        row: number;
    }

    export interface EditThreadCommand {
        type: "EDIT_COMMENT_THREAD";
        threadId: number;
        sheetId: string;
        col: number;
        row: number;
        isResolved: boolean;
    }

    export interface DeleteThreadCommand {
        type: "DELETE_COMMENT_THREAD";
        threadId: number;
        sheetId: string;
        col: number;
        row: number;
    }

    // this command is deprecated. use UPDATE_PIVOT instead
    export interface UpdatePivotDomainCommand {
        type: "UPDATE_MASHORA_PIVOT_DOMAIN";
        pivotId: string;
        domain: Array;
    }

    export interface AddGlobalFilterCommand {
        type: "ADD_GLOBAL_FILTER";
        filter: CmdGlobalFilter;
        [string]: any; // Fields matching
    }

    export interface EditGlobalFilterCommand {
        type: "EDIT_GLOBAL_FILTER";
        filter: CmdGlobalFilter;
        [string]: any; // Fields matching
    }

    export interface RemoveGlobalFilterCommand {
        type: "REMOVE_GLOBAL_FILTER";
        id: string;
    }

    export interface MoveGlobalFilterCommand {
        type: "MOVE_GLOBAL_FILTER";
        id: string;
        delta: number;
    }

    // UI

    export interface RefreshAllDataSourcesCommand {
        type: "REFRESH_ALL_DATA_SOURCES";
    }

    export interface SetGlobalFilterValueCommand {
        type: "SET_GLOBAL_FILTER_VALUE";
        id: string;
        value: any;
    }

    export interface SetManyGlobalFilterValueCommand {
        type: "SET_MANY_GLOBAL_FILTER_VALUE";
        filters: { filterId: string; value: any }[];
    }

    type MashoraCoreCommand =
        | ExtendedAddPivotCommand
        | ExtendedUpdatePivotCommand
        | UpdatePivotDomainCommand
        | AddThreadCommand
        | DeleteThreadCommand
        | EditThreadCommand
        | AddGlobalFilterCommand
        | EditGlobalFilterCommand
        | RemoveGlobalFilterCommand
        | MoveGlobalFilterCommand;

    export type AllCoreCommand = MashoraCoreCommand | CoreCommand;

    type MashoraLocalCommand =
        | RefreshAllDataSourcesCommand
        | SetGlobalFilterValueCommand
        | SetManyGlobalFilterValueCommand;

    type MashoraCommand = MashoraCoreCommand | MashoraLocalCommand;

    export type AllCommand = MashoraCommand | Command;
}

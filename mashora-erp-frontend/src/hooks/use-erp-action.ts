import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collectFieldNamesFromParsedViews,
  parseFormView,
  parseKanbanView,
  parseListView,
  type ParsedFormView,
  type ParsedKanbanView,
  type ParsedListView,
  type SupportedViewMode,
} from '@/lib/erp-view'
import {
  getPrimaryViewMode,
  getSupportedViewModes,
  loadAction,
  type ErpAction,
} from '@/services/erp/actions'
import type { ErpMenu } from '@/services/erp/menus'
import {
  loadViews,
  normalizeDomain,
  readRecords,
  searchCount,
  searchRead,
  type ErpFieldDefinition,
  type ErpRecord,
  writeRecord,
} from '@/services/erp/views'

interface ActionState {
  loading: boolean
  saving: boolean
  error: string | null
  action: ErpAction | null
  fields: Record<string, ErpFieldDefinition>
  records: ErpRecord[]
  totalRecords: number
  selectedRecord: ErpRecord | null
  currentView: SupportedViewMode
  availableViews: SupportedViewMode[]
  parsedList: ParsedListView | null
  parsedKanban: ParsedKanbanView | null
  parsedForm: ParsedFormView | null
  context: Record<string, unknown> | string
  domain: unknown[] | string
}

const initialState: ActionState = {
  loading: false,
  saving: false,
  error: null,
  action: null,
  fields: {},
  records: [],
  totalRecords: 0,
  selectedRecord: null,
  currentView: 'list',
  availableViews: [],
  parsedList: null,
  parsedKanban: null,
  parsedForm: null,
  context: {},
  domain: [],
}

export function useErpAction(menu: ErpMenu | undefined) {
  const [state, setState] = useState<ActionState>(initialState)
  const [reloadKey, setReloadKey] = useState(0)

  const formFieldNames = useMemo(
    () => collectFieldNamesFromParsedViews(state.parsedForm).filter((name) => name !== 'id'),
    [state.parsedForm]
  )

  useEffect(() => {
    const actionId = typeof menu?.actionID === 'number' ? menu.actionID : null

    if (!actionId) {
      setState(initialState)
      return
    }

    let isCancelled = false

    async function bootstrapAction() {
      if (actionId === null) {
        return
      }

      setState((previous) => ({
        ...previous,
        loading: true,
        error: null,
      }))

      try {
        const action = await loadAction(actionId)
        const availableViews = getSupportedViewModes(action)
        const currentView = getPrimaryViewMode(action)

        if (!action.res_model || !availableViews.length) {
          if (!isCancelled) {
            setState({
              ...initialState,
              action,
              loading: false,
              availableViews,
              currentView,
              context: action.context || {},
              domain: action.domain || [],
            })
          }
          return
        }

        const viewMap = action.views.filter(([, viewType]) =>
          ['tree', 'list', 'kanban', 'form'].includes(viewType)
        )

        const viewDescriptions = await loadViews({
          resModel: action.res_model,
          views: viewMap,
          context: action.context,
          actionId: typeof action.id === 'number' ? action.id : false,
        })

        const parsedList =
          viewDescriptions.views.tree?.arch || viewDescriptions.views.list?.arch
            ? parseListView(
                viewDescriptions.views.tree?.arch || viewDescriptions.views.list?.arch || '',
                viewDescriptions.fields
              )
            : null

        const parsedKanban = viewDescriptions.views.kanban?.arch
          ? parseKanbanView(viewDescriptions.views.kanban.arch, viewDescriptions.fields)
          : null

        const parsedForm = viewDescriptions.views.form?.arch
          ? parseFormView(viewDescriptions.views.form.arch, viewDescriptions.fields)
          : null

        const fieldNames = collectFieldNamesFromParsedViews(parsedList, parsedKanban, parsedForm).filter(
          (name) => name !== 'id'
        )

        const records = await searchRead({
          model: action.res_model,
          domain: action.domain,
          context: action.context,
          fields: fieldNames.length ? fieldNames : ['display_name'],
          limit: typeof action.limit === 'number' ? action.limit : 24,
        })

        const totalRecords = await searchCount({
          model: action.res_model,
          domain: action.domain,
          context: action.context,
        }).catch(() => records.length)

        const resolvedFormFieldNames = collectFieldNamesFromParsedViews(parsedForm).filter((name) => name !== 'id')

        let selectedRecord: ErpRecord | null = records[0] || null
        const firstRecordId = records[0]?.id
        if (firstRecordId && resolvedFormFieldNames.length) {
          const [record] = await readRecords({
            model: action.res_model,
            ids: [firstRecordId],
            fields: resolvedFormFieldNames,
            context: action.context,
          })
          selectedRecord = record || records[0]
        }

        if (!isCancelled) {
          setState({
            loading: false,
            saving: false,
            error: null,
            action,
            fields: viewDescriptions.fields,
            records,
            totalRecords,
            selectedRecord,
            currentView,
            availableViews,
            parsedList,
            parsedKanban,
            parsedForm,
            context: action.context || {},
            domain: action.domain || [],
          })
        }
      } catch (reason) {
        if (!isCancelled) {
          setState({
            ...initialState,
            loading: false,
            error: reason instanceof Error ? reason.message : 'Unable to load this ERP action.',
          })
        }
      }
    }

    void bootstrapAction()

    return () => {
      isCancelled = true
    }
  }, [menu?.actionID, reloadKey])

  const setCurrentView = useCallback((view: SupportedViewMode) => {
    setState((previous) => ({
      ...previous,
      currentView: view,
    }))
  }, [])

  const selectRecord = useCallback(
    async (recordId: number) => {
      if (!state.action?.res_model) {
        return
      }

      const snapshot = state.records.find((record) => record.id === recordId) || null
      setState((previous) => ({
        ...previous,
        selectedRecord: snapshot,
      }))

      if (!formFieldNames.length) {
        return
      }

      const [record] = await readRecords({
        model: state.action.res_model,
        ids: [recordId],
        fields: formFieldNames,
        context: state.context,
      })

      if (record) {
        setState((previous) => ({
          ...previous,
          selectedRecord: record,
        }))
      }
    },
    [formFieldNames, state.action?.res_model, state.context, state.records]
  )

  const saveSelectedRecord = useCallback(
    async (values: Record<string, unknown>) => {
      if (!state.action?.res_model || !state.selectedRecord?.id || !Object.keys(values).length) {
        return false
      }

      setState((previous) => ({ ...previous, saving: true, error: null }))
      try {
        await writeRecord({
          model: state.action.res_model,
          ids: [state.selectedRecord.id],
          values,
          context: state.context,
        })

        const [record] = await readRecords({
          model: state.action.res_model,
          ids: [state.selectedRecord.id],
          fields: formFieldNames,
          context: state.context,
        })

        setState((previous) => ({
          ...previous,
          saving: false,
          selectedRecord: record || previous.selectedRecord,
          records: previous.records.map((item) =>
            item.id === state.selectedRecord?.id ? ({ ...item, ...(record || values) } as ErpRecord) : item
          ),
        }))
        return true
      } catch (reason) {
        setState((previous) => ({
          ...previous,
          saving: false,
          error: reason instanceof Error ? reason.message : 'Unable to save this record.',
        }))
        return false
      }
    },
    [formFieldNames, state.action?.res_model, state.context, state.selectedRecord]
  )

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1)
  }, [])

  return {
    ...state,
    normalizedDomain: normalizeDomain(state.domain),
    setCurrentView,
    selectRecord,
    saveSelectedRecord,
    reload,
  }
}

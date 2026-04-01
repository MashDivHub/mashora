import { useEffect, useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ErpActionView } from '@/components/erp/erp-action-view'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { AppTopbar } from '@/components/shell/app-topbar'
import {
  CommandPalette,
  type CommandPaletteItem,
} from '@/components/shell/command-palette'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useErpAction } from '@/hooks/use-erp-action'
import { useErpMenus } from '@/hooks/use-erp-menus'
import { useErpSession } from '@/hooks/use-erp-session'
import {
  findFirstActionableMenu,
  flattenActionableMenus,
  getMenu,
  getMenuTrail,
} from '@/services/erp/menus'
import { useShellStore } from '@/store/shell-store'

function LoadingWorkspace() {
  return (
    <div className="min-h-screen p-4">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <Skeleton className="h-20 rounded-[28px]" />
        <Skeleton className="h-[620px] rounded-[28px]" />
      </div>
    </div>
  )
}

export function WorkspacePage() {
  const navigate = useNavigate()
  const params = useParams()
  const menuId = params.menuId ? Number(params.menuId) : undefined
  const { status, session, logout } = useErpSession()
  const { menus, loading: menusLoading, error: menusError } = useErpMenus(status === 'authenticated')
  const commandOpen = useShellStore((state) => state.commandOpen)
  const mobileSidebarOpen = useShellStore((state) => state.mobileSidebarOpen)
  const setCommandOpen = useShellStore((state) => state.setCommandOpen)
  const setMobileSidebarOpen = useShellStore((state) => state.setMobileSidebarOpen)

  const selectedMenu = menus ? getMenu(menus, menuId) : undefined

  useEffect(() => {
    if (!menus) {
      return
    }
    if (selectedMenu?.actionID) {
      return
    }
    const fallbackMenu = findFirstActionableMenu(menus, menuId)
    if (fallbackMenu) {
      navigate(`/app/${fallbackMenu.id}`, { replace: true })
    }
  }, [menuId, menus, navigate, selectedMenu?.actionID])

  const actionState = useErpAction(selectedMenu)

  const commandItems = useMemo<CommandPaletteItem[]>(() => {
    if (!menus) {
      return []
    }
    return flattenActionableMenus(menus).map(({ menu, app }) => ({
      id: menu.id,
      label: menu.name,
      description: menu.actionID ? `Action ${menu.actionID} in ${app.name}` : app.name,
      section: app.name,
    }))
  }, [menus])

  if (status === 'loading' || status === 'idle') {
    return <LoadingWorkspace />
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />
  }

  if (menusLoading || !menus) {
    return <LoadingWorkspace />
  }

  const menuTrail = getMenuTrail(menus, selectedMenu?.id)

  return (
    <div className="min-h-screen p-4 lg:pl-[332px]">
      <AppSidebar
        menus={menus}
        currentMenuId={selectedMenu?.id}
        mobileOpen={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
        onNavigate={(targetMenuId) => navigate(`/app/${targetMenuId}`)}
      />

      <div className="mx-auto max-w-[1500px] space-y-6">
        <AppTopbar
          menuTrail={menuTrail}
          action={actionState.action}
          userName={session?.name}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          onOpenCommand={() => setCommandOpen(true)}
          onLogout={() => {
            void logout().then(() => navigate('/login', { replace: true }))
          }}
        />

        {menusError ? (
          <Card>
            <CardHeader>
              <CardTitle>Menus failed to load</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{menusError}</CardContent>
          </Card>
        ) : null}

        <ErpActionView
          action={actionState.action}
          loading={actionState.loading}
          saving={actionState.saving}
          error={actionState.error}
          fields={actionState.fields}
          records={actionState.records}
          totalRecords={actionState.totalRecords}
          selectedRecord={actionState.selectedRecord}
          currentView={actionState.currentView}
          availableViews={actionState.availableViews}
          parsedList={actionState.parsedList}
          parsedKanban={actionState.parsedKanban}
          parsedForm={actionState.parsedForm}
          normalizedDomain={actionState.normalizedDomain}
          onSelectRecord={actionState.selectRecord}
          onChangeView={actionState.setCurrentView}
          onSaveRecord={actionState.saveSelectedRecord}
          onReload={actionState.reload}
        />
      </div>

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        items={commandItems}
        onSelect={(item) => navigate(`/app/${item.id}`)}
      />
    </div>
  )
}

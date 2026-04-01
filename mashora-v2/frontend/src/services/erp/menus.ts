import { getJson } from '@/services/erp/client'

export interface ErpMenu {
  id: number
  name: string
  actionID: number | false
  actionPath?: string
  appID: number
  children: number[]
  webIconData?: string
  xmlid?: string
}

interface RootMenu {
  children: number[]
  name?: string
}

export type ErpMenuCollection = Record<string, ErpMenu | RootMenu>

export async function loadMenus() {
  return getJson<ErpMenuCollection>('/web/webclient/load_menus')
}

export function getRootMenu(menus: ErpMenuCollection) {
  return (menus.root || { children: [] }) as RootMenu
}

export function getMenu(menus: ErpMenuCollection, id?: number | null) {
  if (!id) {
    return undefined
  }
  return menus[String(id)] as ErpMenu | undefined
}

export function getApps(menus: ErpMenuCollection) {
  return getRootMenu(menus).children
    .map((childId) => getMenu(menus, childId))
    .filter((menu): menu is ErpMenu => Boolean(menu))
}

export function findParentMenu(menus: ErpMenuCollection, childId: number) {
  for (const menu of Object.values(menus)) {
    if ('children' in menu && menu.children.includes(childId)) {
      return 'id' in menu ? (menu as ErpMenu) : undefined
    }
  }
  return undefined
}

export function getMenuTrail(menus: ErpMenuCollection, menuId?: number | null) {
  const trail: ErpMenu[] = []
  let current = getMenu(menus, menuId)

  while (current) {
    trail.unshift(current)
    current = findParentMenu(menus, current.id)
  }

  return trail
}

export function getCurrentApp(menus: ErpMenuCollection, menuId?: number | null) {
  const menu = getMenu(menus, menuId)
  if (!menu) {
    return undefined
  }
  return getMenu(menus, menu.appID) || menu
}

export function flattenActionableMenus(menus: ErpMenuCollection) {
  const apps = getApps(menus)
  const items: Array<{ menu: ErpMenu; app: ErpMenu }> = []

  const visit = (app: ErpMenu, menu: ErpMenu) => {
    if (menu.actionID) {
      items.push({ menu, app })
    }
    menu.children
      .map((childId) => getMenu(menus, childId))
      .filter((child): child is ErpMenu => Boolean(child))
      .forEach((child) => visit(app, child))
  }

  apps.forEach((app) => visit(app, app))
  return items
}

export function findFirstActionableMenu(menus: ErpMenuCollection, startingMenuId?: number | null) {
  const queue: ErpMenu[] = []
  const startingMenu = getMenu(menus, startingMenuId)
  if (startingMenu) {
    queue.push(startingMenu)
  } else {
    queue.push(...getApps(menus))
  }

  const seen = new Set<number>()

  while (queue.length) {
    const current = queue.shift()
    if (!current || seen.has(current.id)) {
      continue
    }
    seen.add(current.id)
    if (current.actionID) {
      return current
    }
    current.children
      .map((childId) => getMenu(menus, childId))
      .filter((child): child is ErpMenu => Boolean(child))
      .forEach((child) => queue.push(child))
  }

  return undefined
}

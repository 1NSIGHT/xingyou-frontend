import { request } from '@/api/request'

/**
 * 菜单节点，与后端 PlatformMenus.Node 对应。
 *
 * ★ 菜单树来自后端，前端不再自己写一份。
 *   两份菜单定义是这类系统最常见的不一致来源：后端拦了、前端没藏，
 *   或者反过来，用户点进去吃一个 403。
 */
export interface MenuNode {
  key: string
  title: string
  path: string
  icon: string
  /** 是否可单独授权。分组为 false —— 它由子项自动决定是否显示 */
  grantable: boolean
  children: MenuNode[]
}

export interface MyMenus {
  menus: MenuNode[]
  /**
   * 树里出现过的全部 key（含分组）。
   *
   * ★ 路由守卫用它，而不是前端自己遍历树推 —— 那是"两处实现同一规则"，
   *   迟早会不一致。
   */
  keys: string[]
}

/** 当前用户的菜单。侧边栏与路由守卫的数据来源 */
export function getMyMenusApi() {
  return request<MyMenus>({ url: '/system/menu/mine', method: 'get' })
}

/** 全量菜单树 —— 角色授权界面的勾选树（限管理员） */
export function getAllMenusApi() {
  return request<MenuNode[]>({ url: '/system/menu/all', method: 'get' })
}

export function getRoleMenusApi(roleId: number) {
  return request<string[]>({ url: `/system/menu/role/${roleId}`, method: 'get' })
}

/** 覆盖式设置。传进去的 key 集合就是最终结果 */
export function setRoleMenusApi(roleId: number, menuKeys: string[]) {
  return request<void>({ url: `/system/menu/role/${roleId}`, method: 'put', data: { menuKeys } })
}

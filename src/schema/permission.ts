/**
 * 字段访问判定（规范 3.7 / 3.7.1）—— 后端 `FieldPermission` 与 `FieldDef` 的前端对应物。
 *
 * ★ 这里与后端是**两份实现**，必须逐条一致。这是一个已知的漂移风险，
 *   与条件求值器当初的情况相同 —— 那次是靠共享测试向量解决的（见 condition.ts）。
 *   **本模块应当尽快补上同样的护栏**，在那之前，改动此处必须同时改
 *   `FieldPermission.java` 与 `FieldDef.java` 里的同名方法。
 *
 * 为什么前端还要判一遍：后端已经按权限裁剪了**值**（HIDDEN 的字段连值都不返回），
 * 但 schema 是完整下发的，前端需要知道"哪些字段该画、哪些只读"，
 * 否则会画出用户改不了的输入框。
 */
import type { FieldDef, FieldPermission } from './types'

/** 字段访问级别，与后端 FieldAccess 对应 */
export type FieldAccess = 'HIDDEN' | 'READ' | 'WRITE'

/** 通配符：所有能访问该单据的角色 */
export const WILDCARD = '*'

/**
 * 角色 → 访问级别。
 *
 * 规则（与 FieldPermission.resolve 逐条对应）：
 *   1. 未声明 permission → 全开（WRITE）
 *   2. 无任何角色 → HIDDEN（默认拒绝）
 *   3. hidden 优先，含通配符
 *   4. 多角色取最高：任一角色可写即可写
 *   5. 都不在 → HIDDEN
 */
export function resolveAccess(
  permission: FieldPermission | undefined,
  roles: readonly string[],
): FieldAccess {
  if (!permission) return 'WRITE'
  if (!roles || roles.length === 0) return 'HIDDEN'

  const hit = (declared?: string[]) =>
    !!declared && (declared.includes(WILDCARD) || declared.some((r) => roles.includes(r)))

  if (hit(permission.hidden)) return 'HIDDEN'
  if (hit(permission.write)) return 'WRITE'
  if (hit(permission.read)) return 'READ'
  return 'HIDDEN'
}

/**
 * 节点门（规范 3.7.1）。
 *
 * ★ 未声明 → 放行；`nodeKey` 为 null（不走流程）→ **一律放行**。
 *   "不生效"的含义是**退化为原语义**，不是"约束取消" ——
 *   这一点在后端踩过一次（`isRequiredAtNode` 第一版返回了 false，
 *   会让带 requiredNodes 的表单一旦不挂流程就所有必填静默失效）。
 */
export function nodeAllows(nodes: string[] | undefined, nodeKey: string | null): boolean {
  if (!nodes || nodes.length === 0) return true
  if (!nodeKey) return true
  return nodes.includes(nodeKey)
}

/** 此刻是否可写：角色维度 ∧ 节点维度 */
export function isWritable(field: FieldDef, roles: readonly string[], nodeKey: string | null): boolean {
  return resolveAccess(field.permission, roles) === 'WRITE' && nodeAllows(field.writeNodes, nodeKey)
}

/** 此刻是否可见：角色维度 ∧ 节点维度（条件显隐由调用方另行求值） */
export function isFieldVisible(field: FieldDef, roles: readonly string[], nodeKey: string | null): boolean {
  return resolveAccess(field.permission, roles) !== 'HIDDEN' && nodeAllows(field.visibleNodes, nodeKey)
}

/** 此刻是否必填。声明了 requiredNodes 且处于某个节点时完全由它决定，否则沿用 required */
export function isRequiredAtNode(field: FieldDef, nodeKey: string | null): boolean {
  if (field.requiredNodes && field.requiredNodes.length > 0 && nodeKey) {
    return field.requiredNodes.includes(nodeKey)
  }
  return field.required === true
}

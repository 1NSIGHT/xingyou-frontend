import type { FieldCategory, FieldType, ValueType } from './types'

/**
 * 字段类型清单 —— 前端侧。
 *
 * ★★ 这里的每一项都必须与下面两处完全一致：
 *   1. 后端 `src/main/resources/schema/field-types.catalog.json`（权威目录）
 *   2. 后端 `com.xingyou.modules.meta.enums.FieldType` 枚举
 *
 * 校验方式：
 *   node scripts/check-field-types.mjs
 * 它会读取后端那份目录文件并与本文件逐字段比对，不一致直接失败。
 * 后端也有对应的 `FieldTypeCatalogTest` 做同样的事。
 *
 * 为什么需要这个护栏：类型清单漂移的后果是
 * **前端按 number 提交、后端按 string 存储** —— 数据静默变形，
 * 等发现时已经脏了，且无法回溯修复。
 */
export interface FieldTypeDef {
  code: FieldType
  label: string
  category: FieldCategory
  /** 默认存储类型 */
  valueType: ValueType
  /** 多态类型的「多选」存储类型；不填表示非多态 */
  multipleValueType?: ValueType
  /** 是否允许声明 indexable */
  indexableAllowed: boolean
  /** 是否必须提供 dataSource */
  dataSourceRequired: boolean
  /** 是否存储值（纯布局元素不存） */
  hasValue: boolean
  /** 是否属于首批实现 */
  firstBatch: boolean
}

export const FIELD_TYPES: FieldTypeDef[] = [
  // ---------------------------------------------------------------- 基础
  { code: 'text', label: '单行文本', category: 'BASIC', valueType: 'string', indexableAllowed: true, dataSourceRequired: false, hasValue: true, firstBatch: true },
  { code: 'textarea', label: '多行文本', category: 'BASIC', valueType: 'string', indexableAllowed: true, dataSourceRequired: false, hasValue: true, firstBatch: true },

  // ---------------------------------------------------------------- 数值
  { code: 'number', label: '数字', category: 'NUMBER', valueType: 'number', indexableAllowed: true, dataSourceRequired: false, hasValue: true, firstBatch: true },
  { code: 'amount', label: '金额', category: 'NUMBER', valueType: 'number', indexableAllowed: true, dataSourceRequired: false, hasValue: true, firstBatch: true },

  // ---------------------------------------------------------------- 日期
  // 存 ISO 文本而非 timestamp：PostgreSQL 的 date_in 是 STABLE，
  // ::date 无法用于生成列（规范铁律 5）
  { code: 'date', label: '日期', category: 'DATE', valueType: 'string', indexableAllowed: true, dataSourceRequired: false, hasValue: true, firstBatch: true },
  { code: 'datetime', label: '日期时间', category: 'DATE', valueType: 'string', indexableAllowed: true, dataSourceRequired: false, hasValue: true, firstBatch: true },
  { code: 'dateRange', label: '日期区间', category: 'DATE', valueType: 'array', indexableAllowed: false, dataSourceRequired: false, hasValue: true, firstBatch: true },

  // ---------------------------------------------------------------- 选择
  { code: 'select', label: '下拉选择', category: 'CHOICE', valueType: 'string', indexableAllowed: true, dataSourceRequired: true, hasValue: true, firstBatch: true },
  { code: 'radio', label: '单选按钮', category: 'CHOICE', valueType: 'string', indexableAllowed: true, dataSourceRequired: true, hasValue: true, firstBatch: true },
  { code: 'multiSelect', label: '多选', category: 'CHOICE', valueType: 'array', indexableAllowed: false, dataSourceRequired: true, hasValue: true, firstBatch: true },
  { code: 'checkbox', label: '复选框', category: 'CHOICE', valueType: 'array', indexableAllowed: false, dataSourceRequired: true, hasValue: true, firstBatch: true },
  { code: 'switch', label: '开关', category: 'CHOICE', valueType: 'boolean', indexableAllowed: true, dataSourceRequired: false, hasValue: true, firstBatch: true },

  // ---------------------------------------------------------------- 附件
  // 契约先行：数据形态已锁定，但文件服务（MinIO）计划在 M4 落地。
  // 设计器必须提示「当前无法真正上传」，避免做出看起来能填实际传不了的表单。
  { code: 'file', label: '附件', category: 'ATTACHMENT', valueType: 'array', indexableAllowed: false, dataSourceRequired: false, hasValue: true, firstBatch: true },
  { code: 'image', label: '图片', category: 'ATTACHMENT', valueType: 'array', indexableAllowed: false, dataSourceRequired: false, hasValue: true, firstBatch: true },
  { code: 'signature', label: '手写签名', category: 'ATTACHMENT', valueType: 'object', indexableAllowed: false, dataSourceRequired: false, hasValue: true, firstBatch: true },

  // ---------------------------------------------------------------- 人员
  { code: 'userPicker', label: '人员选择', category: 'PERSON', valueType: 'number', multipleValueType: 'array', indexableAllowed: true, dataSourceRequired: false, hasValue: true, firstBatch: true },

  // ---------------------------------------------------------------- 组织
  // 与 userPicker 同构；与「人员」分开是因为两者取值域不同（组织 id 与用户 id 会撞号），
  // 且审批流的 ORG_ROLE 规则需要拿到组织本身才能解析出「该单位的项目负责人」
  { code: 'orgPicker', label: '组织选择', category: 'ORG', valueType: 'number', multipleValueType: 'array', indexableAllowed: true, dataSourceRequired: false, hasValue: true, firstBatch: true },

  // ---------------------------------------------------------------- 布局
  { code: 'divider', label: '分割线', category: 'LAYOUT', valueType: 'none', indexableAllowed: false, dataSourceRequired: false, hasValue: false, firstBatch: true },
  { code: 'section', label: '分组', category: 'LAYOUT', valueType: 'none', indexableAllowed: false, dataSourceRequired: false, hasValue: false, firstBatch: true },

  // ---------------------------------------------------------------- 行业物料
  { code: 'weldJoint', label: '焊口选择', category: 'INDUSTRY', valueType: 'number', indexableAllowed: true, dataSourceRequired: true, hasValue: true, firstBatch: true },
  { code: 'stakeNo', label: '桩号/里程', category: 'INDUSTRY', valueType: 'string', indexableAllowed: true, dataSourceRequired: false, hasValue: true, firstBatch: true },
  { code: 'qcPoint', label: '质量控制点', category: 'INDUSTRY', valueType: 'string', multipleValueType: 'array', indexableAllowed: true, dataSourceRequired: true, hasValue: true, firstBatch: true },
  { code: 'dictTree', label: '字典树', category: 'INDUSTRY', valueType: 'array', indexableAllowed: false, dataSourceRequired: true, hasValue: true, firstBatch: true },
  { code: 'coordinate', label: '坐标拾取', category: 'INDUSTRY', valueType: 'object', indexableAllowed: false, dataSourceRequired: false, hasValue: true, firstBatch: true },
]

/** 后续批次，仅用于设计器展示「敬请期待」，不可发布 */
export const LATER_BATCH_TYPES = ['drawingMark', 'richText', 'table', 'formula'] as const

export const FIELD_CATEGORIES: Array<{ code: FieldCategory; label: string }> = [
  { code: 'BASIC', label: '基础' },
  { code: 'NUMBER', label: '数值' },
  { code: 'DATE', label: '日期' },
  { code: 'CHOICE', label: '选择' },
  { code: 'ATTACHMENT', label: '附件' },
  { code: 'PERSON', label: '人员' },
  { code: 'ORG', label: '组织' },
  { code: 'LAYOUT', label: '布局' },
  { code: 'INDUSTRY', label: '行业' },
]

const FIELD_TYPE_MAP = new Map<string, FieldTypeDef>(FIELD_TYPES.map((t) => [t.code, t]))

/** 按编码取类型定义；未登记返回 undefined（调用方据此拒绝发布，铁律 2） */
export function getFieldType(code: string): FieldTypeDef | undefined {
  return FIELD_TYPE_MAP.get(code)
}

/** 是否为已登记的类型 */
export function isValidFieldType(code: string): boolean {
  return FIELD_TYPE_MAP.has(code)
}

/**
 * 解析字段实际的存储类型。
 *
 * 多态类型（userPicker / qcPoint）由是否多选决定：
 * 单选时存标量（可索引），多选时存数组（不可索引）。
 */
export function resolveValueType(code: string, multiple = false): ValueType | undefined {
  const def = FIELD_TYPE_MAP.get(code)
  if (!def) return undefined
  return multiple && def.multipleValueType ? def.multipleValueType : def.valueType
}

/** 该类型是否允许声明 indexable */
export function isIndexableAllowed(code: string): boolean {
  return FIELD_TYPE_MAP.get(code)?.indexableAllowed ?? false
}

/** 仅能生成数据库生成列的存储类型 */
export const INDEXABLE_VALUE_TYPES: ValueType[] = ['string', 'number', 'boolean']

/** 按分类分组，供设计器左侧物料面板使用 */
export function groupFieldTypesByCategory(): Array<{
  category: FieldCategory
  label: string
  types: FieldTypeDef[]
}> {
  return FIELD_CATEGORIES.map((c) => ({
    category: c.code,
    label: c.label,
    types: FIELD_TYPES.filter((t) => t.category === c.code),
  })).filter((g) => g.types.length > 0)
}

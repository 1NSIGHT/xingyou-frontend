import type { Component } from 'vue'
import type { FieldCategory, FieldDef, FieldType, I18nText } from './types'
import { FIELD_TYPES } from './constants'

/**
 * 物料协议 —— 字段类型如何同时被「设计器」与「渲染器」识别。
 *
 * 一个物料（Material）是一个字段类型的三件套：
 *   ① 拖进画布时的初始 schema
 *   ② 设计器右侧属性面板暴露哪些配置项
 *   ③ 真正渲染它的 Vue 组件
 *
 * 三者放在同一个定义里，是为了避免"设计器里加了个属性但渲染器不认识"这类失配。
 *
 * 新增一个字段类型 = 实现一个 MaterialDefinition 并注册，
 * **不需要改设计器或渲染器的核心代码**。
 */

/** 属性面板里的一项配置 */
export interface PropertyDescriptor {
  /** 属性名。写入位置由 target 决定 */
  key: string
  /** 显示名。多语言，见 I18nText */
  label: I18nText
  editor: 'input' | 'textarea' | 'number' | 'switch' | 'select' | 'dictSelect'
  /** 写入字段顶层属性（如 span）还是 props 里（如 maxlength） */
  target: 'field' | 'props'
  default?: unknown
  /** editor 为 select 时的候选项 */
  options?: Array<{ label: I18nText; value: unknown }>
  /** 提示语 */
  tip?: I18nText
}

export interface MaterialDefinition {
  type: FieldType | string
  label: string
  category: FieldCategory
  /** 图标名（Element Plus 图标） */
  icon: string

  /** 拖入画布时生成的初始字段定义 */
  createDefault: () => Partial<FieldDef>

  /**
   * 设计器属性面板暴露的配置项。
   *
   * ★ 刻意保持精简：业务人员只需要 3~5 项。
   * 属性面板塞 20 项是 amis-editor 那类「面向开发者」设计器的通病，
   * 会让监理工程师望而却步 —— 这是选择自研设计器的主要理由之一。
   */
  configurableProps: PropertyDescriptor[]

  /**
   * 渲染组件。
   *
   * 用函数形式（懒加载）而非直接引用，避免设计器把全部物料的渲染组件
   * 都打进首屏包。
   *
   * TODO(D-Spike)：首批 23 个类型的渲染组件在 D 阶段实现。
   * 在此之前为 undefined —— 协议先立起来，实现逐步补齐。
   */
  renderer?: () => Promise<Component>
}

// ============================================================ 通用属性

/** 所有物料都有的基础配置项 */
const COMMON_PROPS: PropertyDescriptor[] = [
  { key: 'label', label: '标题', editor: 'input', target: 'field' },
  { key: 'required', label: '必填', editor: 'switch', target: 'field', default: false },
  {
    key: 'indexable',
    label: '可作为查询条件',
    editor: 'switch',
    target: 'field',
    default: false,
    tip: '开启后会在数据库生成索引。数量有限，只对常用筛选字段开启。',
  },
  { key: 'placeholder', label: '输入提示', editor: 'input', target: 'field' },
  { key: 'span', label: '宽度', editor: 'select', target: 'field', default: 24,
    options: [
      { label: '整行', value: 24 },
      { label: '半行', value: 12 },
      { label: '三分之一', value: 8 },
    ] },
  { key: 'tip', label: '字段说明', editor: 'input', target: 'field' },
]

/** 选择类物料的通用配置项 */
const CHOICE_PROPS: PropertyDescriptor[] = [
  { key: 'usingDict', label: '使用数据字典', editor: 'dictSelect', target: 'field',
    tip: '选项来源。行业标准枚举请优先使用字典，不要手工录入。' },
]

/** 组合通用属性与类型专属属性 */
function withCommon(extra: PropertyDescriptor[] = []): PropertyDescriptor[] {
  return [...COMMON_PROPS, ...extra]
}

// ============================================================ 注册表

const REGISTRY = new Map<string, MaterialDefinition>()

/** 注册一个物料。同一 type 重复注册会覆盖并告警 */
export function registerMaterial(material: MaterialDefinition): void {
  if (REGISTRY.has(material.type)) {
    console.warn(`[schema] 物料 "${material.type}" 被重复注册，后注册的生效`)
  }
  REGISTRY.set(material.type, material)
}

export function getMaterial(type: string): MaterialDefinition | undefined {
  return REGISTRY.get(type)
}

export function allMaterials(): MaterialDefinition[] {
  return Array.from(REGISTRY.values())
}

/** 按分类分组，供设计器左侧物料面板渲染 */
export function materialsByCategory(): Array<{
  category: FieldCategory
  label: string
  materials: MaterialDefinition[]
}> {
  const order: FieldCategory[] = [
    'BASIC', 'NUMBER', 'DATE', 'CHOICE', 'ATTACHMENT', 'PERSON', 'LAYOUT', 'INDUSTRY',
  ]
  const labels: Record<FieldCategory, string> = {
    BASIC: '基础', NUMBER: '数值', DATE: '日期', CHOICE: '选择',
    ATTACHMENT: '附件', PERSON: '人员', LAYOUT: '布局', INDUSTRY: '行业',
  }

  return order
    .map((category) => ({
      category,
      label: labels[category],
      materials: allMaterials().filter((m) => m.category === category),
    }))
    .filter((g) => g.materials.length > 0)
}

// ============================================================ 基础物料

/**
 * 把字段类型清单里的每个类型转成一个「最小可用」的物料定义。
 *
 * 这样即使某个类型还没写专属渲染组件，设计器里也能拖出来、属性也能配，
 * 只是预览区显示"待实现"。**协议先立起来，实现逐步补齐。**
 */
function baseMaterial(type: (typeof FIELD_TYPES)[number]): MaterialDefinition {
  const extra: PropertyDescriptor[] = []

  if (type.dataSourceRequired) {
    extra.push(...CHOICE_PROPS)
  }
  if (type.multipleValueType) {
    extra.push({ key: 'multiple', label: '允许多选', editor: 'switch', target: 'props', default: false })
  }

  return {
    type: type.code,
    label: type.label,
    category: type.category,
    icon: 'Document',
    createDefault: () => ({
      key: '',
      label: type.label,
      type: type.code,
      required: false,
      span: type.category === 'LAYOUT' ? 24 : 12,
      indexable: false,
    }),
    configurableProps: type.category === 'LAYOUT'
      ? [{ key: 'label', label: '标题', editor: 'input', target: 'field' }]
      : withCommon(extra),
  }
}

/** 注册全部基础物料。应用启动时调用一次 */
export function registerBaseMaterials(): void {
  for (const type of FIELD_TYPES) {
    registerMaterial(baseMaterial(type))
  }
}

// ============================================================ 数据源选择器

/**
 * 数据源选择器 —— 后端 `DataSourceResolver` SPI 的前端对应物。
 *
 * 内核认识 5 种 kind（dict / ledger / form / user / cascade），
 * 行业可注册带命名空间的扩展 kind（如 `industry:device`）。
 *
 * ★ 找不到对应选择器时，渲染器必须**渲染成禁用状态并显示原因**，
 *   而不是留一个点了没反应的输入框 —— 后者会让用户以为是系统卡了。
 */
export interface DataSourceSelectorDefinition {
  /** 与后端 DataSourceResolver.kind() 必须一致 */
  kind: string
  label: I18nText
  /** 选中后回填其它字段时的取值字段，通常为 valueField */
  component: () => Promise<Component>
  /** 该数据源在设计器里需要配置哪些项 */
  configurableProps?: PropertyDescriptor[]
}

const SELECTOR_REGISTRY = new Map<string, DataSourceSelectorDefinition>()

export function registerDataSourceSelector(def: DataSourceSelectorDefinition): void {
  if (SELECTOR_REGISTRY.has(def.kind)) {
    console.warn(`[schema] 数据源选择器 "${def.kind}" 被重复注册，后注册的生效`)
  }
  SELECTOR_REGISTRY.set(def.kind, def)
}

export function getDataSourceSelector(kind: string): DataSourceSelectorDefinition | undefined {
  return SELECTOR_REGISTRY.get(kind)
}

export function allDataSourceSelectors(): DataSourceSelectorDefinition[] {
  return Array.from(SELECTOR_REGISTRY.values())
}

/**
 * 判断 kind 是否为内核种类。
 *
 * 非内核的 kind **必须**带命名空间（含 `:`），见规范 3.4.2。
 * 这个判断同时用于发布校验：既不是内核种类、又没注册解析器的 kind 会被拒绝。
 */
export const KERNEL_DATA_SOURCE_KINDS = ['dict', 'ledger', 'form', 'user', 'cascade'] as const

export function isKernelDataSourceKind(kind: string): boolean {
  return (KERNEL_DATA_SOURCE_KINDS as readonly string[]).includes(kind)
}

/** 扩展 kind 必须形如 `<namespace>:<name>` */
export function isValidExtensionKind(kind: string): boolean {
  return /^[a-z][a-z0-9]*:[a-zA-Z][a-zA-Z0-9]*$/.test(kind)
}

/**
 * 条件表达式求值器（规范 3.6）。
 *
 * ★ 本文件与后端 `com.xingyou.modules.meta.schema.ConditionEvaluator`
 *   **必须逐条语义一致**。两边不一致的后果是「前端看着是隐藏的，提交却被要求必填」，
 *   属于最难排查的一类问题。
 *
 * 护栏：共享测试向量 `xingyou-backend/src/main/resources/schema/condition-vectors.json`
 *   - 后端 `ConditionVectorsTest` 用它验证 Java 实现
 *   - 前端 `scripts/check-condition.mjs` 用它验证本文件
 *   只改一边，必然有一侧失败。
 *
 * 刻意保持简单（规范 3.6）：**不支持任意表达式树、函数调用、跨表单引用**。
 * 一旦放开，前端需要一个表达式引擎、后端需要另一个且必须行为一致，复杂度失控。
 */
import type { Condition } from './types'

/** 未知 op 一律判 false（与后端 `default -> false` 一致） */
export function evaluateCondition(
  condition: Condition | null | undefined,
  values: Record<string, unknown> | null | undefined,
): boolean {
  // 没有条件 = 无条件成立（字段始终可见 / 可编辑）
  if (!condition) return true

  const node = condition as unknown as Record<string, unknown>

  if (Array.isArray(node.and)) {
    // 空 and 视为成立（与后端一致）
    return node.and.every((child) => evaluateCondition(child as Condition, values))
  }
  if (Array.isArray(node.or)) {
    // 空 or 视为不成立（与后端一致）
    return node.or.some((child) => evaluateCondition(child as Condition, values))
  }

  const field = node.field
  const op = node.op
  if (typeof field !== 'string' || typeof op !== 'string') {
    // 结构非法（既不是组合条件也没有 field/op）。发布期的结构自检应当已拒绝它。
    // 这里返回 true 让字段显示出来：**多显示一个字段**比**误隐藏一个有值的字段**容易发现。
    return true
  }

  const actual = values ? values[field] : undefined
  return compare(actual, op, node.value)
}

// ============================================================ 内部实现
//
// 以下函数逐条对应 Java 侧的同名方法，改任意一个都必须同步另一边。

function compare(actual: unknown, op: string, expected: unknown): boolean {
  switch (op) {
    case 'eq':
      return isEqual(actual, expected)
    case 'ne':
      return !isEqual(actual, expected)
    case 'gt':
      return compareOrder(actual, expected) > 0
    case 'gte':
      return compareOrder(actual, expected) >= 0
    case 'lt':
      return compareOrder(actual, expected) < 0
    case 'lte':
      return compareOrder(actual, expected) <= 0
    case 'in':
      return Array.isArray(expected) && containsAny(actual, expected)
    case 'notIn':
      return !(Array.isArray(expected) && containsAny(actual, expected))
    case 'notEmpty':
      return !isEmptyValue(actual)
    default:
      return false
  }
}

function isNullish(value: unknown): boolean {
  return value === null || value === undefined
}

/** 相等判断：先尝试数值比较，退化为字符串比较 */
function isEqual(actual: unknown, expected: unknown): boolean {
  if (isNullish(actual) || isNullish(expected)) {
    return isNullish(actual) && isNullish(expected)
  }
  const a = tryNumber(actual)
  const b = tryNumber(expected)
  if (a !== null && b !== null) return a === b
  return toComparableString(actual) === toComparableString(expected)
}

/**
 * 大小比较。任一侧为 null 返回 0（视为相等，避免误判）。
 *
 * 注意 `>` / `<` 在两侧都是数字时走数值分支，因此不会有 `"10" < "9"` 的字符串序错误 ——
 * 这正是后端刻意加数值分支的原因。
 */
function compareOrder(actual: unknown, expected: unknown): number {
  if (isNullish(actual) || isNullish(expected)) return 0
  const a = tryNumber(actual)
  const b = tryNumber(expected)
  if (a !== null && b !== null) return a < b ? -1 : a > b ? 1 : 0
  const sa = toComparableString(actual)
  const sb = toComparableString(expected)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

/** 数组类字段：只要有一个元素命中即算包含 */
function containsAny(actual: unknown, candidates: unknown[]): boolean {
  if (isNullish(actual)) return false
  if (Array.isArray(actual)) {
    return actual.some((item) => candidates.some((candidate) => isEqual(item, candidate)))
  }
  return candidates.some((candidate) => isEqual(actual, candidate))
}

/**
 * 空值判定。
 *
 * ★ 这里**不能用裸 `trim()`**：JS 的 `trim()` 会去掉不换行空格 U+00A0，
 * 而 Java 的 `String.isBlank()` 把它算作**非空白**。
 * 从 Word / Excel 粘贴的文本里 U+00A0 非常常见，两者不一致会直接导致显隐判断相反。
 * 因此下面按 `Character.isWhitespace` 的定义逐字符判断。
 */
export function isEmptyValue(value: unknown): boolean {
  if (isNullish(value)) return true
  if (typeof value === 'string') return isJavaBlank(value)
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * 等价于 Java `Character.isWhitespace`：
 * Unicode 的 Zs / Zl / Zp 类，但**排除**非断行空格 U+00A0、U+2007、U+202F；
 * 另加 \t \n \u000B \f \r 与 U+001C–U+001F。
 */
const JAVA_WHITESPACE =
  /[\t\n\u000B\f\r\u001C-\u001F\u0020\u1680\u2000-\u2006\u2008-\u200A\u2028\u2029\u205F\u3000]/

function isJavaBlank(text: string): boolean {
  if (text.length === 0) return true
  for (const ch of text) {
    if (!JAVA_WHITESPACE.test(ch)) return false
  }
  return true
}

/**
 * 能解析成数字就返回，否则 null。**布尔不参与数值比较**。
 *
 * ★ 不能用 `Number(value)`：它会把 `true` 变成 1、把 `[]` 变成 0、把 `""` 变成 0、
 *   还会接受 `0x10` 与 `Infinity` —— 这些 Java 的 `BigDecimal` 全部拒绝。
 *   因此这里用正则限定接受集，与 `BigDecimal` 对齐。
 *
 * 已知边界：返回值是 IEEE-754 双精度浮点，`BigDecimal` 是任意精度。
 * 超过 2^53 的整数两侧可能不一致 —— 表单字段的数值（数量、金额）不会触及该范围。
 */
function tryNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const text = value.trim()
    if (text === '') return null
    if (!DECIMAL_LIKE.test(text)) return null
    const parsed = Number(text)
    return Number.isFinite(parsed) ? parsed : null
  }
  // boolean / null / undefined / 数组 / 对象 一律不是数字
  return null
}

/** 与 `new BigDecimal(String)` 的接受集对齐：可选符号、整数或小数、可选指数 */
const DECIMAL_LIKE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/

/**
 * 把值转成用于字符串比较的形态，等价于 Java 的 `String.valueOf`。
 *
 * 数组与对象需要特别处理：Java 的 `List.toString()` 是 `[a, b]`、
 * `Map.toString()` 是 `{k=v}`，而 JS 的 `String([])` 是 `''`、
 * `String({})` 是 `'[object Object]'`。虽然拿数组做 `eq` 比较属于配置错误，
 * 但既然规范要求"两边行为一致"，就必须把错误情形也对齐。
 */
function toComparableString(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => toComparableString(item)).join(', ')}]`
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return `{${entries.map(([k, v]) => `${k}=${toComparableString(v)}`).join(', ')}}`
  }
  return String(value)
}

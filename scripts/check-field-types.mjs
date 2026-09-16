/**
 * 校验前端字段类型清单与后端权威目录是否一致。
 *
 * 用法：
 *   node scripts/check-field-types.mjs [后端目录文件路径]
 *
 * 默认路径假设前后端仓库是同级目录（本项目的工作区结构就是如此）：
 *   <workspace>/xingyou-frontend/scripts/check-field-types.mjs
 *   <workspace>/xingyou-backend/src/main/resources/schema/field-types.catalog.json
 *
 * 后端也有一份等价的 JUnit 测试（FieldTypeCatalogTest），两边同时作为护栏：
 * 只改其中一处，必然有一边失败。
 *
 * 为什么需要它：类型清单漂移的后果是「前端按 number 提交、后端按 string 存储」，
 * 数据静默变形且无法回溯修复。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, '..')

const defaultCatalog = path.resolve(
  frontendRoot,
  '..',
  'xingyou-backend',
  'src',
  'main',
  'resources',
  'schema',
  'field-types.catalog.json',
)

const catalogPath = process.argv[2] ?? defaultCatalog
const constantsPath = path.join(frontendRoot, 'src', 'schema', 'constants.ts')

// ---------------------------------------------------------------- 读取后端目录

if (!fs.existsSync(catalogPath)) {
  console.error(`✘ 找不到后端目录文件：${catalogPath}`)
  console.error('  如果是分离的仓库，请把路径作为参数传入：')
  console.error('  node scripts/check-field-types.mjs <path/to/field-types.catalog.json>')
  process.exit(2)
}
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))

// ---------------------------------------------------------------- 解析前端常量

/**
 * 从 constants.ts 的 FIELD_TYPES 数组里解析每一项。
 *
 * 采用严格解析：任何一行不符合预期格式都视为错误并报出，
 * 绝不"跳过看不懂的行"—— 那会让护栏形同虚设。
 */
function parseFrontendTypes(source) {
  const lines = source.split(/\r?\n/)
  const startIdx = lines.findIndex((l) => /export\s+const\s+FIELD_TYPES\s*:/.test(l))
  if (startIdx < 0) throw new Error('constants.ts 里找不到 FIELD_TYPES 定义')

  const types = []
  const problems = []

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith(']')) break
    if (!line || line.startsWith('//')) continue
    if (!line.startsWith('{')) continue

    // 抽出所有 key: value 对（字符串 / 布尔 / 数字）
    const pairs = {}
    const re = /(\w+)\s*:\s*('[^']*'|"[^"]*"|true|false|-?\d+(?:\.\d+)?)/g
    let m
    while ((m = re.exec(line)) !== null) {
      const key = m[1]
      let value = m[2]
      if (value.startsWith("'") || value.startsWith('"')) {
        value = value.slice(1, -1)
      } else if (value === 'true') {
        value = true
      } else if (value === 'false') {
        value = false
      } else {
        value = Number(value)
      }
      pairs[key] = value
    }

    if (!pairs.code) {
      problems.push(`第 ${i + 1} 行无法解析出 code：${line.slice(0, 80)}`)
      continue
    }
    pairs.multipleValueType = pairs.multipleValueType ?? null
    types.push(pairs)
  }

  return { types, problems }
}

const source = fs.readFileSync(constantsPath, 'utf8')
let frontendTypes
let parseProblems
try {
  const parsed = parseFrontendTypes(source)
  frontendTypes = parsed.types
  parseProblems = parsed.problems
} catch (e) {
  console.error(`✘ 解析 constants.ts 失败：${e.message}`)
  process.exit(2)
}

const problems = [...parseProblems]

// ---------------------------------------------------------------- 比对

const FIELDS = [
  'label',
  'category',
  'valueType',
  'multipleValueType',
  'indexableAllowed',
  'dataSourceRequired',
  'hasValue',
  'firstBatch',
]

const frontendByCode = new Map(frontendTypes.map((t) => [t.code, t]))
const catalogByCode = new Map(catalog.types.map((t) => [t.code, t]))

for (const entry of catalog.types) {
  const fe = frontendByCode.get(entry.code)
  if (!fe) {
    problems.push(`类型 '${entry.code}' 在后端目录里有，前端 constants.ts 里没有`)
    continue
  }
  for (const f of FIELDS) {
    const expected = entry[f] ?? null
    const actual = fe[f] ?? null
    if (String(expected) !== String(actual)) {
      problems.push(`类型 '${entry.code}' 的 ${f} 不一致：后端目录=${expected} 前端=${actual}`)
    }
  }
}

for (const fe of frontendTypes) {
  if (!catalogByCode.has(fe.code)) {
    problems.push(`类型 '${fe.code}' 在前端 constants.ts 里有，后端目录里没有`)
  }
}

// 分类清单
const catalogCategories = catalog.categories.map((c) => c.code).sort()
const feCategories = [...source.matchAll(/code:\s*'([A-Z_]+)',\s*label:/g)].map((m) => m[1])
const feCategorySet = [...new Set(feCategories)].sort()
if (catalogCategories.join(',') !== feCategorySet.join(',')) {
  problems.push(
    `分类清单不一致：后端目录=[${catalogCategories.join(',')}] 前端=[${feCategorySet.join(',')}]`,
  )
}

// ---------------------------------------------------------------- 输出

console.log(`后端目录：${path.relative(frontendRoot, catalogPath)}`)
console.log(`前端常量：src/schema/constants.ts`)
console.log(`比对类型数：后端 ${catalog.types.length} 个，前端 ${frontendTypes.length} 个`)
console.log('')

if (problems.length) {
  console.error(`✘ 字段类型清单已漂移，共 ${problems.length} 处：`)
  for (const p of problems) console.error(`  - ${p}`)
  console.error('')
  console.error('请同时修改三处：后端目录文件、后端 FieldType 枚举、前端 constants.ts')
  process.exit(1)
}

console.log('✔ 字段类型清单一致')

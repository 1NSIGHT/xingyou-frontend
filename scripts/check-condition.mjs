/**
 * 校验前端条件求值器与后端共享测试向量是否一致。
 *
 * 用法：
 *   node scripts/check-condition.mjs [向量文件路径]
 *
 * 默认路径假设前后端仓库是同级目录：
 *   <workspace>/xingyou-frontend/scripts/check-condition.mjs
 *   <workspace>/xingyou-backend/src/main/resources/schema/condition-vectors.json
 *
 * 后端也有一份等价的 JUnit 测试（ConditionVectorsTest），两边同时作为护栏：
 * 只改其中一处，必然有一边失败。
 *
 * 为什么需要它：条件求值的语义细节很多（数值分支、null 视为相等、
 * U+00A0 不算空白…）。前后端不一致的后果是「前端看着是隐藏的，
 * 提交却被要求必填」——这类问题极难排查，且会直接卡住正常单据。
 *
 * 实现说明：Node 23+ 原生支持 TypeScript 类型剥离，因此可以直接 import
 * src/schema/condition.ts，无需引入构建步骤或测试框架。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, '..')

const defaultVectors = path.resolve(
  frontendRoot,
  '..',
  'xingyou-backend',
  'src',
  'main',
  'resources',
  'schema',
  'condition-vectors.json',
)

const vectorsPath = process.argv[2] ?? defaultVectors
const conditionPath = path.join(frontendRoot, 'src', 'schema', 'condition.ts')

// ---------------------------------------------------------------- 读取向量

if (!fs.existsSync(vectorsPath)) {
  console.error(`✘ 找不到共享测试向量：${vectorsPath}`)
  console.error('  如果是分离的仓库，请把路径作为参数传入：')
  console.error('  node scripts/check-condition.mjs <path/to/condition-vectors.json>')
  process.exit(2)
}

let vectors
try {
  vectors = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'))
} catch (e) {
  console.error(`✘ 向量文件不是合法 JSON：${e.message}`)
  process.exit(2)
}

const cases = vectors.cases
if (!Array.isArray(cases) || cases.length === 0) {
  console.error('✘ 向量文件里没有 cases')
  process.exit(2)
}

// ---------------------------------------------------------------- 加载求值器

let evaluateCondition
try {
  const mod = await import(pathToFileURL(conditionPath).href)
  evaluateCondition = mod.evaluateCondition
} catch (e) {
  console.error(`✘ 无法加载 src/schema/condition.ts：${e.message}`)
  console.error('  需要 Node 23+（原生 TypeScript 类型剥离）。当前：' + process.version)
  process.exit(2)
}

if (typeof evaluateCondition !== 'function') {
  console.error('✘ src/schema/condition.ts 没有导出 evaluateCondition 函数')
  process.exit(2)
}

// ---------------------------------------------------------------- 逐条比对

const problems = []
let passed = 0

for (const testCase of cases) {
  const name = testCase.name ?? '(未命名)'
  if (!('condition' in testCase)) {
    problems.push(`${name}：缺少 condition 字段`)
    continue
  }
  if (!('expected' in testCase) || typeof testCase.expected !== 'boolean') {
    problems.push(`${name}：expected 必须是布尔`)
    continue
  }

  const values = testCase.values ?? {}
  let actual
  try {
    actual = evaluateCondition(testCase.condition, values)
  } catch (e) {
    problems.push(`${name}：求值抛出异常 ${e.message}`)
    continue
  }

  if (actual === testCase.expected) {
    passed++
  } else {
    problems.push(`${name}：期望 ${testCase.expected}，实际 ${actual}`)
  }
}

// ---------------------------------------------------------------- 输出

console.log(`向量文件：${path.relative(frontendRoot, vectorsPath)}`)
console.log(`前端实现：src/schema/condition.ts`)
console.log(`向量版本：${vectors.revision ?? '(未标注)'}`)
console.log(`比对用例：${cases.length} 条，通过 ${passed} 条`)
console.log('')

if (problems.length) {
  console.error(`✘ 前端条件求值器与共享向量不一致，共 ${problems.length} 处：`)
  for (const p of problems) console.error(`  - ${p}`)
  console.error('')
  console.error('请同步修改：后端 ConditionEvaluator、前端 src/schema/condition.ts')
  console.error('若确认是向量本身写错了，改向量后必须同时重跑后端 ConditionVectorsTest')
  process.exit(1)
}

console.log('✔ 条件求值语义前后端一致')

/**
 * 校验前端字段访问判定与后端共享测试向量是否一致。
 *
 * 用法：
 *   node scripts/check-permission.mjs [向量文件路径]
 *
 * 默认路径假设前后端仓库是同级目录：
 *   <workspace>/xingyou-frontend/scripts/check-permission.mjs
 *   <workspace>/xingyou-backend/src/main/resources/schema/permission-vectors.json
 *
 * 后端也有一份等价的 JUnit 测试（PermissionVectorsTest），两边同时作为护栏：
 * 只改其中一处，必然有一边失败。
 *
 * 为什么需要它：权限判定的规则（hidden 优先、多角色取最高、通配符、默认拒绝）
 * 每一条都有反直觉的角落，而漂移的表现是"前端画出一个用户改不了的输入框"
 * 或"前端藏了一个本该能填的字段" —— **两种都不会报错**。
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
  'permission-vectors.json',
)

const vectorsPath = process.argv[2] ?? defaultVectors
const permissionPath = path.join(frontendRoot, 'src', 'schema', 'permission.ts')

if (!fs.existsSync(vectorsPath)) {
  console.error(`✘ 找不到共享测试向量：${vectorsPath}`)
  console.error('  如果是分离的仓库，请把路径作为参数传入：')
  console.error('  node scripts/check-permission.mjs <path/to/permission-vectors.json>')
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

let mod
try {
  mod = await import(pathToFileURL(permissionPath).href)
} catch (e) {
  console.error(`✘ 无法加载 src/schema/permission.ts：${e.message}`)
  console.error('  需要 Node 23+（原生 TypeScript 类型剥离）。当前：' + process.version)
  process.exit(2)
}

const problems = []
let passed = 0

for (const testCase of cases) {
  const name = testCase.name ?? '(未命名)'
  let actual
  try {
    switch (testCase.kind) {
      case 'access':
        actual = mod.resolveAccess(testCase.permission ?? undefined, testCase.roles ?? [])
        break
      case 'nodeGate':
        actual = mod.nodeAllows(testCase.nodes ?? undefined, testCase.nodeKey ?? null)
        break
      case 'required':
        actual = mod.isRequiredAtNode(testCase.field, testCase.nodeKey ?? null)
        break
      default:
        problems.push(`${name}：未知的 kind=${testCase.kind}`)
        continue
    }
  } catch (e) {
    problems.push(`${name}：求值抛出异常 ${e.message}`)
    continue
  }

  if (actual === testCase.expected) {
    passed++
  } else {
    problems.push(`${name}：期望 ${JSON.stringify(testCase.expected)}，实际 ${JSON.stringify(actual)}`)
  }
}

console.log(`向量文件：${path.relative(frontendRoot, vectorsPath)}`)
console.log(`前端实现：src/schema/permission.ts`)
console.log(`向量版本：${vectors.revision ?? '(未标注)'}`)
console.log(`比对用例：${cases.length} 条，通过 ${passed} 条`)
console.log('')

if (problems.length) {
  console.error(`✘ 前端字段访问判定与共享向量不一致，共 ${problems.length} 处：`)
  for (const p of problems) console.error(`  - ${p}`)
  console.error('')
  console.error('请同步修改：后端 FieldPermission / FieldDef、前端 src/schema/permission.ts')
  process.exit(1)
}

console.log('✔ 字段访问判定语义前后端一致')

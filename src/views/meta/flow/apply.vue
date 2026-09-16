<script setup lang="ts">
/**
 * 提交申请 —— 业务侧的发起入口。
 *
 * ★ 这里的清单来自**已发布的流程**，不是写死的按钮。
 *   新增一种申请 = 在设计器里配一张表单 + 配一条流程，这个页面不用改一行代码。
 *   这就是它和"定制系统里的那个提交按钮"的区别。
 *
 * ★ 为什么按**流程**列而不是按表单列：一个表单可以有多个流程
 *   （不符合项可以有"整改流程"和"延期流程"），
 *   "我要提交什么"这个问题的答案落在流程上，不是表单上。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { listFlowsApi, type FlowSummary } from '@/api/meta'

const router = useRouter()

const flows = ref<FlowSummary[]>([])
const loading = ref(false)
const keyword = ref('')

/** meta 里的 name 是 I18nText 的原始 JSON 文本 */
function i18n(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed['zh-CN'] || fallback
  } catch {
    // 兼容早期可能存成裸字符串的行：解析失败就当它就是名字
    return raw
  }
}

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return flows.value
  return flows.value.filter(
    (f) =>
      i18n(f.name, f.flowKey).toLowerCase().includes(kw) ||
      f.flowKey.toLowerCase().includes(kw) ||
      f.formKey.toLowerCase().includes(kw),
  )
})

async function load() {
  loading.value = true
  try {
    // 只列有生效版本的流程 —— 草稿状态的流程不该出现在发起入口里
    const all = await listFlowsApi()
    flows.value = all.filter((f) => f.status === 'PUBLISHED' && f.currentVersion != null)
  } catch (e) {
    ElMessage.error('加载流程清单失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}

/**
 * 去填报。
 *
 * ★ 带上 flowKey 而不是只带 formKey：填报页要据此知道
 *   "我现在处在哪个节点"，字段的节点作用域（可写 / 必填 / 可见）
 *   全靠这个。只带 formKey 的话，节点级权限一律不生效。
 */
function apply(flow: FlowSummary) {
  router.push({ path: `/document/${flow.formKey}`, query: { flowKey: flow.flowKey } })
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="ap">
    <div class="ap-head">
      <div>
        <h2 class="ap-title">提交申请</h2>
        <p class="ap-sub">选择要办理的事项。清单来自已发布的流程，新增事项无需改代码。</p>
      </div>
      <el-input v-model="keyword" class="ap-search" placeholder="搜索流程名称或标识" clearable />
    </div>

    <el-empty v-if="!loading && !flows.length" description="还没有已发布的流程">
      <el-button type="primary" @click="router.push('/flow/design')">去配置流程</el-button>
    </el-empty>

    <el-empty v-else-if="!loading && !filtered.length" description="没有匹配的事项" />

    <div v-else class="ap-grid">
      <el-card v-for="f in filtered" :key="f.flowKey" class="ap-card" shadow="hover" @click="apply(f)">
        <div class="ap-card-head">
          <span class="ap-card-title">{{ i18n(f.name, f.flowKey) }}</span>
          <el-tag size="small" type="info">v{{ f.currentVersion }}</el-tag>
        </div>
        <div class="ap-card-meta">
          <el-tag size="small" effect="plain">{{ f.formKey }}</el-tag>
          <span class="ap-dim">{{ f.flowKey }}</span>
        </div>
        <el-button class="ap-card-btn" type="primary" plain @click.stop="apply(f)">发起</el-button>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.ap {
  padding: 16px;
}
.ap-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.ap-title {
  margin: 0;
  font-size: 18px;
  color: #303133;
}
.ap-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: #909399;
}
.ap-search {
  width: 240px;
  flex: 0 0 auto;
}
.ap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.ap-card {
  cursor: pointer;
}
.ap-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ap-card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.ap-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.ap-dim {
  font-family: Consolas, monospace;
  font-size: 12px;
  color: #a8abb2;
}
.ap-card-btn {
  margin-top: 14px;
  width: 100%;
}
</style>

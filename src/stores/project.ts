import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getMyProjectsApi, type ProjectVO } from '@/api/system/project'
import { PROJECT_KEY } from '@/api/request'

/**
 * 当前项目。
 *
 * <p>项目是所有业务单据的归属维度，也是数据权限的主维度，
 * 所以它必须在整个应用里随处可取，并且**持久化**——
 * 刷新页面后不应该退回"未选项目"状态。
 *
 * <p>后端对每个请求都会重新校验项目权限，因此这里存的 ID
 * 即使被篡改也只会得到 403，不会造成越权。
 */
export const useProjectStore = defineStore('project', () => {
  const projects = ref<ProjectVO[]>([])
  const currentId = ref<number | null>(readStoredId())
  const loaded = ref(false)

  const current = computed(
    () => projects.value.find((p) => p.id === currentId.value) ?? null,
  )
  const hasProject = computed(() => projects.value.length > 0)

  function readStoredId(): number | null {
    const raw = localStorage.getItem(PROJECT_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  function setCurrent(id: number | null) {
    currentId.value = id
    if (id == null) {
      localStorage.removeItem(PROJECT_KEY)
    } else {
      localStorage.setItem(PROJECT_KEY, String(id))
    }
  }

  /**
   * 加载当前用户可访问的项目。
   *
   * <p>如果本地存的项目已不在可见范围内（被移出项目、或换了账号），
   * 自动回退到第一个，避免带着一个无权的项目 ID 到处撞 403。
   */
  async function load() {
    const list = await getMyProjectsApi()
    projects.value = list
    loaded.value = true

    if (!list.length) {
      setCurrent(null)
      return
    }
    if (currentId.value == null || !list.some((p) => p.id === currentId.value)) {
      setCurrent(list[0].id)
    }
  }

  function reset() {
    projects.value = []
    loaded.value = false
    setCurrent(null)
  }

  return { projects, currentId, current, hasProject, loaded, load, setCurrent, reset }
})

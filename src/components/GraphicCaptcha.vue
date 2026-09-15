<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    width?: number
    height?: number
    /** 字符个数 */
    length?: number
  }>(),
  { width: 112, height: 42, length: 4 },
)

const emit = defineEmits<{
  (e: 'change', code: string): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

/** 排除易混淆字符：0 O 1 I l */
const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const COLORS = ['#1B5299', '#0F3358', '#E08200', '#2A6FBF', '#00543D', '#8B3A00']

let currentCode = ''

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { width, height, length } = props
  const dpr = window.devicePixelRatio || 1

  // 按设备像素比放大，避免高分屏模糊
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  // 背景
  ctx.fillStyle = '#F2F6FB'
  ctx.fillRect(0, 0, width, height)

  // 干扰线
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.strokeStyle = COLORS[randomInt(0, COLORS.length - 1)]
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 1
    ctx.moveTo(randomInt(0, width), randomInt(0, height))
    ctx.quadraticCurveTo(randomInt(0, width), randomInt(0, height), randomInt(0, width), randomInt(0, height))
    ctx.stroke()
  }

  // 干扰点
  ctx.globalAlpha = 0.4
  for (let i = 0; i < 28; i++) {
    ctx.beginPath()
    ctx.fillStyle = COLORS[randomInt(0, COLORS.length - 1)]
    ctx.arc(randomInt(0, width), randomInt(0, height), 1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // 字符
  currentCode = ''
  const step = width / (length + 0.6)
  for (let i = 0; i < length; i++) {
    const char = CHARS[randomInt(0, CHARS.length - 1)]
    currentCode += char

    ctx.save()
    const x = step * (i + 0.55)
    const y = height / 2 + randomInt(-3, 3)
    ctx.translate(x, y)
    ctx.rotate((randomInt(-22, 22) * Math.PI) / 180)
    ctx.fillStyle = COLORS[randomInt(0, COLORS.length - 1)]
    ctx.font = `bold ${randomInt(21, 25)}px "Segoe UI", Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(char, 0, 0)
    ctx.restore()
  }

  emit('change', currentCode)
}

/** 刷新验证码：供父组件在登录失败后调用 */
function refresh() {
  draw()
}

/** 校验输入是否与当前验证码一致（忽略大小写） */
function validate(input: string) {
  return Boolean(input) && input.trim().toUpperCase() === currentCode.toUpperCase()
}

onMounted(draw)

defineExpose({ refresh, validate })
</script>

<template>
  <canvas
    ref="canvasRef"
    class="graphic-captcha"
    :title="'点击刷新验证码'"
    @click="refresh"
  />
</template>

<style scoped lang="scss">
.graphic-captcha {
  display: block;
  border-radius: var(--xy-radius-sm);
  border: 1px solid var(--xy-border);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--xy-navy-300);
  }
}
</style>

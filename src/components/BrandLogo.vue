<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 图标边长（px） */
    size?: number
    /** 是否使用浅色描边（用于深色背景） */
    light?: boolean
  }>(),
  { size: 44, light: false },
)
</script>

<template>
  <svg
    class="brand-logo"
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="石油工程监理数字化平台"
  >
    <defs>
      <linearGradient :id="`xyHex-${size}-${light}`" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0" :stop-color="light ? '#2A6FBF' : '#1B5299'" />
        <stop offset="1" :stop-color="light ? '#0F3358' : '#0A2540'" />
      </linearGradient>
    </defs>

    <!-- 六边形徽标：工业螺母意象 -->
    <path
      d="M24 2.6 42.2 13.1a3 3 0 0 1 1.5 2.6v16.6a3 3 0 0 1-1.5 2.6L24 45.4a3 3 0 0 1-3 0L2.8 34.9a3 3 0 0 1-1.5-2.6V15.7a3 3 0 0 1 1.5-2.6L21 2.6a3 3 0 0 1 3 0Z"
      :fill="`url(#xyHex-${size}-${light})`"
    />

    <!-- 井架（A 字架）：主桅 + 双腿 + 横撑 -->
    <path
      d="M27 13.5v18M27 13.5 19.2 31.5M27 13.5l7.8 18M22.6 24.2h8.8"
      stroke="#FFFFFF"
      stroke-width="2.1"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- 底座管线 -->
    <path d="M15.2 31.5h23.6" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" />

    <!-- 顶部能量点 -->
    <circle cx="27" cy="11" r="2.6" fill="#FF9F1C" />
  </svg>
</template>

<style scoped lang="scss">
.brand-logo {
  display: block;
  flex-shrink: 0;
}
</style>

<script setup>
import DefaultTheme from 'vitepress/theme'
import { ref, onMounted } from 'vue'

const { Layout } = DefaultTheme
const collapsed = ref(false)

function toggle() {
  collapsed.value = !collapsed.value
  document.documentElement.classList.toggle('outline-collapsed', collapsed.value)
}

onMounted(() => {
  collapsed.value = document.documentElement.classList.contains('outline-collapsed')
})
</script>

<template>
  <button
    class="outline-toggle-btn"
    :class="{ collapsed }"
    @click="toggle"
    :title="collapsed ? '展开目录' : '收起目录'"
  >
    {{ collapsed ? '◀' : '▶' }}
  </button>
  <Layout />
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  show: boolean
  title: string
  value?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  confirm: [value: string]
  cancel: []
}>()

const inputVal = ref('')
const inputRef = ref<HTMLInputElement>()

watch(() => props.show, async (v) => {
  if (v) {
    inputVal.value = props.value || ''
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('confirm', inputVal.value)
  if (e.key === 'Escape') emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div v-if="show" class="prompt-overlay" @click.self="emit('cancel')">
        <div class="prompt-dialog">
          <div class="prompt-title">{{ title }}</div>
          <input
            ref="inputRef"
            v-model="inputVal"
            class="prompt-input"
            :placeholder="placeholder || ''"
            @keydown="onKeydown"
          />
          <div class="prompt-actions">
            <button class="prompt-btn" @click="emit('cancel')">取消</button>
            <button class="prompt-btn primary" @click="emit('confirm', inputVal)">确定</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.prompt-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.prompt-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 28px 24px 20px;
  width: 320px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
}
.prompt-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}
.prompt-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  margin-bottom: 20px;
  transition: border-color 0.15s;
}
.prompt-input:focus {
  border-color: var(--accent-color);
}
.prompt-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
.prompt-btn {
  padding: 8px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
}
.prompt-btn:hover { background: var(--hover-bg); }
.prompt-btn.primary {
  background: var(--accent-color);
  color: #fff;
  border-color: var(--accent-color);
}
.prompt-btn.primary:hover { opacity: 0.9; }
</style>

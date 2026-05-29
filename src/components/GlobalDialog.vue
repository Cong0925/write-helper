<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { dialog } from '../composables/useDialog'

const inputRef = ref<HTMLInputElement>()

watch(() => dialog.state.show, async (v) => {
  if (v && dialog.state.mode === 'prompt') {
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
})

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') dialog.close(dialog.state.value)
  if (e.key === 'Escape') dialog.close(null)
}

function handleCancel() {
  if (dialog.state.mode === 'alert') {
    dialog.close()
  } else if (dialog.state.mode === 'confirm') {
    dialog.close(false)
  } else {
    dialog.close(null)
  }
}

function handleConfirm() {
  if (dialog.state.mode === 'alert') {
    dialog.close()
  } else if (dialog.state.mode === 'confirm') {
    dialog.close(true)
  } else {
    dialog.close(dialog.state.value)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="dialog.state.show" class="gd-overlay" @click.self="handleCancel">
        <div class="gd-dialog">
          <!-- Alert icon -->
          <div v-if="dialog.state.mode === 'alert'" class="gd-icon-wrap gd-icon-alert">
            <span class="gd-icon">ℹ</span>
          </div>
          <div v-else-if="dialog.state.mode === 'confirm'" class="gd-icon-wrap gd-icon-confirm">
            <span class="gd-icon">?</span>
          </div>

          <!-- Title -->
          <div class="gd-title">{{ dialog.state.title }}</div>

          <!-- Message -->
          <div v-if="dialog.state.message" class="gd-message">{{ dialog.state.message }}</div>

          <!-- Prompt input -->
          <input
            v-if="dialog.state.mode === 'prompt'"
            ref="inputRef"
            v-model="dialog.state.value"
            class="gd-input"
            :placeholder="dialog.state.placeholder || ''"
            @keydown="onInputKeydown"
          />

          <!-- Actions -->
          <div class="gd-actions">
            <button v-if="dialog.state.mode !== 'alert'" class="gd-btn" @click="handleCancel">取消</button>
            <button
              class="gd-btn gd-btn-primary"
              :class="{ 'gd-btn-only': dialog.state.mode === 'alert' }"
              @click="handleConfirm"
            >{{ dialog.state.mode === 'alert' ? '确定' : '确定' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gd-overlay {
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.gd-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 32px 28px 24px;
  width: 340px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  text-align: center;
}
.gd-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 18px;
}
.gd-icon-alert {
  background: rgba(74, 125, 212, 0.08);
}
.gd-icon-confirm {
  background: rgba(243, 156, 18, 0.08);
}
.gd-icon {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}
.gd-icon-alert .gd-icon {
  color: var(--accent-color);
}
.gd-icon-confirm .gd-icon {
  color: var(--warning-color);
}
.gd-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
  letter-spacing: 0.3px;
}
.gd-message {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 22px;
  white-space: pre-wrap;
  word-break: break-word;
}
.gd-input {
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
.gd-input:focus {
  border-color: var(--accent-color);
}
.gd-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.gd-btn {
  flex: 1;
  padding: 10px 0;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.gd-btn:hover {
  background: var(--hover-bg);
  border-color: var(--text-muted);
}
.gd-btn-primary {
  background: var(--accent-color);
  color: #fff;
  border-color: var(--accent-color);
}
.gd-btn-primary:hover {
  opacity: 0.9;
}
.gd-btn-only {
  max-width: 160px;
}

.dialog-fade-enter-active { transition: opacity 0.2s ease; }
.dialog-fade-leave-active { transition: opacity 0.15s ease; }
.dialog-fade-enter-from,
.dialog-fade-leave-to { opacity: 0; }
</style>

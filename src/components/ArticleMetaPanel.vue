<script setup lang="ts">
import { ref, computed } from 'vue'
import { appState } from '../store'
import { writeFile } from '../api/files'

const emit = defineEmits<{ close: [] }>()

const projectType = computed(() => appState.project?.projectType || 'novel')
const isWechat = computed(() => projectType.value === 'wechat_article')
const isToutiao = computed(() => projectType.value === 'toutiao_article')

// Metadata fields
const title = ref(appState.project?.name || '')
const summary = ref('')
const coverImage = ref('')
const originalLink = ref('')
const isOriginal = ref(true)
const allowReprint = ref(false)

// Toutiao specific
const title2 = ref('')
const title3 = ref('')
const coverMode = ref<'single' | 'triple'>('single')
const category = ref('')
const enableAds = ref(true)

const categories = ['财经', '科技', '体育', '娱乐', '教育', '三农', '美食', '旅游', '时尚', '育儿']

const saved = ref(false)

async function saveConfig() {
  const config = isWechat.value ? {
    title: title.value, summary: summary.value, coverImage: coverImage.value,
    originalLink: originalLink.value, isOriginal: isOriginal.value, allowReprint: allowReprint.value,
  } : {
    title: title.value, title2: title2.value, title3: title3.value,
    coverImage: coverImage.value, coverMode: coverMode.value,
    category: category.value, enableAds: enableAds.value,
  }

  try {
    const configPath = appState.project!.path + '/.writinghelper/type_config.json'
    await writeFile(configPath, JSON.stringify(config, null, 2))
    saved.value = true
    setTimeout(() => saved.value = false, 2000)
  } catch (e: any) {
    alert('保存失败: ' + (e?.message || e))
  }
}
</script>

<template>
  <div class="article-meta">
    <div class="meta-header">
      <span class="meta-title">{{ isWechat ? '公众号文章设置' : '头条文章设置' }}</span>
    </div>

    <div class="meta-body">
      <!-- Common fields -->
      <div class="form-group">
        <label class="form-label">文章标题</label>
        <input v-model="title" class="form-input" placeholder="输入文章标题" />
      </div>

      <div class="form-group">
        <label class="form-label">封面图片路径</label>
        <input v-model="coverImage" class="form-input" placeholder="images/cover.jpg" />
      </div>

      <!-- WeChat specific -->
      <template v-if="isWechat">
        <div class="form-group">
          <label class="form-label">摘要</label>
          <textarea v-model="summary" class="form-textarea" placeholder="输入文章摘要（120字以内）" rows="3" maxlength="120"></textarea>
          <span class="char-count">{{ summary.length }}/120</span>
        </div>

        <div class="form-group">
          <label class="form-label">原文链接</label>
          <input v-model="originalLink" class="form-input" placeholder="https://..." />
        </div>

        <div class="toggle-row">
          <label class="form-label">声明原创</label>
          <label class="toggle-switch">
            <input type="checkbox" v-model="isOriginal" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="toggle-row" v-if="!isOriginal">
          <label class="form-label">允许转载</label>
          <label class="toggle-switch">
            <input type="checkbox" v-model="allowReprint" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </template>

      <!-- Toutiao specific -->
      <template v-if="isToutiao">
        <div class="form-group">
          <label class="form-label">备选标题 2</label>
          <input v-model="title2" class="form-input" placeholder="备选标题（最多30字）" maxlength="30" />
        </div>
        <div class="form-group">
          <label class="form-label">备选标题 3</label>
          <input v-model="title3" class="form-input" placeholder="备选标题（最多30字）" maxlength="30" />
        </div>

        <div class="form-group">
          <label class="form-label">封面模式</label>
          <div class="radio-group">
            <label class="radio-label"><input type="radio" v-model="coverMode" value="single" /> 单图</label>
            <label class="radio-label"><input type="radio" v-model="coverMode" value="triple" /> 三图</label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">分类</label>
          <select v-model="category" class="form-input">
            <option value="">选择分类</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="toggle-row">
          <label class="form-label">允许投放广告</label>
          <label class="toggle-switch">
            <input type="checkbox" v-model="enableAds" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </template>

      <button class="btn-save" @click="saveConfig">{{ saved ? '已保存 ✓' : '保存设置' }}</button>
    </div>
  </div>
</template>

<style scoped>
.article-meta {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.meta-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.meta-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.meta-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}
.form-input:focus, .form-textarea:focus { border-color: var(--accent-color); }
.form-textarea { resize: vertical; }

.char-count {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
}

.toggle-switch {
  position: relative;
  width: 40px; height: 22px;
  cursor: pointer;
}
.toggle-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; inset: 0;
  background: var(--border-color);
  border-radius: 11px;
  transition: background 0.2s;
}
.toggle-slider::before {
  content: '';
  position: absolute; width: 18px; height: 18px;
  left: 2px; bottom: 2px;
  background: #fff; border-radius: 50%;
  transition: transform 0.2s;
}
.toggle-switch input:checked + .toggle-slider { background: var(--accent-color); }
.toggle-switch input:checked + .toggle-slider::before { transform: translateX(18px); }

.radio-group {
  display: flex;
  gap: 16px;
}
.radio-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}

.btn-save {
  margin-top: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: var(--accent-color);
  color: #1e1e2e;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}
.btn-save:hover { opacity: 0.85; }
</style>

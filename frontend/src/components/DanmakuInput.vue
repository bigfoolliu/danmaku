<template>
  <div class="danmaku-input">
    <input
      v-model="inputText"
      type="text"
      placeholder="发送弹幕..."
      maxlength="100"
      @keyup.enter="handleSend"
    />
    <button @click="handleSend" :disabled="!canSend">发送</button>
    <select v-model="selectedColor">
      <option value="#FFFFFF">白色</option>
      <option value="#FF0000">红色</option>
      <option value="#00FF00">绿色</option>
      <option value="#0000FF">蓝色</option>
      <option value="#FFFF00">黄色</option>
      <option value="#FF00FF">粉色</option>
      <option value="#00FFFF">青色</option>
    </select>
      <select v-model="selectedFontSize">
      <option :value="18">小</option>
      <option :value="24">中</option>
      <option :value="36">大</option>
    </select>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  canSend: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['send'])

const inputText = ref('')
const selectedColor = ref('#FFFFFF')
const selectedFontSize = ref(24)

function handleSend() {
  if (!inputText.value.trim() || !props.canSend) return
  
  emit('send', {
    content: inputText.value,
    color: selectedColor.value,
    fontSize: selectedFontSize.value
  })
  
  inputText.value = ''
}
</script>

<style scoped>
.danmaku-input {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.danmaku-input input {
  flex: 1;
  min-width: 200px;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  background: #0f3460;
  color: #fff;
  font-size: 14px;
}

.danmaku-input input:focus {
  outline: 2px solid #00d2ff;
}

.danmaku-input button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  background: #00d2ff;
  color: #1a1a2e;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.danmaku-input button:hover:not(:disabled) {
  background: #00a8cc;
}

.danmaku-input button:disabled {
  background: #666;
  cursor: not-allowed;
}

.danmaku-input select {
  padding: 10px;
  border: none;
  border-radius: 4px;
  background: #0f3460;
  color: #fff;
  font-size: 14px;
}
</style>

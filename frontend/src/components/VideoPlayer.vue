<template>
  <div class="video-player">
    <div class="player-wrapper">
      <video ref="videoRef" controls>
        <source src="https://vod.pipi.cn/fe5b84bcvodcq1251246104/658e4b085285890797861659749/f0.mp4" type="video/mp4">
        您的浏览器不支持视频播放
      </video>

      <vue-danmaku
        ref="danmakuRef"
        class="danmaku-layer"
        v-model:danmus="danmusData"
        :channels="0"
        :loop="false"
        :autoplay="false"
        :speeds="speed"
        :top="4"
        :right="0"
        :performance-mode="true"
        :z-index="10"
      >
        <template #danmu="{ danmu }">
          <span :style="{ color: danmu.color, fontSize: danmu.fontSize + 'px' }">
            {{ danmu.text }}
          </span>
        </template>
      </vue-danmaku>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import vueDanmaku from 'vue-danmaku'

const props = defineProps({
  danmus: {
    type: Array,
    default: () => []
  },
  showDanmaku: {
    type: Boolean,
    default: true
  },
  opacity: {
    type: Number,
    default: 1
  },
  speed: {
    type: Number,
    default: 100
  }
})

const emit = defineEmits(['danmaku-click'])

const videoRef = ref(null)
const danmakuRef = ref(null)
const danmakuInstance = ref(null)

// 同步外部弹幕数据
const danmakuData = ref([])

// 监听弹幕数据变化
watch(() => props.danmus, (newDanmus) => {
  danmakuData.value = newDanmus
}, { immediate: true, deep: true })

// 组件挂载后开始播放弹幕
onMounted(() => {
  nextTick(() => {
    if (danmakuRef.value) {
      danmakuRef.value.play()
    }
  })
})

// 监听显示/隐藏
watch(() => props.showDanmaku, (show) => {
  if (danmakuRef.value) {
    show ? danmakuRef.value.show() : danmakuRef.value.hide()
  }
})

// 监听速度变化
watch(() => props.speed, (newSpeed) => {
  if (danmakuRef.value) {
    danmakuRef.value.reset({ speeds: newSpeed })
  }
})

// 暴露方法给父组件
defineExpose({
  danmakuRef,
  videoRef,
  addDanmaku
})

// 添加弹幕（实时插入）
function addDanmaku(danmaku) {
  if (danmakuRef.value && danmaku) {
    danmakuRef.value.addDanmu(danmaku, 'current')
  }
}
</script>

<style scoped>
.video-player {
  width: 100%;
  max-width: 900px;
}

.player-wrapper {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

video {
  display: block;
  width: 100%;
  height: auto;
}

.danmaku-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>

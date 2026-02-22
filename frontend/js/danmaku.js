/**
 * 弹幕渲染引擎
 *
 * 核心功能：
 * 1. 弹幕轨道管理 - 避免弹幕重叠
 * 2. 弹幕渲染 - 从右向左滚动动画
 * 3. 弹幕池 - 复用DOM元素，优化性能
 */

class DanmakuEngine {
    constructor(container) {
        this.container = container;

        // 轨道配置
        // 轨道是弹幕滚动的"行"，每条轨道同一时间只能显示一条弹幕
        this.trackHeight = 30;  // 轨道高度（像素）
        this.trackGap = 5;       // 轨道间距
        this.numTracks = 0;      // 轨道数量（根据容器高度动态计算）

        // 轨道状态：记录每条轨道的最后一条弹幕的结束时间
        // 用于判断某条轨道是否可以放置新弹幕
        this.trackStatus = [];

        // 弹幕池：预先创建的DOM元素，复用减少GC
        this.danmakuPool = [];
        this.poolSize = 50;

        // 配置参数
        this.speed = 100;        // 滚动速度（像素/秒），基准值
        this.opacity = 1;       // 透明度
        this.enabled = true;    // 是否启用弹幕

        // 初始化
        this.init();
    }

    init() {
        // 计算轨道数量
        this.calculateTracks();

        // 预创建弹幕DOM元素池
        this.createPool();

        // 监听容器大小变化
        window.addEventListener('resize', () => {
            this.calculateTracks();
        });
    }

    /**
     * 根据容器高度计算可以容纳的轨道数量
     * 轨道数量 = 容器高度 / (轨道高度 + 间距)
     */
    calculateTracks() {
        const containerHeight = this.container.clientHeight;
        this.numTracks = Math.floor(containerHeight / (this.trackHeight + this.trackGap));
        this.trackStatus = new Array(this.numTracks).fill(0);
    }

    /**
     * 创建弹幕DOM元素池
     * 预先创建一定数量的DOM元素，避免频繁创建/销毁
     */
    createPool() {
        for (let i = 0; i < this.poolSize; i++) {
            const el = document.createElement('div');
            el.className = 'danmaku';
            el.style.display = 'none';
            this.container.appendChild(el);
            this.danmakuPool.push(el);
        }
    }

    /**
     * 从池中获取一个弹幕元素
     */
    getDanmakuElement() {
        // 查找一个隐藏的弹幕元素
        let el = this.danmakuPool.find(e => e.style.display === 'none');

        // 如果池已用完，创建新的
        if (!el) {
            el = document.createElement('div');
            el.className = 'danmaku';
            this.container.appendChild(el);
            this.danmakuPool.push(el);
        }

        return el;
    }

    /**
     * 回收弹幕元素回池中
     */
    recycleDanmakuElement(el) {
        el.style.display = 'none';
        el.style.transform = '';
        el.innerHTML = '';
    }

    /**
     * 添加弹幕到渲染队列
     *
     * 轨道分配算法：
     * 1. 从上到下遍历所有轨道
     * 2. 找到第一条"可用"轨道（当前时间 >= 轨道上最后一条弹幕的结束时间）
     * 3. 如果所有轨道都不可用，新弹幕需要排队等待
     *
     * @param {Object} danmaku - 弹幕数据 { content, color, font_size, username }
     */
    add(danmaku) {
        if (!this.enabled) return;

        const now = Date.now();

        // 查找可用的轨道
        let trackIndex = -1;
        for (let i = 0; i < this.numTracks; i++) {
            // 如果当前时间已经超过该轨道的最后一条弹幕结束时间，说明轨道可用
            if (now >= this.trackStatus[i]) {
                trackIndex = i;
                break;
            }
        }

        // 所有轨道都不可用，丢弃弹幕（或可选择排队等待）
        if (trackIndex === -1) {
            console.log('弹幕轨道已满，丢弃');
            return;
        }

        // 获取弹幕元素
        const el = this.getDanmakuElement();

        // 设置弹幕样式
        el.textContent = danmaku.content;
        el.style.color = danmaku.color || '#FFFFFF';
        el.style.fontSize = (danmaku.font_size || 24) + 'px';
        el.style.fontFamily = 'Microsoft YaHei, sans-serif';
        el.style.textShadow = '1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000';
        el.style.opacity = this.opacity;

        // 计算弹幕宽度和滚动时间
        const containerWidth = this.container.clientWidth;
        const textWidth = this.measureText(danmaku.content, danmaku.font_size || 24);
        const totalDistance = containerWidth + textWidth;  // 需要移动的总距离

        // 根据速度计算滚动时间
        // 速度越快，时间越短
        const duration = (totalDistance / this.speed) * 1000;

        // 设置初始位置
        // 轨道Y坐标 = 轨道索引 * (轨道高度 + 间距)
        const top = trackIndex * (this.trackHeight + this.trackGap);
        el.style.top = top + 'px';
        el.style.left = containerWidth + 'px';

        // 记录该轨道的占用结束时间
        // 结束时间 = 当前时间 + 弹幕滚动时间
        this.trackStatus[trackIndex] = now + duration;

        // 显示弹幕
        el.style.display = 'block';

        // 使用 CSS transition 实现滚动动画
        // 性能优于 JS 逐帧动画
        el.style.transition = `transform ${duration}ms linear`;

        // 强制重绘，确保 transition 生效
        el.offsetHeight;

        // 开始滚动动画
        // translateX 负值使元素向左移动
        el.style.transform = `translateX(-${totalDistance}px)`;

        // 动画结束后回收弹幕元素
        setTimeout(() => {
            this.recycleDanmakuElement(el);
        }, duration);
    }

    /**
     * 测量文本宽度
     * 创建一个临时元素进行测量
     */
    measureText(text, fontSize) {
        const tempEl = document.createElement('div');
        tempEl.style.position = 'absolute';
        tempEl.style.visibility = 'hidden';
        tempEl.style.fontSize = fontSize + 'px';
        tempEl.style.fontFamily = 'Microsoft YaHei, sans-serif';
        tempEl.style.white-space = 'nowrap';
        tempEl.textContent = text;
        document.body.appendChild(tempEl);
        const width = tempEl.clientWidth;
        document.body.removeChild(tempEl);
        return width;
    }

    /**
     * 设置弹幕显示开关
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        if (!enabled) {
            // 隐藏所有弹幕
            this.danmakuPool.forEach(el => {
                el.style.display = 'none';
            });
            // 重置轨道状态
            this.trackStatus = new Array(this.numTracks).fill(0);
        }
    }

    /**
     * 设置弹幕透明度
     */
    setOpacity(opacity) {
        this.opacity = opacity;
        this.danmakuPool.forEach(el => {
            el.style.opacity = opacity;
        });
    }

    /**
     * 设置滚动速度
     * @param {number} speedMultiplier - 速度倍率 (0.5 - 2.0)
     */
    setSpeed(speedMultiplier) {
        // 基准速度乘以倍率
        this.speed = 100 * speedMultiplier;
    }

    /**
     * 清空所有弹幕
     */
    clear() {
        this.danmakuPool.forEach(el => {
            el.style.display = 'none';
        });
        this.trackStatus = new Array(this.numTracks).fill(0);
    }
}


// ========== API 导出 ==========

// 全局弹幕引擎实例
let danmakuEngine = null;

/**
 * 初始化弹幕引擎
 */
function initDanmakuEngine() {
    const container = document.getElementById('danmakuLayer');
    if (container) {
        danmakuEngine = new DanmakuEngine(container);
        console.log('弹幕引擎初始化完成');
    }
    return danmakuEngine;
}

/**
 * 添加弹幕（供外部调用）
 */
window.addDanmaku = function(data) {
    // 如果引擎未初始化，先初始化
    if (!danmakuEngine && document.getElementById('danmakuLayer')) {
        initDanmakuEngine();
    }
    if (danmakuEngine) {
        danmakuEngine.add(data);
    }
};

/**
 * 设置弹幕开关
 */
window.setDanmakuEnabled = function(enabled) {
    if (danmakuEngine) {
        danmakuEngine.setEnabled(enabled);
    }
};

/**
 * 设置弹幕透明度
 */
window.setDanmakuOpacity = function(opacity) {
    if (danmakuEngine) {
        danmakuEngine.setOpacity(opacity);
    }
};

/**
 * 设置弹幕速度
 */
window.setDanmakuSpeed = function(speedMultiplier) {
    if (danmakuEngine) {
        danmakuEngine.setSpeed(speedMultiplier);
    }
};

// 页面加载完成后立即初始化弹幕引擎
document.addEventListener('DOMContentLoaded', initDanmakuEngine);

// 如果 DOM 已加载完成，立即初始化
if (document.readyState !== 'loading') {
    initDanmakuEngine();
}

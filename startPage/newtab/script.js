// --- 配置常量 ---
const searchEngines = {
    bing: {
        name: 'Bing',
        url: 'https://www.bing.com/search?q=',
        icon: '../icons/engines/bing.ico',
        placeholder: '在 Bing 上搜索...'
    },
    google: {
        name: 'Google',
        url: 'https://www.google.com/search?q=',
        icon: '../icons/engines/google.ico',
        placeholder: '在 Google 上搜索...'
    }
};

const defaultSettings = {
    theme: 'light',
    engine: 'bing',
    logoMode: 'text',
    customLogoText: 'lspzc',
    clockType: 'normal',
    workStartTime: '09:00',
    workEndTime: '18:00'
};

// --- DOM 元素引用 ---
const els = {
    // 基础元素
    searchInput: document.getElementById('searchInput'),
    searchBox: document.getElementById('searchBox'),
    themeToggle: document.getElementById('themeToggle'),
    engineIndicator: document.getElementById('engineIndicator'),

    // Logo 显示区
    logoWrapper: document.getElementById('logoWrapper'),
    textLogo: document.getElementById('textLogo'),
    clockLogo: document.getElementById('clockLogo'),
    clockDate: document.getElementById('clockDate'),
    clockHour: document.getElementById('clockHour'),
    clockMin: document.getElementById('clockMin'),
    clockSec: document.getElementById('clockSec'),
    clockLabel: document.getElementById('clockLabel'),

    // 模态框
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeModal: document.getElementById('closeModal'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),

    // 设置表单
    engineOptions: document.querySelectorAll('.radio-option'),
    logoModeSelect: document.getElementById('logoModeSelect'),
    textSettings: document.getElementById('textSettings'),
    customLogoInput: document.getElementById('customLogoInput'),

    // 时钟设置
    clockSettings: document.getElementById('clockSettings'),
    clockTypeSelect: document.getElementById('clockTypeSelect'),
    timePickerGroup: document.getElementById('timePickerGroup'),
    workStartTimeInput: document.getElementById('workStartTime'),
    workEndTimeInput: document.getElementById('workEndTime')
};

let currentSettings = { ...defaultSettings };
let clockInterval = null;

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
    const stored = await loadSettings();
    currentSettings = { ...defaultSettings, ...stored };
    applySettings();
    setupEventListeners();
    els.searchInput.focus();
}

// --- 存储逻辑 ---
function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(Object.keys(defaultSettings), (result) => resolve(result));
    });
}

function saveSettings(newSettings) {
    return new Promise((resolve) => {
        chrome.storage.local.set(newSettings, () => resolve());
    });
}

// --- 渲染逻辑 ---
function applySettings() {
    // 主题
    setTheme(currentSettings.theme);
    // 搜索引擎
    setSearchEngine(currentSettings.engine);
    // Logo 模式
    renderLogoSection();
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    const icon = els.themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function setSearchEngine(engineKey) {
    const engine = searchEngines[engineKey] || searchEngines.bing;
    els.engineIndicator.style.backgroundImage = `url(${engine.icon})`;
    els.searchInput.placeholder = engine.placeholder;
}

function renderLogoSection() {
    // 清理旧定时器
    if (clockInterval) clearInterval(clockInterval);

    if (currentSettings.logoMode === 'text') {
        els.clockLogo.style.display = 'none';
        els.textLogo.style.display = 'flex'; // 确保是flex布局
        renderColoredText(currentSettings.customLogoText || 'Search');
    } else {
        els.textLogo.style.display = 'none';
        els.clockLogo.style.display = 'block';
        updateClock(); // 立即执行一次
        clockInterval = setInterval(updateClock, 1000);
    }
}

// Google 风格文字渲染
function renderColoredText(text) {
    const colors = ['#4285f4', '#ea4335', '#fbbc05', '#4285f4', '#34a853', '#ea4335'];
    els.textLogo.innerHTML = '';
    text.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char;
        // 简单处理空格
        if (char === ' ') span.style.width = '20px';
        span.style.color = colors[index % colors.length];
        els.textLogo.appendChild(span);
    });
}

// --- 核心：智能时钟计算逻辑 ---
function updateClock() {
    const now = new Date();
    const type = currentSettings.clockType;

    // 1. 渲染日期
    const dateStr = now.toLocaleDateString('zh-CN', {
        month: 'long', day: 'numeric', weekday: 'long'
    });
    els.clockDate.textContent = dateStr;

    let h = now.getHours();
    let m = now.getMinutes();
    let s = now.getSeconds();
    let labelText = '';

    // 2. 逻辑分支
    if (type === 'countdown') {
        const result = calculateRecurringCountdown(now);
        h = result.h;
        m = result.m;
        s = result.s;
        labelText = result.label;
    } else {
        // 常规时间
        // 保持 h, m, s 为当前时间
    }

    // 3. 更新 DOM
    els.clockHour.textContent = String(h).padStart(2, '0');
    els.clockMin.textContent = String(m).padStart(2, '0');
    els.clockSec.textContent = String(s).padStart(2, '0');
    els.clockLabel.textContent = labelText;
    els.clockLabel.style.display = labelText ? 'inline-block' : 'none';
}

/**
 * 计算循环倒计时
 * 规则：
 * 1. 周一至周五 & 当前时间 < 下班时间 -> 倒计时到下班
 * 2. 周一至周四 & 当前时间 > 下班时间 -> 显示 "休息时间" (或倒计时到明天? 这里简化为休息)
 * 3. 周五下班后 或 周六日 -> 倒计时到周一上班时间
 */
function calculateRecurringCountdown(now) {
    const day = now.getDay(); // 0(周日) - 6(周六)
    const isWeekend = (day === 0 || day === 6);

    // 获取配置时间 (字符串 "HH:mm")
    const workStartStr = currentSettings.workStartTime || '09:00';
    const workEndStr = currentSettings.workEndTime || '18:00';

    // 解析今天的上下班时间对象
    const todayWorkEnd = getTimeObject(now, workEndStr);

    let targetTime = null;
    let label = '';
    let isFreeTime = false;

    if (isWeekend) {
        // 周末：目标是下周一上班时间
        targetTime = getNextDayOfWeek(now, 1, workStartStr); // 1 = Monday
        label = '距离周一上班';
    } else {
        // 工作日
        if (now < todayWorkEnd) {
            // 还没下班
            targetTime = todayWorkEnd;
            label = '距离下班还有';
        } else {
            // 已经下班了
            if (day === 5) {
                // 周五下班后
                targetTime = getNextDayOfWeek(now, 1, workStartStr);
                label = '周末愉快! 距离周一'; // 这种情况下用户可能想看距离周一，或者直接享受
            } else {
                // 周一至周四下班后 -> 休息时间，不显示倒计时
                isFreeTime = true;
                label = '休息时间';
            }
        }
    }

    // 如果是休息时间，返回全0
    if (isFreeTime) {
        return { h: 0, m: 0, s: 0, label: label };
    }

    // 计算差值
    let diff = targetTime - now;
    if (diff < 0) diff = 0;

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600); // 这里计算总小时数，可能超过24
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { h: hours, m: minutes, s: seconds, label: label };
}

// 辅助：获取今天的某个时间对象
function getTimeObject(baseDate, timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(h, m, 0, 0);
    return d;
}

// 辅助：获取下一个周几的时间对象
function getNextDayOfWeek(baseDate, dayOfWeek, timeStr) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + ((7 - d.getDay() + dayOfWeek) % 7 || 7));
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
}


// --- 事件监听 ---
function setupEventListeners() {
    // 1. 设置按钮逻辑
    els.settingsBtn.addEventListener('click', openSettingsModal);
    els.closeModal.addEventListener('click', closeSettingsModal);
    els.settingsModal.addEventListener('click', (e) => {
        if (e.target === els.settingsModal) closeSettingsModal();
    });

    // 2. 引擎选择切换
    els.engineOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            els.engineOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });

    // 3. Logo模式联动
    els.logoModeSelect.addEventListener('change', (e) => {
        const isText = e.target.value === 'text';
        els.textSettings.style.display = isText ? 'block' : 'none';
        els.clockSettings.style.display = isText ? 'none' : 'block';
    });

    // 4. 时钟类型联动
    els.clockTypeSelect.addEventListener('change', (e) => {
        const isCount = e.target.value === 'countdown';
        els.timePickerGroup.style.display = isCount ? 'block' : 'none';
    });

    // 5. 保存设置
    els.saveSettingsBtn.addEventListener('click', handleSaveSettings);

    // 6. 搜索
    els.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    els.engineIndicator.addEventListener('click', () => {
        // 点击图标顺序切换搜索引擎
        const engineKeys = Object.keys(searchEngines);
        const currentIndex = engineKeys.indexOf(currentSettings.engine);
        const nextIndex = (currentIndex + 1) % engineKeys.length;
        const nextEngine = engineKeys[nextIndex];

        currentSettings.engine = nextEngine;
        setSearchEngine(nextEngine);
        saveSettings({ engine: nextEngine });
    });

    // 主题切换
    els.themeToggle.addEventListener('click', () => {
        const newTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        currentSettings.theme = newTheme;
        setTheme(newTheme);
        saveSettings({ theme: newTheme });
    });
}

// --- 模态框逻辑 ---
function openSettingsModal() {
    // 回显引擎
    els.engineOptions.forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === currentSettings.engine);
    });

    // 回显下拉框和输入框
    els.logoModeSelect.value = currentSettings.logoMode;
    els.customLogoInput.value = currentSettings.customLogoText || '';

    els.clockTypeSelect.value = currentSettings.clockType || 'normal';

    // 回显时间 (input type="time" 需要 HH:mm 格式)
    els.workStartTimeInput.value = currentSettings.workStartTime;
    els.workEndTimeInput.value = currentSettings.workEndTime;

    // 触发联动事件显示/隐藏对应区域
    els.logoModeSelect.dispatchEvent(new Event('change'));
    els.clockTypeSelect.dispatchEvent(new Event('change'));

    els.settingsModal.classList.add('active');
}

function closeSettingsModal() {
    els.settingsModal.classList.remove('active');
}

async function handleSaveSettings() {
    const selectedEngine = document.querySelector('.radio-option.selected').dataset.value;

    const newSettings = {
        theme: document.body.getAttribute('data-theme'),
        engine: selectedEngine,
        logoMode: els.logoModeSelect.value,
        customLogoText: els.customLogoInput.value.trim(),
        clockType: els.clockTypeSelect.value,
        workStartTime: els.workStartTimeInput.value,
        workEndTime: els.workEndTimeInput.value
    };

    currentSettings = { ...currentSettings, ...newSettings };
    await saveSettings(newSettings);
    applySettings();
    closeSettingsModal();
}

// --- 搜索功能 ---
function performSearch() {
    const query = els.searchInput.value.trim();
    if (!query) return;

    if (isUrl(query)) {
        window.location.href = addHttpPrefix(query);
        return;
    }

    const engine = searchEngines[currentSettings.engine];
    window.location.href = `${engine.url}${encodeURIComponent(query)}`;
}

function isUrl(str) {
    return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(str);
}

function addHttpPrefix(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) return 'https://' + url;
    return url;
}
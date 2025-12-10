// 搜索引擎配置
const searchEngines = {
    bing: {
        name: 'Bing',
        url: 'https://www.bing.com/search?q=',
        icon: '../icons/engines/bing.ico'
    },
    google: {
        name: 'Google',
        url: 'https://www.google.com/search?q=',
        icon: '../icons/engines/google.ico'
    }
};

// DOM元素获取
const searchInput = document.getElementById('searchInput');
const themeToggle = document.getElementById('themeToggle');
const currentEngine = document.getElementById('currentEngine');
const engineDropdown = document.getElementById('engineDropdown');
const engineOptions = document.querySelectorAll('.engine-option');

/**
 * 初始化函数 - 页面加载完成后执行
 */
async function init() {
    // 加载保存的设置
    const settings = await loadSettings();

    // 设置主题
    setTheme(settings.theme || 'light');

    // 设置搜索引擎
    setSearchEngine(settings.engine || 'bing');

    // 设置事件监听器
    setupEventListeners();

    // 聚焦到搜索输入框
    searchInput.focus();
}

/**
 * 从Chrome存储中加载设置
 */
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['theme', 'engine'], (result) => {
            resolve(result);
        });
    });
}

/**
 * 保存设置到Chrome存储
 */
async function saveSettings(settings) {
    return new Promise((resolve) => {
        chrome.storage.local.set(settings, () => {
            resolve();
        });
    });
}

/**
 * 设置主题模式
 */
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    const icon = themeToggle.querySelector('i');
    // 根据主题切换图标
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    // 保存主题设置
    saveSettings({ theme });
}

/**
 * 设置搜索引擎
 */
function setSearchEngine(engineId) {
    const engine = searchEngines[engineId];
    if (!engine) return;

    // 更新当前搜索引擎显示
    currentEngine.innerHTML = `
    <img src="${engine.icon}" alt="${engine.name}" class="engine-icon">
    <span>${engine.name}</span>
    <i class="fas fa-chevron-down"></i>
  `;

    // 保存搜索引擎设置
    saveSettings({ engine: engineId });
}

/**
 * 设置所有事件监听器（移除搜索按钮逻辑）
 */
function setupEventListeners() {
    // 主题切换按钮点击事件
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });

    // 点击当前引擎，切换下拉框显示/隐藏
    currentEngine.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止冒泡
        engineDropdown.classList.toggle('active');
    });

    // 点击外部区域，关闭下拉框
    document.addEventListener('click', () => {
        engineDropdown.classList.remove('active');
    });

    // 阻止下拉框内部点击冒泡
    engineDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // 搜索引擎选择事件
    engineOptions.forEach(option => {
        option.addEventListener('click', () => {
            const engineId = option.dataset.engine;
            setSearchEngine(engineId);
            engineDropdown.classList.remove('active'); // 选择后关闭
        });
    });

    // 搜索输入框回车事件（核心搜索逻辑）
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

/**
 * 执行搜索操作
 */
async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    // 检查是否为URL（直接跳转）
    if (isUrl(query)) {
        window.location.href = addHttpPrefix(query);
        return;
    }

    // 获取当前搜索引擎并执行搜索
    const settings = await loadSettings();
    const engine = searchEngines[settings.engine || 'google'];
    window.location.href = `${engine.url}${encodeURIComponent(query)}`;
}

/**
 * 检查字符串是否为URL
 */
function isUrl(string) {
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    return urlPattern.test(string);
}

/**
 * 为URL添加http://前缀（如果缺少）
 */
function addHttpPrefix(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'https://' + url;
    }
    return url;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
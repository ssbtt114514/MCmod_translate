// js/main.js - 主控制器
document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素绑定
    const stepPanels = {
        1: document.getElementById('step1Panel'),
        2: document.getElementById('step2Panel'),
        3: document.getElementById('step3Panel'),
        4: document.getElementById('step4Panel')
    };
    
    const steps = document.querySelectorAll('.step');
    let currentStep = 1;
    let loadedMods = [];
    let translatedResults = {}; // { modId: { key: translation } }
    let selectedProvider = 'openai';
    let selectedModel = '';
    
    function showStep(step) {
        Object.values(stepPanels).forEach(panel => panel.classList.remove('active'));
        stepPanels[step].classList.add('active');
        steps.forEach((s, idx) => {
            if (idx + 1 === step) s.classList.add('active');
            else s.classList.remove('active');
        });
        currentStep = step;
    }
    
    // 文件上传逻辑
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('modFileInput');
    const selectBtn = document.getElementById('selectFilesBtn');
    const modListDiv = document.getElementById('modList');
    const toStep2Btn = document.getElementById('toStep2');
    
    selectBtn.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#764ba2'; });
    uploadArea.addEventListener('dragleave', () => uploadArea.style.borderColor = '#667eea');
    uploadArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#667eea';
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.jar') || f.name.endsWith('.zip'));
        await loadModFiles(files);
    });
    
    fileInput.addEventListener('change', async (e) => {
        await loadModFiles(Array.from(e.target.files));
    });
    
    async function loadModFiles(files) {
        modListDiv.innerHTML = '<div style="text-align:center">正在加载模组...</div>';
        const results = await window.modLoader.loadMultiple(files, (cur, total, name) => {
            modListDiv.innerHTML = `<div>加载中 ${cur}/${total}: ${name}</div>`;
        });
        loadedMods = results;
        displayModList();
        toStep2Btn.disabled = false;
    }
    
    function displayModList() {
        if (loadedMods.length === 0) {
            modListDiv.innerHTML = '<div>未加载模组</div>';
            return;
        }
        let html = '';
        for (const mod of loadedMods) {
            const langCount = mod.langFiles.length;
            html += `<div class="mod-item"><span class="mod-name">📁 ${mod.name}</span><span class="mod-status">${langCount} 个语言文件</span></div>`;
        }
        modListDiv.innerHTML = html;
    }
    
    // 步骤切换
    document.getElementById('toStep2').onclick = () => showStep(2);
    document.getElementById('backToStep1').onclick = () => showStep(1);
    document.getElementById('toStep3').onclick = async () => {
        // 验证API配置
        const apiKey = document.getElementById('apiKey').value;
        if (!apiKey) { alert('请输入API Key'); return; }
        selectedProvider = document.getElementById('apiProvider').value;
        selectedModel = document.getElementById('modelSelect').value;
        if (!selectedModel) { alert('请选择模型'); return; }
        showStep(3);
        await startTranslation();
    };
    document.getElementById('backToStep2').onclick = () => showStep(2);
    document.getElementById('toStep4').onclick = () => {
        showStep(4);
        const previewHtml = window.packBuilder.getStructurePreview(translatedResults);
        document.getElementById('packStructure').innerHTML = previewHtml;
    };
    document.getElementById('backToStep3').onclick = () => showStep(3);
    document.getElementById('downloadPack').onclick = async () => {
        const packMeta = {
            pack: {
                pack_format: 12,
                description: "§a自动汉化资源包\n§7由AI生成"
            }
        };
        const packPngResponse = await fetch('pack.png');
        const packPngBlob = packPngResponse.ok ? await packPngResponse.blob() : null;
        
        const zipBlob = await window.packBuilder.buildResourcePack(JSON.stringify(packMeta, null, 2), packPngBlob, translatedResults);
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AutoTrans_ResourcePack.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };
    
    async function startTranslation() {
        const logDiv = document.getElementById('translateLog');
        const progressFill = document.getElementById('translateProgress');
        const progressText = document.getElementById('progressText');
        const toStep4Btn = document.getElementById('toStep4');
        
        logDiv.innerHTML = '';
        translatedResults = {};
        
        const allEntries = window.modLoader.getAllLangEntries();
        let totalKeys = 0;
        for (const entry of allEntries) totalKeys += Object.keys(entry.parsedKeys).length;
        
        let processedKeys = 0;
        const apiKey = document.getElementById('apiKey').value;
        const provider = document.getElementById('apiProvider').value;
        const model = document.getElementById('modelSelect').value;
        const baseUrl = document.getElementById('apiBaseUrl').value || null;
        
        for (const entry of allEntries) {
            const keys = entry.parsedKeys;
            const modId = entry.modId;
            logDiv.innerHTML += `<div class="log-entry">📝 翻译模组: ${entry.modName} (${modId}) - ${Object.keys(keys).length} 条</div>`;
            
            const translated = await window.translator.translateKeys(keys, provider, model, apiKey, baseUrl, (done, total) => {
                const percent = ((processedKeys + done) / totalKeys) * 100;
                progressFill.style.width = `${percent}%`;
                progressText.innerText = `翻译进度: ${processedKeys + done} / ${totalKeys}`;
            });
            
            if (!translatedResults[modId]) translatedResults[modId] = {};
            Object.assign(translatedResults[modId], translated);
            processedKeys += Object.keys(keys).length;
            logDiv.innerHTML += `<div class="log-entry">✅ 完成 ${modId} 翻译</div>`;
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        
        progressFill.style.width = '100%';
        progressText.innerText = '翻译完成！';
        toStep4Btn.disabled = false;
    }
    
    // AI 提供商变更时加载模型列表
    const providerSelect = document.getElementById('apiProvider');
    const modelSelect = document.getElementById('modelSelect');
    const baseUrlRow = document.getElementById('baseUrlRow');
    const apiBaseUrl = document.getElementById('apiBaseUrl');
    
    providerSelect.addEventListener('change', async () => {
        const provider = providerSelect.value;
        if (provider === 'custom') {
            baseUrlRow.style.display = 'flex';
        } else {
            baseUrlRow.style.display = 'none';
            const config = window.apiManager.providers[provider];
            apiBaseUrl.value = config.baseUrl;
        }
        const apiKey = document.getElementById('apiKey').value;
        if (apiKey) {
            await loadModels();
        }
    });
    
    async function loadModels() {
        const provider = providerSelect.value;
        const apiKey = document.getElementById('apiKey').value;
        const baseUrl = apiBaseUrl.value || null;
        if (!apiKey && provider !== 'custom') return;
        modelSelect.innerHTML = '<option>加载模型中...</option>';
        try {
            const models = await window.apiManager.fetchModels(provider, apiKey, baseUrl);
            modelSelect.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
            selectedModel = models[0];
        } catch(e) {
            modelSelect.innerHTML = '<option>加载失败，请检查API设置</option>';
        }
    }
    
    document.getElementById('apiKey').addEventListener('change', loadModels);
    apiBaseUrl.addEventListener('change', loadModels);
    
    showStep(1);
});
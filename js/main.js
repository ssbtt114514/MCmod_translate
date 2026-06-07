// 主控制器
document.addEventListener('DOMContentLoaded', () => {
    const panels = { 
        1: document.getElementById('step1Panel'), 
        2: document.getElementById('step2Panel'), 
        3: document.getElementById('step3Panel'), 
        4: document.getElementById('step4Panel') 
    };
    const steps = document.querySelectorAll('.step');
    let currentStep = 1;
    let loadedMods = [];
    let translatedResults = {};

    function showStep(step) {
        Object.values(panels).forEach(p => p.classList.remove('active'));
        panels[step].classList.add('active');
        steps.forEach((s, idx) => { 
            if (idx + 1 === step) s.classList.add('active'); 
            else s.classList.remove('active'); 
        });
        currentStep = step;
    }

    // 文件上传
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('modFileInput');
    const selectBtn = document.getElementById('selectFilesBtn');
    const modListDiv = document.getElementById('modList');
    const toStep2Btn = document.getElementById('toStep2');

    selectBtn.onclick = () => fileInput.click();
    uploadArea.onclick = () => fileInput.click();
    uploadArea.ondragover = (e) => { e.preventDefault(); uploadArea.style.borderColor = '#764ba2'; };
    uploadArea.ondragleave = () => uploadArea.style.borderColor = '#667eea';
    uploadArea.ondrop = async (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#667eea';
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.jar') || f.name.endsWith('.zip'));
        await loadFiles(files);
    };
    fileInput.onchange = async (e) => { await loadFiles(Array.from(e.target.files)); };

    async function loadFiles(files) {
        if (!files.length) return;
        modListDiv.innerHTML = '<div style="text-align:center">加载中...</div>';
        const results = await modLoader.loadMultiple(files, (cur, total, name) => { 
            modListDiv.innerHTML = `<div style="text-align:center">加载中 ${cur}/${total}: ${name}</div>`; 
        });
        loadedMods = results;
        
        const validMods = loadedMods.filter(m => !m.error && m.langFiles.length > 0);
        const errorMods = loadedMods.filter(m => m.error);
        
        if (validMods.length > 0) {
            let html = '';
            for (const mod of validMods) {
                const langInfo = mod.langFiles.map(l => l.path.split('/').pop()).join(', ');
                html += `<div class="mod-item"><span class="mod-name">📁 ${mod.name}</span><span class="mod-status">${langInfo}</span></div>`;
            }
            if (errorMods.length > 0) {
                html += `<div class="mod-item" style="background:rgba(255,0,0,0.2)"><span class="mod-name">⚠️ 加载失败 ${errorMods.length} 个文件</span></div>`;
            }
            modListDiv.innerHTML = html;
            toStep2Btn.disabled = false;
        } else {
            modListDiv.innerHTML = '<div>❌ 未找到 en_us.lang 或 en_us.json 文件</div>';
            toStep2Btn.disabled = true;
        }
    }

    // 步骤导航
    document.getElementById('toStep2').onclick = () => showStep(2);
    document.getElementById('backToStep1').onclick = () => showStep(1);
    document.getElementById('backToStep2').onclick = () => showStep(2);
    document.getElementById('backToStep3').onclick = () => showStep(3);
    
    document.getElementById('toStep3').onclick = async () => {
        const apiKey = document.getElementById('apiKey').value;
        if (!apiKey) { alert('请输入 API Key'); return; }
        const provider = document.getElementById('apiProvider').value;
        const model = document.getElementById('modelSelect').value;
        if (!model) { alert('请选择或输入模型'); return; }
        showStep(3);
        await startTranslation(provider, model, apiKey);
    };
    
    document.getElementById('toStep4').onclick = () => {
        showStep(4);
        document.getElementById('packStructure').innerHTML = packBuilder.getStructurePreview(translatedResults);
    };
    
    document.getElementById('downloadPack').onclick = async () => {
        const packMeta = JSON.stringify({ 
            pack: { 
                pack_format: 12, 
                description: "§a自动汉化资源包\n§7由AI生成" 
            } 
        }, null, 2);
        const blob = await packBuilder.buildResourcePack(packMeta, translatedResults);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AutoTrans_ResourcePack_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };

    async function startTranslation(provider, model, apiKey) {
        const logDiv = document.getElementById('translateLog');
        const progressFill = document.getElementById('translateProgress');
        const progressText = document.getElementById('progressText');
        const toStep4Btn = document.getElementById('toStep4');
        
        logDiv.innerHTML = '';
        translatedResults = {};
        
        const allLangFiles = modLoader.getAllRawLangFiles();
        
        if (allLangFiles.length === 0) {
            logDiv.innerHTML = '<div class="log-entry">❌ 未找到 en_us.lang 或 en_us.json 文件</div>';
            progressText.innerText = '未找到语言文件';
            return;
        }
        
        const totalFiles = allLangFiles.length;
        const baseUrl = document.getElementById('apiBaseUrl').value || null;
        
        logDiv.innerHTML += `<div class="log-entry">📚 找到 ${totalFiles} 个 en_us 语言文件，开始翻译...</div>`;
        
        const results = await translator.translateMultipleFiles(
            allLangFiles,
            provider,
            model,
            apiKey,
            baseUrl,
            (modName, modId, current, total) => {
                logDiv.innerHTML += `<div class="log-entry">🔄 [${current}/${total}] 正在翻译: ${modName} (${modId})</div>`;
                logDiv.scrollTop = logDiv.scrollHeight;
                const percent = ((current - 1) / total) * 100;
                progressFill.style.width = `${percent}%`;
                progressText.innerText = `翻译进度: ${current - 1} / ${total}`;
            },
            (modName, modId, current, total, success, errorMsg) => {
                if (success) {
                    logDiv.innerHTML += `<div class="log-entry">✅ [${current}/${total}] 完成: ${modName} (${modId})</div>`;
                } else {
                    logDiv.innerHTML += `<div class="log-entry">❌ [${current}/${total}] 失败: ${modName} - ${errorMsg}</div>`;
                }
                const percent = (current / total) * 100;
                progressFill.style.width = `${percent}%`;
                progressText.innerText = `翻译进度: ${current} / ${total}`;
                logDiv.scrollTop = logDiv.scrollHeight;
            }
        );
        
        translatedResults = results;
        
        progressFill.style.width = '100%';
        progressText.innerText = `翻译完成！共 ${totalFiles} 个语言文件`;
        toStep4Btn.disabled = false;
        
        logDiv.innerHTML += `<div class="log-entry">🎉 全部翻译完成！共处理 ${Object.keys(results).length} 个模组的语言文件</div>`;
    }

    // 模型列表管理
    const providerSelect = document.getElementById('apiProvider');
    const modelSelect = document.getElementById('modelSelect');
    const modelSearchInput = document.getElementById('modelSearchInput');
    const refreshModelsBtn = document.getElementById('refreshModelsBtn');
    const manualAddModelBtn = document.getElementById('manualAddModelBtn');
    const manualModelPanel = document.getElementById('manualModelPanel');
    const manualModelInput = document.getElementById('manualModelInput');
    const confirmManualModelBtn = document.getElementById('confirmManualModelBtn');
    const cancelManualModelBtn = document.getElementById('cancelManualModelBtn');
    const baseUrlRow = document.getElementById('baseUrlRow');
    const apiBaseUrl = document.getElementById('apiBaseUrl');

    let allModels = [];

    // 预设模型列表（当自动获取失败时使用）
    const PRESET_MODELS = {
        deepseek: ['deepseek-chat', 'deepseek-coder'],
        openai: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'],
        anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20240620'],
        google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
        custom: []
    };

    async function loadModels() {
        const provider = providerSelect.value;
        const apiKey = document.getElementById('apiKey').value;
        const base = apiBaseUrl.value || null;
        
        if (!apiKey && provider !== 'custom') {
            modelSelect.innerHTML = '<option value="">请先填写 API Key</option>';
            return;
        }
        
        refreshModelsBtn.disabled = true;
        refreshModelsBtn.textContent = '⏳ 加载中...';
        modelSelect.innerHTML = '<option value="">加载模型中...</option>';
        
        try {
            let models = await apiManager.fetchModels(provider, apiKey, base);
            
            // 如果获取失败或结果为空，使用预设模型
            if (!models || models.length === 0) {
                console.log('自动获取失败，使用预设模型列表');
                models = PRESET_MODELS[provider] || [];
            }
            
            // 合并已有的手动添加模型
            const savedManualModels = localStorage.getItem(`manual_models_${provider}`);
            if (savedManualModels) {
                const manualModels = JSON.parse(savedManualModels);
                models = [...new Set([...manualModels, ...models])];
            }
            
            allModels = models;
            renderModelList('');
            
            if (models.length === 0) {
                modelSelect.innerHTML = '<option value="">未获取到模型列表，请手动添加</option>';
            }
        } catch(e) { 
            console.error(e);
            // 使用预设模型
            const fallbackModels = PRESET_MODELS[provider] || [];
            allModels = fallbackModels;
            renderModelList('');
            if (fallbackModels.length === 0) {
                modelSelect.innerHTML = '<option value="">加载失败，请手动添加模型</option>';
            }
        } finally {
            refreshModelsBtn.disabled = false;
            refreshModelsBtn.textContent = '🔄 刷新';
        }
    }

    function renderModelList(searchText) {
        const searchLower = searchText.toLowerCase().trim();
        let filteredModels = allModels;
        
        if (searchLower) {
            filteredModels = allModels.filter(model => 
                model.toLowerCase().includes(searchLower)
            );
        }
        
        if (filteredModels.length === 0) {
            modelSelect.innerHTML = '<option value="">没有找到匹配的模型</option>';
            return;
        }
        
        modelSelect.innerHTML = filteredModels.map(model => 
            `<option value="${model}">${model}</option>`
        ).join('');
        
        const currentSelected = window._selectedModel;
        if (currentSelected && filteredModels.includes(currentSelected)) {
            modelSelect.value = currentSelected;
        }
    }

    // 手动添加模型
    function addManualModel(modelName) {
        if (!modelName || modelName.trim() === '') return;
        modelName = modelName.trim();
        
        const provider = providerSelect.value;
        
        // 保存到 localStorage
        const savedKey = `manual_models_${provider}`;
        const saved = localStorage.getItem(savedKey);
        let manualModels = saved ? JSON.parse(saved) : [];
        
        if (!manualModels.includes(modelName)) {
            manualModels.push(modelName);
            localStorage.setItem(savedKey, JSON.stringify(manualModels));
        }
        
        // 更新当前模型列表
        if (!allModels.includes(modelName)) {
            allModels.unshift(modelName);
        }
        
        renderModelList(modelSearchInput.value);
        modelSelect.value = modelName;
        window._selectedModel = modelName;
        
        // 关闭面板
        manualModelPanel.style.display = 'none';
        manualModelInput.value = '';
    }

    // 搜索输入监听
    modelSearchInput.addEventListener('input', (e) => {
        renderModelList(e.target.value);
    });
    
    // 搜索框也可以作为手动输入（按回车添加）
    modelSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const value = e.target.value.trim();
            if (value && !allModels.includes(value)) {
                addManualModel(value);
            } else if (value && allModels.includes(value)) {
                modelSelect.value = value;
                window._selectedModel = value;
            }
        }
    });

    refreshModelsBtn.onclick = () => {
        loadModels();
    };
    
    manualAddModelBtn.onclick = () => {
        manualModelPanel.style.display = 'block';
        manualModelInput.focus();
    };
    
    confirmManualModelBtn.onclick = () => {
        addManualModel(manualModelInput.value);
    };
    
    cancelManualModelBtn.onclick = () => {
        manualModelPanel.style.display = 'none';
        manualModelInput.value = '';
    };
    
    // 回车添加
    manualModelInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addManualModel(manualModelInput.value);
        }
    });

    modelSelect.addEventListener('change', (e) => {
        window._selectedModel = e.target.value;
    });

    providerSelect.onchange = async () => {
        const val = providerSelect.value;
        baseUrlRow.style.display = val === 'custom' ? 'flex' : 'none';
        if (val !== 'custom' && apiManager.providers[val]) {
            apiBaseUrl.value = apiManager.providers[val].baseUrl;
        }
        
        modelSearchInput.value = '';
        allModels = [];
        modelSelect.innerHTML = '<option value="">点击刷新获取模型列表</option>';
        
        // 加载该提供商保存的手动模型
        const savedManualModels = localStorage.getItem(`manual_models_${val}`);
        if (savedManualModels) {
            const manualModels = JSON.parse(savedManualModels);
            allModels = manualModels;
            renderModelList('');
        }
        
        const apiKey = document.getElementById('apiKey').value;
        if (apiKey || val === 'custom') {
            await loadModels();
        }
    };

    document.getElementById('apiKey').addEventListener('change', () => {
        if (providerSelect.value !== 'custom') {
            loadModels();
        }
    });

    apiBaseUrl.addEventListener('change', () => {
        if (providerSelect.value === 'custom') {
            loadModels();
        }
    });
    
    // 显示 CORS 提示（可选）
    setTimeout(() => {
        const notice = document.getElementById('corsNotice');
        if (notice && !localStorage.getItem('cors_notice_closed')) {
            notice.style.display = 'flex';
        }
    }, 1000);
    
    document.querySelector('#corsNotice button')?.addEventListener('click', () => {
        localStorage.setItem('cors_notice_closed', 'true');
    });
    
    // 默认加载 DeepSeek 模型
    setTimeout(() => {
        if (providerSelect.value === 'deepseek') {
            loadModels();
        }
    }, 500);
    
    showStep(1);
});
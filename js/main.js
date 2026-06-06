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
        if (!model) { alert('请选择模型'); return; }
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
    const baseUrlRow = document.getElementById('baseUrlRow');
    const apiBaseUrl = document.getElementById('apiBaseUrl');

    let allModels = [];
    let currentProvider = 'openai';

    async function loadModels() {
        const provider = providerSelect.value;
        const apiKey = document.getElementById('apiKey').value;
        const base = apiBaseUrl.value || null;
        
        currentProvider = provider;
        
        if (!apiKey && provider !== 'custom') {
            modelSelect.innerHTML = '<option value="">请先填写 API Key</option>';
            return;
        }
        
        refreshModelsBtn.disabled = true;
        refreshModelsBtn.textContent = '⏳ 加载中...';
        modelSelect.innerHTML = '<option value="">加载模型中...</option>';
        
        try {
            const models = await apiManager.fetchModels(provider, apiKey, base);
            allModels = models;
            renderModelList('');
            
            if (models.length === 0) {
                modelSelect.innerHTML = '<option value="">未获取到模型列表</option>';
            }
        } catch(e) { 
            console.error(e);
            modelSelect.innerHTML = `<option value="">加载失败: ${e.message}</option>`;
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

    modelSearchInput.addEventListener('input', (e) => {
        renderModelList(e.target.value);
    });

    refreshModelsBtn.onclick = () => {
        loadModels();
    };

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
    
    showStep(1);
});
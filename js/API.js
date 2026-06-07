// AI模型API管理 - 支持CORS代理和手动添加模型
class AIModelAPI {
    constructor() {
        // CORS代理列表（按可靠性排序）
        this.proxyList = [
            'https://corsproxy.io/?url=',
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/'
        ];
        this.currentProxyIndex = 0;
        
        // 提供商配置
        this.providers = {
            openai: { 
                name: 'OpenAI', 
                baseUrl: 'https://api.openai.com/v1', 
                modelsUrl: '/models', 
                chatUrl: '/chat/completions', 
                defaultModels: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'],
                needsProxy: true,
                authHeader: (key) => ({ 'Authorization': `Bearer ${key}` })
            },
            anthropic: { 
                name: 'Anthropic', 
                baseUrl: 'https://api.anthropic.com/v1', 
                modelsUrl: '/models', 
                chatUrl: '/messages', 
                defaultModels: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20240620'],
                needsProxy: true,
                authHeader: (key) => ({ 
                    'x-api-key': key, 
                    'anthropic-version': '2023-06-01' 
                })
            },
            google: { 
                name: 'Google', 
                baseUrl: 'https://generativelanguage.googleapis.com/v1beta', 
                modelsUrl: '/models', 
                chatUrl: '/models/{model}:generateContent', 
                defaultModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
                needsProxy: false,
                authHeader: (key) => ({}) // Google使用URL参数
            },
            deepseek: { 
                name: 'DeepSeek', 
                baseUrl: 'https://api.deepseek.com/v1', 
                modelsUrl: '/models', 
                chatUrl: '/chat/completions', 
                defaultModels: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
                needsProxy: true,
                authHeader: (key) => ({ 'Authorization': `Bearer ${key}` })
            },
            custom: { 
                name: '自定义', 
                baseUrl: '', 
                modelsUrl: '/models', 
                chatUrl: '/chat/completions', 
                defaultModels: [],
                needsProxy: false,
                authHeader: (key) => ({ 'Authorization': `Bearer ${key}` })
            }
        };
    }

    /**
     * 获取代理URL
     */
    getProxyUrl(originalUrl) {
        const proxy = this.proxyList[this.currentProxyIndex];
        if (proxy.includes('?url=')) {
            return proxy + encodeURIComponent(originalUrl);
        }
        return proxy + originalUrl;
    }

    /**
     * 切换到下一个代理
     */
    switchProxy() {
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyList.length;
        console.log(`[AIModelAPI] 切换到代理: ${this.proxyList[this.currentProxyIndex]}`);
    }

    /**
     * 重置代理索引
     */
    resetProxy() {
        this.currentProxyIndex = 0;
    }

    /**
     * 构建请求头
     */
    buildHeaders(provider, apiKey) {
        const config = this.providers[provider];
        const headers = { 'Content-Type': 'application/json' };
        
        if (provider === 'google') return headers;
        
        const authHeaders = config.authHeader(apiKey);
        Object.assign(headers, authHeaders);
        
        return headers;
    }

    /**
     * 解析模型列表响应
     */
    parseModels(data) {
        let models = [];
        
        if (data.data && Array.isArray(data.data)) {
            // OpenAI格式
            models = data.data;
        } else if (data.models && Array.isArray(data.models)) {
            // 通用格式
            models = data.models;
        } else if (Array.isArray(data)) {
            // 直接数组
            models = data;
        }
        
        // 提取模型ID并去重
        const ids = models
            .map(m => m.id || m.model || m.name || m)
            .filter(id => typeof id === 'string' && id.length > 0);
            
        return [...new Set(ids)];
    }

    /**
     * 获取模型列表
     * @param {string} provider - 提供商key
     * @param {string} apiKey - API密钥
     * @param {string|null} baseUrl - 自定义基础URL
     * @returns {Promise<string[]>} 模型ID列表
     */
    async fetchModels(provider, apiKey, baseUrl = null) {
        const config = this.providers[provider];
        
        // 确定URL
        let url = baseUrl || config.baseUrl;
        if (!url && provider !== 'custom') url = config.baseUrl;
        if (!url) throw new Error('请填写API地址');
        
        // Google特殊处理：直接返回默认模型（其API需要特殊参数）
        if (provider === 'google') {
            console.log('[AIModelAPI] Google使用默认模型列表');
            return config.defaultModels;
        }

        const fullUrl = url.replace(/\/+$/, '') + config.modelsUrl;
        const headers = this.buildHeaders(provider, apiKey);
        
        // 尝试获取（带代理轮询）
        const maxAttempts = config.needsProxy ? this.proxyList.length + 1 : 1;
        const errors = [];
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                let requestUrl = fullUrl;
                
                // 非自定义且需要代理时使用代理
                if (config.needsProxy && provider !== 'custom' && attempt > 0) {
                    requestUrl = this.getProxyUrl(fullUrl);
                }
                
                console.log(`[AIModelAPI] 尝试获取模型列表 (${attempt + 1}/${maxAttempts}):`, 
                    requestUrl.replace(apiKey, '***'));
                
                const response = await fetch(requestUrl, { 
                    method: 'GET', 
                    headers 
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const models = this.parseModels(data);
                    
                    if (models.length > 0) {
                        console.log(`[AIModelAPI] 成功获取 ${models.length} 个模型`);
                        return models;
                    }
                    
                    errors.push('返回的模型列表为空');
                } else {
                    const errorText = await response.text();
                    errors.push(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
                    
                    // 如果是认证错误，不再重试
                    if (response.status === 401) {
                        throw new Error('API密钥无效或已过期');
                    }
                }
                
            } catch (e) {
                errors.push(e.message);
                if (config.needsProxy && provider !== 'custom') {
                    this.switchProxy();
                }
            }
        }
        
        // 所有尝试失败，返回默认模型
        console.warn('[AIModelAPI] 自动获取失败，使用默认模型列表:', errors.join('; '));
        return config.defaultModels;
    }

    /**
     * 构建聊天请求体
     */
    buildChatBody(provider, model, text) {
        const bodies = {
            openai: {
                model: model,
                messages: [{ role: 'user', content: text }],
                temperature: 0.1,
                max_tokens: 4096
            },
            deepseek: {
                model: model,
                messages: [{ role: 'user', content: text }],
                temperature: 0.1,
                max_tokens: 4096
            },
            custom: {
                model: model,
                messages: [{ role: 'user', content: text }],
                temperature: 0.1,
                max_tokens: 4096
            },
            anthropic: {
                model: model,
                max_tokens: 4096,
                messages: [{ role: 'user', content: text }]
            },
            google: {
                contents: [{ parts: [{ text: text }] }]
            }
        };
        
        return bodies[provider] || bodies.custom;
    }

    /**
     * 构建聊天请求URL
     */
    buildChatUrl(provider, model, apiKey, baseUrl) {
        const config = this.providers[provider];
        let url = (baseUrl || config.baseUrl).replace(/\/+$/, '');
        
        if (provider === 'google') {
            return `${url}/models/${model}:generateContent?key=${apiKey}`;
        }
        
        let chatUrl = config.chatUrl;
        if (chatUrl.includes('{model}')) {
            chatUrl = chatUrl.replace('{model}', model);
        }
        
        let fullUrl = url + chatUrl;
        
        // 需要代理时包装URL
        if (config.needsProxy && provider !== 'custom') {
            fullUrl = this.getProxyUrl(fullUrl);
        }
        
        return fullUrl;
    }

    /**
     * 解析聊天响应
     */
    parseChatResponse(provider, data) {
        try {
            switch (provider) {
                case 'anthropic':
                    return data.content?.[0]?.text || data.completion;
                case 'google':
                    return data.candidates?.[0]?.content?.parts?.[0]?.text;
                case 'openai':
                case 'deepseek':
                case 'custom':
                default:
                    return data.choices?.[0]?.message?.content || 
                           data.choices?.[0]?.text;
            }
        } catch (e) {
            console.error('[AIModelAPI] 解析响应失败:', e);
            return null;
        }
    }

    /**
     * 发送聊天/翻译请求
     * @param {string} text - 输入文本
     * @param {string} provider - 提供商
     * @param {string} model - 模型ID
     * @param {string} apiKey - API密钥
     * @param {string|null} baseUrl - 自定义URL
     * @returns {Promise<string>} 生成的文本
     */
    async translate(text, provider, model, apiKey, baseUrl) {
        const config = this.providers[provider];
        
        // 构建请求
        const fullUrl = this.buildChatUrl(provider, model, apiKey, baseUrl);
        const headers = this.buildHeaders(provider, apiKey);
        const body = this.buildChatBody(provider, model, text);
        
        console.log('[AIModelAPI] 发送请求到:', fullUrl.replace(apiKey, '***'));
        
        // 发送请求
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API错误 (${response.status}): ${errText.substring(0, 200)}`);
        }
        
        const data = await response.json();
        
        // 记录用量
        if (data.usage) {
            console.log(`[AIModelAPI] Token消耗 - 输入:${data.usage.prompt_tokens || '-'}, ` +
                `输出:${data.usage.completion_tokens || '-'}, ` +
                `总计:${data.usage.total_tokens || '-'}`);
        }
        
        // 解析响应
        const result = this.parseChatResponse(provider, data);
        if (result === null) {
            throw new Error('无法解析API响应');
        }
        
        return result;
    }

    /**
     * 获取所有支持的提供商
     */
    getProviders() {
        return Object.entries(this.providers).map(([key, config]) => ({
            key,
            name: config.name,
            needsProxy: config.needsProxy,
            hasDefaultModels: config.defaultModels.length > 0
        }));
    }

    /**
     * 验证配置是否完整
     */
    validateConfig(provider, apiKey, baseUrl) {
        const config = this.providers[provider];
        const errors = [];
        
        if (provider !== 'custom' && !apiKey) {
            errors.push('需要API密钥');
        }
        
        if (provider === 'custom' && !baseUrl) {
            errors.push('自定义提供商需要填写API地址');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// 导出实例
window.apiManager = new AIModelAPI();

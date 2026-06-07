// AI模型API管理 - 使用CORS代理解决跨域问题
class AIModelAPI {
    constructor() {
        // CORS代理地址（需要先访问 https://cors-anywhere.herokuapp.com/ 获取临时访问权限）
        this.corsProxy = 'https://cors-anywhere.herokuapp.com/';
        
        this.providers = {
            openai: { 
                name: 'OpenAI', 
                baseUrl: 'https://api.openai.com/v1', 
                modelsUrl: '/models', 
                chatUrl: '/chat/completions', 
                defaultModels: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'],
                needsProxy: true
            },
            anthropic: { 
                name: 'Anthropic', 
                baseUrl: 'https://api.anthropic.com/v1', 
                modelsUrl: '/models', 
                chatUrl: '/messages', 
                defaultModels: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20240620'],
                needsProxy: true
            },
            google: { 
                name: 'Google', 
                baseUrl: 'https://generativelanguage.googleapis.com/v1beta', 
                modelsUrl: '/models', 
                chatUrl: '/models/{model}:generateContent', 
                defaultModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
                needsProxy: false  // Google 可以用 key 参数绕过 CORS
            },
            deepseek: { 
                name: 'DeepSeek', 
                baseUrl: 'https://api.deepseek.com/v1', 
                modelsUrl: '/models', 
                chatUrl: '/chat/completions', 
                defaultModels: ['deepseek-chat', 'deepseek-coder'],
                needsProxy: true
            },
            custom: { 
                name: '自定义', 
                baseUrl: '', 
                modelsUrl: '/models', 
                chatUrl: '/chat/completions', 
                defaultModels: [],
                needsProxy: false
            }
        };
    }

    async fetchModels(provider, apiKey, baseUrl = null) {
        const config = this.providers[provider];
        let url = baseUrl || config.baseUrl;
        if (!url && provider !== 'custom') url = config.baseUrl;
        if (!url) throw new Error('请填写API地址');
        
        const fullUrl = url + config.modelsUrl;
        
        // 构建请求头
        const headers = { 'Content-Type': 'application/json' };
        
        if (provider === 'anthropic') { 
            headers['x-api-key'] = apiKey; 
            headers['anthropic-version'] = '2023-06-01'; 
        } else if (provider === 'google') {
            // Google 使用 URL 参数传递 key，不需要 Authorization header
            // 直接返回预设模型，因为 Google 的 models API 需要额外权限
            return config.defaultModels;
        } else if (provider !== 'custom') { 
            headers['Authorization'] = `Bearer ${apiKey}`; 
        }
        
        try {
            let response;
            
            // 判断是否需要使用代理
            if (config.needsProxy && provider !== 'custom') {
                // 使用 CORS 代理
                const proxyUrl = this.corsProxy + fullUrl;
                console.log('通过代理获取模型列表:', proxyUrl);
                response = await fetch(proxyUrl, { headers });
            } else {
                // 直接请求
                response = await fetch(fullUrl, { headers });
            }
            
            if (response.ok) {
                const data = await response.json();
                let models = [];
                
                // 根据不同API响应格式提取模型列表
                if (data.data && Array.isArray(data.data)) {
                    models = data.data;
                } else if (data.models && Array.isArray(data.models)) {
                    models = data.models;
                } else if (Array.isArray(data)) {
                    models = data;
                }
                
                // 应用过滤
                if (models.length > 0) {
                    let filtered = models.map(m => m.id || m.model || m.name).filter(Boolean);
                    // 去重
                    filtered = [...new Set(filtered)];
                    
                    if (filtered.length > 0) {
                        return filtered;
                    }
                }
            } else {
                const errorText = await response.text();
                console.warn(`获取模型列表失败 (${response.status}):`, errorText.substring(0, 200));
            }
        } catch(e) { 
            console.warn('获取模型列表失败，使用默认模型:', e.message); 
        }
        
        // 失败时返回默认模型列表
        return config.defaultModels;
    }

    async translate(text, provider, model, apiKey, baseUrl) {
        const config = this.providers[provider];
        let url = baseUrl || config.baseUrl;
        let fullUrl, headers, body;
        
        if (provider === 'anthropic') {
            fullUrl = url + config.chatUrl;
            headers = { 
                'Content-Type': 'application/json', 
                'x-api-key': apiKey, 
                'anthropic-version': '2023-06-01' 
            };
            body = { 
                model: model, 
                max_tokens: 4096, 
                messages: [{ role: 'user', content: text }] 
            };
            
            // Anthropic 翻译请求也需要使用代理
            if (config.needsProxy) {
                fullUrl = this.corsProxy + fullUrl;
            }
        } else if (provider === 'google') {
            fullUrl = `${url}/models/${model}:generateContent?key=${apiKey}`;
            headers = { 'Content-Type': 'application/json' };
            body = { contents: [{ parts: [{ text: text }] }] };
            // Google 不需要代理
        } else {
            fullUrl = url + config.chatUrl;
            headers = { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${apiKey}` 
            };
            body = { 
                model: model, 
                messages: [{ role: 'user', content: text }], 
                temperature: 0.1,
                max_tokens: 4096
            };
            
            // 翻译请求也需要使用代理
            if (config.needsProxy && provider !== 'custom') {
                fullUrl = this.corsProxy + fullUrl;
            }
        }
        
        console.log('发送翻译请求到:', fullUrl);
        
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
        
        // 打印token消耗
        if (data.usage) {
            console.log(`Token消耗 - 输入:${data.usage.prompt_tokens}, 输出:${data.usage.completion_tokens}, 缓存命中:${data.usage.prompt_cache_hit_tokens || 0}`);
        }
        
        if (provider === 'anthropic') return data.content[0].text;
        if (provider === 'google') return data.candidates[0].content.parts[0].text;
        return data.choices[0].message.content;
    }
}

window.apiManager = new AIModelAPI();
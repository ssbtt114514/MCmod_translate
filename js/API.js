// AI模型API管理
class AIModelAPI {
    constructor() {
        this.providers = {
            openai: { 
                name: 'OpenAI', 
                baseUrl: 'https://api.openai.com/v1', 
                modelsUrl: '/models', 
                chatUrl: '/chat/completions', 
                defaultModels: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
                filterModels: (models) => models.filter(m => 
                    m.id && (m.id.includes('gpt') || m.id.includes('turbo')) && !m.id.includes('instruct')
                ).map(m => m.id)
            },
            anthropic: { 
                name: 'Anthropic', 
                baseUrl: 'https://api.anthropic.com/v1', 
                modelsUrl: '/models', 
                chatUrl: '/messages', 
                defaultModels: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
                filterModels: (models) => models.filter(m => 
                    m.type === 'claude' || m.id?.includes('claude')
                ).map(m => m.id || m.model)
            },
            google: { 
                name: 'Google', 
                baseUrl: 'https://generativelanguage.googleapis.com/v1beta', 
                modelsUrl: '/models', 
                chatUrl: '/models/{model}:generateContent', 
                defaultModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
                filterModels: (models) => models.filter(m => 
                    m.name && (m.name.includes('gemini') || m.name.includes('1.5'))
                ).map(m => m.name.split('/').pop())
            },
            deepseek: { 
                name: 'DeepSeek', 
                baseUrl: 'https://api.deepseek.com/v1', 
                modelsUrl: '/models', 
                chatUrl: '/chat/completions', 
                defaultModels: ['deepseek-chat', 'deepseek-coder'],
                filterModels: (models) => models.filter(m => 
                    m.id && (m.id.includes('deepseek') || m.id.includes('chat'))
                ).map(m => m.id)
            },
            custom: { 
                name: '自定义', 
                baseUrl: '', 
                modelsUrl: '/models', 
                chatUrl: '/chat/completions', 
                defaultModels: [],
                filterModels: (models) => models.map(m => m.id || m)
            }
        };
    }

    async fetchModels(provider, apiKey, baseUrl = null) {
        const config = this.providers[provider];
        let url = baseUrl || config.baseUrl;
        if (!url && provider !== 'custom') url = config.baseUrl;
        if (!url) throw new Error('请填写API地址');
        
        const fullUrl = url + config.modelsUrl;
        const headers = { 'Content-Type': 'application/json' };
        
        if (provider === 'anthropic') { 
            headers['x-api-key'] = apiKey; 
            headers['anthropic-version'] = '2023-06-01'; 
        } else if (provider !== 'google' && provider !== 'custom') { 
            headers['Authorization'] = `Bearer ${apiKey}`; 
        }
        
        try {
            if (provider === 'google') return config.defaultModels;
            
            const response = await fetch(fullUrl, { headers });
            if (response.ok) {
                const data = await response.json();
                let models = [];
                
                if (data.data && Array.isArray(data.data)) {
                    models = data.data;
                } else if (data.models && Array.isArray(data.models)) {
                    models = data.models;
                } else if (Array.isArray(data)) {
                    models = data;
                }
                
                if (config.filterModels && models.length > 0) {
                    return config.filterModels(models);
                }
                
                return models.map(m => m.id || m.model || m.name).filter(Boolean);
            }
        } catch(e) { 
            console.warn('获取模型列表失败，使用默认模型:', e); 
        }
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
        } else if (provider === 'google') {
            fullUrl = `${url}/models/${model}:generateContent?key=${apiKey}`;
            headers = { 'Content-Type': 'application/json' };
            body = { contents: [{ parts: [{ text: text }] }] };
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
        }
        
        const response = await fetch(fullUrl, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API错误 (${response.status}): ${errText.substring(0, 200)}`);
        }
        const data = await response.json();
        
        if (data.usage) {
            console.log(`Token消耗 - 输入:${data.usage.prompt_tokens}, 输出:${data.usage.completion_tokens}, 缓存命中:${data.usage.prompt_cache_hit_tokens || 0}`);
        }
        
        if (provider === 'anthropic') return data.content[0].text;
        if (provider === 'google') return data.candidates[0].content.parts[0].text;
        return data.choices[0].message.content;
    }
}

window.apiManager = new AIModelAPI();
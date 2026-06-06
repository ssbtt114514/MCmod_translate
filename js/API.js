// js/API.js - AI模型API管理
class AIModelAPI {
    constructor() {
        this.providers = {
            openai: {
                name: 'OpenAI',
                baseUrl: 'https://api.openai.com/v1',
                modelsUrl: '/models',
                chatUrl: '/chat/completions',
                defaultModels: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
            },
            anthropic: {
                name: 'Anthropic',
                baseUrl: 'https://api.anthropic.com/v1',
                modelsUrl: '/models',
                chatUrl: '/messages',
                defaultModels: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
            },
            google: {
                name: 'Google',
                baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
                modelsUrl: '/models',
                chatUrl: '/models/{model}:generateContent',
                defaultModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro']
            },
            deepseek: {
                name: 'DeepSeek',
                baseUrl: 'https://api.deepseek.com/v1',
                modelsUrl: '/models',
                chatUrl: '/chat/completions',
                defaultModels: ['deepseek-chat', 'deepseek-coder']
            },
            custom: {
                name: '自定义',
                baseUrl: '',
                modelsUrl: '/models',
                chatUrl: '/chat/completions',
                defaultModels: []
            }
        };
    }

    async fetchModels(provider, apiKey, baseUrl = null) {
        const config = this.providers[provider];
        let url = baseUrl || config.baseUrl;
        if (!url) throw new Error('请填写API地址');
        
        const modelsEndpoint = config.modelsUrl;
        const fullUrl = url + modelsEndpoint;
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (provider === 'anthropic') {
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
        } else if (provider === 'google') {
            // Google 使用查询参数 key
            return config.defaultModels; // 简化处理，实际可调用API
        } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        try {
            // 尝试获取真实模型列表
            const response = await fetch(fullUrl, { headers });
            if (response.ok) {
                const data = await response.json();
                if (data.data && Array.isArray(data.data)) {
                    return data.data.map(m => m.id);
                }
            }
        } catch(e) {
            console.warn('无法获取模型列表，使用默认模型', e);
        }
        return config.defaultModels;
    }

    async translate(text, provider, model, apiKey, baseUrl) {
        const config = this.providers[provider];
        let url = baseUrl || config.baseUrl;
        const chatEndpoint = config.chatUrl;
        
        let fullUrl, headers, body;
        
        // 构建请求体
        const systemPrompt = '你是一个Minecraft模组汉化专家，请将以下英文游戏文本翻译成简体中文。保持游戏术语准确，只返回翻译结果，不要加任何解释。';
        
        if (provider === 'anthropic') {
            fullUrl = url + chatEndpoint;
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            };
            body = {
                model: model,
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: text }]
            };
        } else if (provider === 'google') {
            fullUrl = `${url}/models/${model}:generateContent?key=${apiKey}`;
            headers = { 'Content-Type': 'application/json' };
            body = {
                contents: [{ parts: [{ text: systemPrompt + '\n\n原文：' + text }] }]
            };
        } else {
            fullUrl = url + chatEndpoint;
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            body = {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ],
                temperature: 0.3
            };
        }
        
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API错误: ${response.status} ${err}`);
        }
        
        const data = await response.json();
        
        // 提取翻译结果
        if (provider === 'anthropic') {
            return data.content[0].text;
        } else if (provider === 'google') {
            return data.candidates[0].content.parts[0].text;
        } else {
            return data.choices[0].message.content;
        }
    }
}

window.apiManager = new AIModelAPI();
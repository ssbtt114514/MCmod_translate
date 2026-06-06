// js/translate.js - 调用API翻译并生成汉化文件
class Translator {
    constructor() {
        this.translationCache = new Map();
    }
    
    async translateKeys(keysMap, apiProvider, model, apiKey, baseUrl, onProgress) {
        const translated = {};
        const entries = Object.entries(keysMap);
        let completed = 0;
        
        // 批量翻译（每次最多5条合并请求减少API调用）
        const batchSize = 5;
        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = entries.slice(i, i + batchSize);
            const batchPromises = batch.map(async ([key, value]) => {
                // 如果已经缓存，直接使用
                if (this.translationCache.has(value)) {
                    translated[key] = this.translationCache.get(value);
                    return;
                }
                
                try {
                    const result = await window.apiManager.translate(value, apiProvider, model, apiKey, baseUrl);
                    const cleanResult = result.replace(/^["']|["']$/g, '').trim();
                    this.translationCache.set(value, cleanResult);
                    translated[key] = cleanResult;
                } catch(err) {
                    console.error(`翻译失败 ${key}:`, err);
                    translated[key] = value; // 保留原文
                }
            });
            
            await Promise.all(batchPromises);
            completed += batch.length;
            if (onProgress) onProgress(completed, entries.length);
        }
        
        return translated;
    }
    
    generateZhCnJson(translatedMap) {
        return JSON.stringify(translatedMap, null, 2);
    }
}

window.translator = new Translator();
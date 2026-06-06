// 翻译模块 - 整文件翻译，保持格式
class Translator {
    constructor() {
        this.translationCache = new Map();
    }
    
    async translateFullFile(originalContent, ext, apiProvider, model, apiKey, baseUrl) {
        const cacheKey = originalContent.substring(0, 500) + ext;
        if (this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }
        
        // 精简后的 system prompt，确保放在最前面以命中硬盘缓存
        const systemPrompt = '翻译Minecraft模组语言文件为简体中文。保持所有键名不变，只翻译等号或冒号后面的文本，保留原文件格式。只输出翻译结果，不加解释。\n\n';
        
        const fullPrompt = systemPrompt + originalContent;
        
        const result = await window.apiManager.translate(
            fullPrompt, 
            apiProvider, 
            model, 
            apiKey, 
            baseUrl
        );
        
        let cleanedResult = result.trim();
        if (cleanedResult.startsWith('```json') || cleanedResult.startsWith('```')) {
            cleanedResult = cleanedResult.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');
        }
        
        this.translationCache.set(cacheKey, cleanedResult);
        return cleanedResult;
    }
    
    async translateMultipleFiles(files, apiProvider, model, apiKey, baseUrl, onFileStart, onFileComplete) {
        const results = {};
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const modId = file.modId;
            
            if (onFileStart) {
                onFileStart(file.modName, modId, i + 1, files.length);
            }
            
            try {
                const translatedContent = await this.translateFullFile(
                    file.originalContent,
                    file.ext,
                    apiProvider,
                    model,
                    apiKey,
                    baseUrl
                );
                
                if (!results[modId]) {
                    results[modId] = {};
                }
                results[modId].content = translatedContent;
                results[modId].ext = file.ext;
                
                if (onFileComplete) {
                    onFileComplete(file.modName, modId, i + 1, files.length, true);
                }
            } catch(err) {
                console.error(`翻译 ${file.modName} 失败:`, err);
                if (!results[modId]) {
                    results[modId] = {};
                }
                results[modId].content = file.originalContent;
                results[modId].ext = file.ext;
                
                if (onFileComplete) {
                    onFileComplete(file.modName, modId, i + 1, files.length, false, err.message);
                }
            }
        }
        
        return results;
    }
}

window.translator = new Translator();
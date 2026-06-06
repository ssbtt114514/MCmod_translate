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
        
        let systemPrompt = '';
        if (ext === 'json') {
            systemPrompt = `你是一个Minecraft模组汉化专家。请将以下JSON格式的语言文件中的所有英文文本值翻译成简体中文。
严格要求：
1. 保持JSON的键名(key)完全不变
2. 只翻译值(value)部分
3. 保持JSON结构、缩进、格式完全不变
4. 不要添加任何额外的解释或注释
5. 直接返回翻译后的JSON内容

以下是需要翻译的JSON内容：`;
        } else {
            systemPrompt = `你是一个Minecraft模组汉化专家。请将以下lang格式的语言文件中的所有英文文本翻译成简体中文。
严格要求：
1. 保持每行的键名(key)完全不变（等号=左边的内容）
2. 只翻译等号=右边的文本值
3. 保持lang文件的格式：每行是 key=翻译后的value
4. 不要修改注释（以#开头的行保持原样）
5. 不要添加任何额外的解释
6. 直接返回翻译后的lang文件内容

以下是需要翻译的lang内容：`;
        }
        
        const fullPrompt = systemPrompt + "\n\n" + originalContent;
        
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
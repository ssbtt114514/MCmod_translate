// js/translate.js - 整文件翻译，保持原格式
class Translator {
    constructor() {
        this.translationCache = new Map();
    }
    
    // 翻译整个语言文件内容
    async translateFullFile(originalContent, ext, apiProvider, model, apiKey, baseUrl, onProgress) {
        // 检查缓存（可选，以文件内容为key）
        const cacheKey = originalContent;
        if (this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }
        
        // 构建提示词
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
            // .lang 文件格式
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
        
        try {
            const fullPrompt = systemPrompt + "\n\n" + originalContent;
            
            const result = await window.apiManager.translate(
                fullPrompt, 
                apiProvider, 
                model, 
                apiKey, 
                baseUrl
            );
            
            // 清理可能的markdown代码块标记
            let cleanedResult = result.trim();
            if (cleanedResult.startsWith('```json') || cleanedResult.startsWith('```')) {
                cleanedResult = cleanedResult.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');
            } else if (ext === 'lang' && cleanedResult.startsWith('```')) {
                cleanedResult = cleanedResult.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }
            
            this.translationCache.set(cacheKey, cleanedResult);
            return cleanedResult;
        } catch(err) {
            console.error('翻译失败:', err);
            throw err;
        }
    }
    
    // 批量翻译多个文件
    async translateMultipleFiles(files, apiProvider, model, apiKey, baseUrl, onFileProgress, onItemProgress) {
        const results = {};
        let completedFiles = 0;
        
        for (const file of files) {
            const modId = file.modId;
            
            if (onFileProgress) {
                onFileProgress(file.modName, file.modId, completedFiles + 1, files.length);
            }
            
            try {
                const translatedContent = await this.translateFullFile(
                    file.originalContent,
                    file.ext,
                    apiProvider,
                    model,
                    apiKey,
                    baseUrl,
                    (done, total) => {
                        if (onItemProgress) onItemProgress(modId, done, total);
                    }
                );
                
                if (!results[modId]) {
                    results[modId] = {};
                }
                // 保存翻译后的内容和后缀名
                results[modId].content = translatedContent;
                results[modId].ext = file.ext;
                
            } catch(err) {
                console.error(`翻译 ${file.modName} 失败:`, err);
                // 失败时保留原文
                if (!results[modId]) {
                    results[modId] = {};
                }
                results[modId].content = file.originalContent;
                results[modId].ext = file.ext;
            }
            
            completedFiles++;
        }
        
        return results;
    }
}

window.translator = new Translator();
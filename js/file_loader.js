// js/file_loader.js - 只读取 en_us 语言文件
class ModLoader {
    constructor() {
        this.mods = [];
    }

    async loadMod(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target.result;
                try {
                    const zip = await JSZip.loadAsync(arrayBuffer);
                    const langFiles = [];
                    
                    // 修改正则：只匹配 en_us.lang 或 en_us.json
                    // 路径格式: assets/模组id/lang/en_us.lang 或 en_us.json
                    const enUsRegex = /assets\/[^\/]+\/lang\/en_us\.(lang|json)$/i;
                    
                    for (const [filename, entry] of Object.entries(zip.files)) {
                        if (!entry.dir && enUsRegex.test(filename)) {
                            let content = await entry.async('string');
                            // 获取文件后缀 (.lang 或 .json)
                            const ext = filename.match(/\.(lang|json)$/i)[1].toLowerCase();
                            const modId = this.extractModId(filename);
                            
                            langFiles.push({
                                path: filename,
                                content: content,
                                modId: modId,
                                ext: ext  // 保存后缀名
                            });
                        }
                    }
                    
                    resolve({
                        name: file.name,
                        size: file.size,
                        zip: zip,
                        langFiles: langFiles,
                        rawFile: arrayBuffer
                    });
                } catch(err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    
    extractModId(filepath) {
        const match = filepath.match(/assets\/([^\/]+)\/lang/);
        return match ? match[1] : 'unknown';
    }
    
    async loadMultiple(files, onProgress) {
        const results = [];
        for (let i = 0; i < files.length; i++) {
            if (onProgress) onProgress(i + 1, files.length, files[i].name);
            const mod = await this.loadMod(files[i]);
            results.push(mod);
        }
        this.mods = results;
        return results;
    }
    
    // 获取所有待翻译的语言文件（整个文件内容，不解析）
    getAllRawLangFiles() {
        const entries = [];
        for (const mod of this.mods) {
            for (const lang of mod.langFiles) {
                entries.push({
                    modName: mod.name,
                    modId: lang.modId,
                    originalPath: lang.path,
                    originalContent: lang.content,  // 完整文件内容
                    ext: lang.ext  // lang 或 json
                });
            }
        }
        return entries;
    }
}

window.modLoader = new ModLoader();
// js/file_loader.js - 加载和解压模组文件
class ModLoader {
    constructor() {
        this.mods = []; // 存储每个模组的原始zip数据和语言文件路径
    }

    async loadMod(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target.result;
                try {
                    const zip = await JSZip.loadAsync(arrayBuffer);
                    const langFiles = [];
                    
                    // 查找所有语言文件: assets/*/lang/*.lang 或 *.json
                    const langRegex = /assets\/[^\/]+\/lang\/[^\/]+\.(lang|json)$/i;
                    
                    for (const [filename, entry] of Object.entries(zip.files)) {
                        if (!entry.dir && langRegex.test(filename)) {
                            let content = await entry.async('string');
                            langFiles.push({
                                path: filename,
                                content: content,
                                modId: this.extractModId(filename)
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
    
    getAllLangEntries() {
        const entries = [];
        for (const mod of this.mods) {
            for (const lang of mod.langFiles) {
                entries.push({
                    modName: mod.name,
                    modId: lang.modId,
                    originalPath: lang.path,
                    originalContent: lang.content,
                    translatedPath: lang.path,
                    parsedKeys: this.parseLangContent(lang.content)
                });
            }
        }
        return entries;
    }
    
    parseLangContent(content) {
        const keys = {};
        // 支持 .lang (key=value) 和 .json 格式
        if (content.trim().startsWith('{')) {
            try {
                const json = JSON.parse(content);
                Object.assign(keys, json);
            } catch(e) {}
        } else {
            const lines = content.split(/\r?\n/);
            for (const line of lines) {
                const eqIndex = line.indexOf('=');
                if (eqIndex > 0 && !line.startsWith('#')) {
                    const key = line.substring(0, eqIndex).trim();
                    const value = line.substring(eqIndex + 1).trim();
                    if (key) keys[key] = value;
                }
            }
        }
        return keys;
    }
}

window.modLoader = new ModLoader();
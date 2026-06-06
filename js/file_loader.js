// 模组文件加载器 - 只读取 en_us.lang 或 en_us.json
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
                    
                    const enUsRegex = /assets\/[^\/]+\/lang\/en_us\.(lang|json)$/i;
                    
                    for (const [filename, entry] of Object.entries(zip.files)) {
                        if (!entry.dir && enUsRegex.test(filename)) {
                            let content = await entry.async('string');
                            const extMatch = filename.match(/\.(lang|json)$/i);
                            const ext = extMatch ? extMatch[1].toLowerCase() : 'lang';
                            const modId = this.extractModId(filename);
                            
                            langFiles.push({
                                path: filename,
                                content: content,
                                modId: modId,
                                ext: ext
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
            try {
                const mod = await this.loadMod(files[i]);
                results.push(mod);
            } catch(err) {
                console.error(`加载 ${files[i].name} 失败:`, err);
                results.push({ name: files[i].name, error: true, langFiles: [] });
            }
        }
        this.mods = results;
        return results;
    }
    
    getAllRawLangFiles() {
        const entries = [];
        for (const mod of this.mods) {
            if (mod.error) continue;
            for (const lang of mod.langFiles) {
                entries.push({
                    modName: mod.name,
                    modId: lang.modId,
                    originalPath: lang.path,
                    originalContent: lang.content,
                    ext: lang.ext
                });
            }
        }
        return entries;
    }
}

window.modLoader = new ModLoader();
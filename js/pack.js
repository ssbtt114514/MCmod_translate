// js/pack.js - 打包资源包
class PackBuilder {
    constructor() {
        this.files = new Map(); // 存储要打包的文件结构
    }
    
    addFile(path, content) {
        this.files.set(path, content);
    }
    
    async buildResourcePack(packMcmetaContent, packPngBlob, translatedData) {
        const zip = new JSZip();
        
        // 添加 pack.mcmeta
        zip.file('pack.mcmeta', packMcmetaContent);
        
        // 添加 pack.png
        if (packPngBlob) {
            zip.file('pack.png', packPngBlob);
        }
        
        // 为每个模组添加翻译文件
        for (const [modId, translations] of Object.entries(translatedData)) {
            const jsonContent = JSON.stringify(translations, null, 2);
            const langPath = `assets/${modId}/lang/zh_cn.json`;
            zip.file(langPath, jsonContent);
        }
        
        return await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });
    }
    
    getStructurePreview(translatedData) {
        let html = '<ul>';
        html += '<li>📦 资源包根目录</li><ul>';
        html += '<li>📄 pack.mcmeta</li>';
        html += '<li>🖼️ pack.png</li>';
        html += '<li>📁 assets/</li><ul>';
        for (const modId of Object.keys(translatedData)) {
            html += `<li>📁 ${modId}/</li><ul>`;
            html += `<li>📁 lang/</li><ul>`;
            html += `<li>📄 zh_cn.json (${Object.keys(translatedData[modId]).length} 条翻译)</li>`;
            html += `</ul></ul>`;
        }
        html += '</ul></ul></ul>';
        return html;
    }
}

window.packBuilder = new PackBuilder();
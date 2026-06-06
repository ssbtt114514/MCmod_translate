// js/pack.js - 打包资源包，使用原后缀名
class PackBuilder {
    async buildResourcePack(packMcmetaContent, translatedData) {
        const zip = new JSZip();
        
        // 添加 pack.mcmeta
        zip.file('pack.mcmeta', packMcmetaContent);
        
        // 内置默认 pack.png（1x1透明像素，避免缺失）
        const defaultPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        zip.file('pack.png', defaultPngBase64, { base64: true });
        
        // 为每个模组添加翻译文件，使用原后缀名
        for (const [modId, data] of Object.entries(translatedData)) {
            const ext = data.ext || 'lang';  // 默认 .lang
            const fileName = `zh_cn.${ext}`;
            const filePath = `assets/${modId}/lang/${fileName}`;
            zip.file(filePath, data.content);
        }
        
        return await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });
    }
    
    getStructurePreview(translatedData) {
        let html = '<ul><li>📦 资源包根目录</li><ul><li>📄 pack.mcmeta</li><li>🖼️ pack.png</li><li>📁 assets/</li><ul>';
        for (const [modId, data] of Object.entries(translatedData)) {
            const ext = data.ext || 'lang';
            html += `<li>📁 ${modId}/</li><ul><li>📁 lang/</li><ul>`;
            html += `<li>📄 zh_cn.${ext} (已翻译)</li>`;
            html += `</ul></ul>`;
        }
        html += '</ul></ul></ul>';
        return html;
    }
}

window.packBuilder = new PackBuilder();
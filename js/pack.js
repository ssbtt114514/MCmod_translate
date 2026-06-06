// 打包模块 - 生成资源包
class PackBuilder {
    async buildResourcePack(packMcmetaContent, translatedData) {
        const zip = new JSZip();
        
        zip.file('pack.mcmeta', packMcmetaContent);
        
        // 内置默认 pack.png（1x1透明像素）
        const defaultPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        zip.file('pack.png', defaultPngBase64, { base64: true });
        
        for (const [modId, data] of Object.entries(translatedData)) {
            if (!data.content) continue;
            const ext = data.ext || 'lang';
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
        if (Object.keys(translatedData).length === 0) {
            return '<div>暂无翻译数据</div>';
        }
        let html = '<ul><li>📦 资源包根目录</li><ul><li>📄 pack.mcmeta</li><li>🖼️ pack.png</li><li>📁 assets/</li><ul>';
        for (const [modId, data] of Object.entries(translatedData)) {
            const ext = data.ext || 'lang';
            html += `<li>📁 ${modId}/</li><ul><li>📁 lang/</li><ul>`;
            html += `<li>📄 zh_cn.${ext}</li>`;
            html += `</ul></ul>`;
        }
        html += '</ul></ul></ul>';
        return html;
    }
}

window.packBuilder = new PackBuilder();
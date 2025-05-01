"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
function limpiarCarpetaTmp() {
    const dir = path_1.default.resolve('tmp');
    if (fs_1.default.existsSync(dir)) {
        const archivos = fs_1.default.readdirSync(dir);
        for (const archivo of archivos) {
            const filePath = path_1.default.join(dir, archivo);
            fs_1.default.unlinkSync(filePath);
            console.log(`🧹 Archivo eliminado al iniciar: ${filePath}`);
        }
    }
}
limpiarCarpetaTmp();
app.get('/download', (req, res) => {
    (async () => {
        const rawUrl = req.query.url;
        const format = req.query.format || 'mp4';
        const url = rawUrl ? decodeURIComponent(rawUrl) : undefined;
        if (!url) {
            res.status(400).json({ error: 'URL no válida' });
            return;
        }
        const outputDir = 'tmp';
        const outputTemplate = path_1.default.join(outputDir, '%(title)s.%(ext)s');
        fs_1.default.mkdirSync(outputDir, { recursive: true });
        console.log(`📥 Descargando como ${format.toUpperCase()}...`);
        console.log('__dirname', __dirname);
        console.log('📍 FFMPEG path:', ffmpeg_static_1.default);
        let actualFilePath = '';
        const ytdlpArgs = format === 'mp3'
            ? [url, '-x', '--audio-format', 'mp3', '--ffmpeg-location', ffmpeg_static_1.default, '-o', outputTemplate]
            : [url, '-f', 'best', '-o', outputTemplate, '--ffmpeg-location', ffmpeg_static_1.default];
        try {
            await new Promise((resolve, reject) => {
                const proc = (0, child_process_1.spawn)('yt-dlp', ytdlpArgs);
                const detectFilePath = (data) => {
                    const text = data.toString();
                    console.log(text);
                    let match = text.match(/\[download\] Destination: (.+)/);
                    if (match?.[1]) {
                        actualFilePath = match[1].trim();
                    }
                    match = text.match(/\[download\] (.+) has already been downloaded/);
                    if (match?.[1]) {
                        actualFilePath = match[1].trim();
                    }
                };
                proc.stdout.on('data', detectFilePath);
                proc.stderr.on('data', detectFilePath);
                proc.on('close', (code) => {
                    if (code === 0 && actualFilePath) {
                        resolve();
                    }
                    else {
                        reject(new Error(`yt-dlp terminó con código ${code}`));
                    }
                });
            });
            const buffer = fs_1.default.readFileSync(actualFilePath);
            const filename = path_1.default.basename(actualFilePath);
            const contentType = format === 'mp3' ? 'audio/mpeg' : 'video/mp4';
            console.log('📄 Archivo detectado:', actualFilePath, '------', filename);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(buffer);
            // Limpieza automática después de enviar
            fs_1.default.unlinkSync(actualFilePath);
            // fs.unlink(actualFilePath, (err) => {
            //   if (err) {
            //     console.error(`❌ Error al borrar el archivo temporal: ${actualFilePath}`, err);
            //   } else {
            //     console.log(`🧹 Archivo temporal eliminado: ${actualFilePath}`);
            //   }
            // });
        }
        catch (error) {
            console.error('❌ Error:', error);
            res.status(500).json({ error: 'Error al descargar el archivo' });
        }
    })();
});
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

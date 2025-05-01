import express, {Request, Response} from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

function limpiarCarpetaTmp() {
    const dir = path.resolve('tmp');
    if (fs.existsSync(dir)) {
      const archivos = fs.readdirSync(dir);
      for (const archivo of archivos) {
        const filePath = path.join(dir, archivo);
        fs.unlinkSync(filePath);
        console.log(`🧹 Archivo eliminado al iniciar: ${filePath}`);
      }
    }
  }
  limpiarCarpetaTmp();

app.get('/download', (req: Request, res: Response): void => {
    (async () => {
      const rawUrl = req.query.url as string;
      const format = (req.query.format as string) || 'mp4';
      const url = rawUrl ? decodeURIComponent(rawUrl) : undefined;
  
      if (!url) {
        res.status(400).json({ error: 'URL no válida' });
        return;
      }
  
      const outputDir = 'tmp';
      const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');
      fs.mkdirSync(outputDir, { recursive: true });
  
      console.log(`📥 Descargando como ${format.toUpperCase()}...`);
      console.log('__dirname', __dirname);
      console.log('📍 FFMPEG path:', ffmpegPath);
  
      let actualFilePath = '';
  
      const ytdlpArgs: string[] =
        format === 'mp3'
          ? [url, '-x', '--audio-format', 'mp3', '--ffmpeg-location', ffmpegPath!, '-o', outputTemplate]
          : [url, '-f', 'best', '-o', outputTemplate, '--ffmpeg-location', ffmpegPath!];
  
      try {
        await new Promise<void>((resolve, reject) => {
          const proc = spawn('yt-dlp', ytdlpArgs);
  
          const detectFilePath = (data: Buffer) => {
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
            } else {
              reject(new Error(`yt-dlp terminó con código ${code}`));
            }
          });
        });
  
        const buffer = fs.readFileSync(actualFilePath);
        const filename = path.basename(actualFilePath);
        const contentType = format === 'mp3' ? 'audio/mpeg' : 'video/mp4';
  
        console.log('📄 Archivo detectado:', actualFilePath, '------', filename);
  
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
        
        // Limpieza automática después de enviar
        fs.unlinkSync(actualFilePath);
        // fs.unlink(actualFilePath, (err) => {
        //   if (err) {
        //     console.error(`❌ Error al borrar el archivo temporal: ${actualFilePath}`, err);
        //   } else {
        //     console.log(`🧹 Archivo temporal eliminado: ${actualFilePath}`);
        //   }
        // });
      } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: 'Error al descargar el archivo' });
      }
    })();
  });
  

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

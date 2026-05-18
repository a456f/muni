import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const APK_TIPOS = {
  oisgo:   { filename: 'OISGO.apk',    label: 'OISGO Ciudadano' },
  almacen: { filename: 'Almacen.apk',  label: 'Almacenero' },
  sereno:  { filename: 'Sereno.apk',   label: 'Sereno' },
};

const APK_DIR = path.resolve('uploads/apks');
if (!fs.existsSync(APK_DIR)) fs.mkdirSync(APK_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, APK_DIR),
  filename: (req, _file, cb) => {
    const tipo = req.params.tipo;
    const meta = APK_TIPOS[tipo];
    if (!meta) return cb(new Error('Tipo de APK no válido'), '');
    cb(null, meta.filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 }, // 80 MB por APK
  fileFilter: (_req, file, cb) => {
    const ok = /\.apk$/i.test(file.originalname);
    cb(ok ? null : new Error('Solo se permiten archivos .apk'), ok);
  },
});

// Lista los APKs con metadata
router.get('/', (_req, res) => {
  const lista = Object.entries(APK_TIPOS).map(([tipo, meta]) => {
    const filePath = path.join(APK_DIR, meta.filename);
    if (!fs.existsSync(filePath)) {
      return { tipo, label: meta.label, filename: meta.filename, disponible: false };
    }
    const stat = fs.statSync(filePath);
    return {
      tipo,
      label: meta.label,
      filename: meta.filename,
      disponible: true,
      size_bytes: stat.size,
      fecha_subida: stat.mtime,
    };
  });
  res.json(lista);
});

// Subir / reemplazar un APK
router.post('/:tipo', (req, res) => {
  const { tipo } = req.params;
  if (!APK_TIPOS[tipo]) return res.status(400).json({ error: 'Tipo de APK no válido' });

  upload.single('apk')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    res.json({
      message: 'APK actualizado',
      tipo,
      filename: APK_TIPOS[tipo].filename,
      size_bytes: req.file.size,
    });
  });
});

// Descargar APK (público — pensado para compartir el link)
router.get('/download/:tipo', (req, res) => {
  const { tipo } = req.params;
  const meta = APK_TIPOS[tipo];
  if (!meta) return res.status(404).send('Tipo no válido');
  const filePath = path.join(APK_DIR, meta.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('APK no disponible');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.download(filePath, meta.filename);
});

// Borrar APK
router.delete('/:tipo', (req, res) => {
  const { tipo } = req.params;
  const meta = APK_TIPOS[tipo];
  if (!meta) return res.status(400).json({ error: 'Tipo de APK no válido' });
  const filePath = path.join(APK_DIR, meta.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ message: 'APK eliminado', tipo });
});

export default router;

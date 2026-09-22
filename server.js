import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me-now';
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ movies: [], series: [] }, null, 2)
  );
}

const readData = () =>
  JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

const writeData = (d) =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const safe =
      Date.now() +
      '-' +
      file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');

    cb(null, safe);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (req, res) =>
  res.json({
    ok: true,
    service: 'filmix'
  })
);

app.get('/api/catalog', (req, res) =>
  res.json(readData())
);

app.post('/api/upload', upload.single('video'), (req, res) => {
  if (
    req.headers.authorization !==
    `Bearer ${ADMIN_TOKEN}`
  ) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  const { title, year, type, tag } = req.body;

  if (!title || !['movie', 'series'].includes(type)) {
    return res.status(400).json({
      error: 'title and type are required'
    });
  }

  const item = {
    id: Date.now().toString(),
    title,
    year:
      year ||
      new Date().getFullYear().toString(),
    type,
    tag: tag || 'HD',
    video: req.file
      ? `/uploads/${req.file.filename}`
      : null
  };

  const data = readData();

  data[type === 'series' ? 'series' : 'movies']
    .unshift(item);

  writeData(data);

  res.json(item);
});

app.delete('/api/items/:type/:id', (req, res) => {
  if (
    req.headers.authorization !==
    `Bearer ${ADMIN_TOKEN}`
  ) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  const key =
    req.params.type === 'series'
      ? 'series'
      : 'movies';

  const data = readData();

  const idx = data[key].findIndex(
    x => x.id === req.params.id
  );

  if (idx < 0) {
    return res.status(404).json({
      error: 'Not found'
    });
  }

  const [item] = data[key].splice(idx, 1);

  if (item.video) {
    const f = path.join(
      __dirname,
      item.video
        .replace(/^\/+/, '')
        .replace(/^uploads\//, '')
    );

    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
    }
  }

  writeData(data);

  res.json({ ok: true });
});

app.listen(PORT, () =>
  console.log(
    `Filmix API running on port ${PORT}`
  )
);

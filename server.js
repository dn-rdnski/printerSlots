import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const DEFAULT_PORT = 3001;
const PORT = process.env.PORT || DEFAULT_PORT;
const DATA_FILE = path.join(__dirname, 'bookings.json');

app.use(cors());
app.use(express.json());

// Ensure the data file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));


// Get all bookings
app.get('/api/bookings', (req, res) => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read bookings' });
  }
});

// Save bookings
app.post('/api/bookings', (req, res) => {
  try {
    const newBookings = req.body;
    fs.writeFileSync(DATA_FILE, JSON.stringify(newBookings, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save bookings' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

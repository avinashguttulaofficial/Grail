import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { schedulerRouter } from './routes';
import { CronManager } from './cronManager';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers for development if ports differ
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Mount Scheduler API Router
app.use('/api/scheduler', schedulerRouter);

// Proxy for Himalayas API on server
app.get('/api/himalayas/jobs/api', async (req: Request, res: Response) => {
  try {
    const url = new URL('https://himalayas.app/jobs/api');
    for (const [key, val] of Object.entries(req.query)) {
      if (typeof val === 'string') {
        url.searchParams.set(key, val);
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NoahCrew-GrailJobs/1.0',
      },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `Himalayas API responded with ${response.status}` });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error('[ServerProxy] Himalayas proxy error:', err);
    res.status(502).json({ error: 'Failed to proxy request to Himalayas API' });
  }
});

// Production Static Serving
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  console.log(`[Server] Serving production static files from ${distDir}`);
  app.use(express.static(distDir));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distDir, 'index.html'));
    } else {
      res.status(404).json({ error: 'Endpoint not found' });
    }
  });
}

// Start Server and Cron Manager
app.listen(PORT, () => {
  console.log(`[Server] Grail Jobs server listening on port ${PORT}`);
  console.log(`[Server] Scheduler endpoints available at http://localhost:${PORT}/api/scheduler`);

  // Start in-process background scheduler daemon
  CronManager.start();
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import path from 'path';
import { fileURLToPath } from 'url';

const __appDirname = path.dirname(fileURLToPath(import.meta.url));

import env from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { mongoSanitize } from './middleware/mongoSanitize.js';
import { globalApiLimiter } from './middleware/rateLimiter.js';
import { isOriginAllowed } from './utils/corsOrigin.js';

const app = express();

// Security headers with clickjacking and content-type protections
app.use(
  helmet({
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS - strictly allow configured frontend origin(s). Outside production, localhost and
// private network addresses are also allowed so phones and tablets on the same Wi-Fi can test.
const allowedOrigins = env.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, { allowedOrigins, isProduction: env.isProduction })) {
        callback(null, true);
      } else {
        callback(new Error('CORS request from unauthorized origin blocked.'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Global Denial-of-Service Rate Limiter
app.use(globalApiLimiter);

// Request logging (quiet during tests)
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NoSQL Operator Injection Sanitizer (must run after body parsers)
app.use(mongoSanitize);

// Static file uploads. Every file is served with a sandboxing policy, so even a file that slipped
// past the upload checks cannot run scripts on this site (DEC-034).
const uploadHeaders = {
  setHeaders: (res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
};
app.use('/uploads', express.static(path.resolve(__appDirname, '../uploads'), uploadHeaders));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), uploadHeaders));

// API routes
app.use('/api', apiRoutes);

// 404 + centralised error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

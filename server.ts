import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { Server as SocketServer } from 'socket.io';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { Storage } from '@google-cloud/storage';
import db from './server/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import corsMiddleware from 'cors';

// Google Cloud Storage config
const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID ?? '';
const GCS_BUCKET_PROFIL = process.env.GCS_BUCKET_PROFIL ?? 'foto_profil_user_acinonyx';
const GCS_BUCKET_BUKTI = process.env.GCS_BUCKET_BUKTI ?? 'bukti_foto_pengerjaan_acinonyx';
const GCS_KEY_FILE_PATH = process.env.GCS_KEY_FILE_PATH ?? '';

let gcsStorage: Storage | null = null;
if (GCS_PROJECT_ID && GCS_KEY_FILE_PATH) {
  try {
    gcsStorage = new Storage({
      projectId: GCS_PROJECT_ID,
      keyFilename: path.resolve(process.cwd(), GCS_KEY_FILE_PATH),
    });
    console.log('[GCS] Storage client initialized.');
    // Ensure both buckets allow public reads once at startup.
    // bucket.makePublic() sets allUsers:objectViewer in IAM (works with uniform bucket-level access).
    (async () => {
      for (const bkt of [GCS_BUCKET_PROFIL, GCS_BUCKET_BUKTI]) {
        try {
          await gcsStorage!.bucket(bkt).makePublic();
          console.log(`[GCS] Bucket ${bkt} is publicly readable.`);
        } catch (e: any) {
          console.warn(`[GCS] Could not set public IAM on ${bkt} (may already be public):`, e?.message || e);
        }
      }
    })();
  } catch (e) {
    console.warn('[GCS] Failed to initialize Storage client:', e);
  }
}

/**
 * Upload a base64 data URI to Google Cloud Storage.
 * Returns the public HTTPS URL of the uploaded file.
 * Falls back to returning the original data URI if GCS is not configured.
 */
async function uploadBase64ToGCS(bucketName: string, dataUri: string, folder: string, fileId: string): Promise<string> {
  if (!gcsStorage) return dataUri; // GCS not configured — passthrough
  if (!dataUri.startsWith('data:')) return dataUri; // Already a URL — passthrough

  const matches = dataUri.match(/^data:([A-Za-z+\-/]+);base64,(.+)$/);
  if (!matches || matches.length < 3) throw new Error('Format data URI tidak valid');

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const filename = `${folder}/${fileId}-${Date.now()}.${ext}`;

  const bucket = gcsStorage.bucket(bucketName);
  const file = bucket.file(filename);

  await file.save(buffer, { contentType: mimeType, resumable: false });
  // Note: with uniform bucket-level access, file-level ACLs are disabled.
  // Public access is controlled by the bucket IAM policy set at startup.

  return `https://storage.googleapis.com/${bucketName}/${filename}`;
}

// Email OTP config (uses Gmail SMTP by default)
const EMAIL_USER = process.env.EMAIL_USER ?? 'jokgen.acinonyx@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS ?? '';
const EMAIL_FROM = process.env.EMAIL_FROM ?? `Jokgen Acinonyx <${EMAIL_USER}>`;

const JWT_SECRET = process.env.JWT_SECRET ?? 'acinonyx-dev-secret-change-in-production';

// Midtrans config
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY ?? '';
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY ?? '';
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const MIDTRANS_SNAP_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/v1/transactions'
  : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const MIDTRANS_API_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://api.midtrans.com/v2'
  : 'https://api.sandbox.midtrans.com/v2';
const BCRYPT_ROUNDS = 12;

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

async function sendOtpEmail(to: string, code: string, purpose: string) {
  const subjectMap: Record<string, string> = {
    login: 'Kode OTP Login Acinonyx',
    signup: 'Kode OTP Pendaftaran Acinonyx',
    'change-email': 'Kode OTP Ubah Email Acinonyx',
    'change-phone': 'Kode OTP Ubah Nomor Telepon Acinonyx',
    'forgot-password': 'Kode OTP Reset Password Acinonyx',
    default: 'Kode OTP Acinonyx',
  };

  const subject = subjectMap[purpose] ?? subjectMap.default;
  const message = `Kode OTP Anda adalah: ${code}\n\nKode ini berlaku selama 5 menit. Jika Anda tidak meminta kode ini, abaikan pesan ini.`;

  const info = await transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    text: message,
  });

  // Log basic send info to help diagnose delivery issues.
  console.log(`[OTP EMAIL SENT] to ${to} (${purpose})`, {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  });
}

async function startServer() {
  console.log('Starting server...');

  // Ensure database schema exists (load dump if needed)
  await db.ensureSchema();

  // Data Standardization: Update 'Mobile Legends : Bang Bang' to 'Mobile Legends'
  try {
    console.log('Standardizing game names...');
    await db.prepare("UPDATE users SET verified_game = 'Mobile Legends' WHERE verified_game = 'Mobile Legends : Bang Bang'").run();
    await db.prepare("UPDATE game_accounts SET game_name = 'Mobile Legends' WHERE game_name = 'Mobile Legends : Bang Bang'").run();
    await db.prepare("UPDATE categories SET game_name = 'Mobile Legends' WHERE game_name = 'Mobile Legends : Bang Bang'").run();
    await db.prepare("UPDATE kijo_applications SET desired_game = 'Mobile Legends' WHERE desired_game = 'Mobile Legends : Bang Bang'").run();
    
    // Add PUBG Mobile -> PUBG
    await db.prepare("UPDATE users SET verified_game = 'PUBG' WHERE verified_game = 'PUBG Mobile'").run();
    await db.prepare("UPDATE game_accounts SET game_name = 'PUBG' WHERE game_name = 'PUBG Mobile'").run();
    await db.prepare("UPDATE categories SET game_name = 'PUBG' WHERE game_name = 'PUBG Mobile'").run();
    await db.prepare("UPDATE kijo_applications SET desired_game = 'PUBG' WHERE desired_game = 'PUBG Mobile'").run();
    
    console.log('Game names standardized.');
    
    // Migration: Ensure Kijos have verified_game if they have categories
    try {
      const kijosWithoutGame = await db.prepare("SELECT id FROM users WHERE role = 'kijo' AND verified_game IS NULL").all() as { id: number }[];
      for (const kijo of kijosWithoutGame) {
        const firstCategory = await db.prepare("SELECT game_name FROM categories WHERE user_id = ? AND game_name IS NOT NULL LIMIT 1").get(kijo.id) as { game_name: string };
        if (firstCategory) {
          await db.prepare("UPDATE users SET verified_game = ? WHERE id = ?").run(firstCategory.game_name, kijo.id);
          console.log(`Migration: Set verified_game for Kijo ${kijo.id} to ${firstCategory.game_name}`);
        }
      }
    } catch (err) {
      console.error('Failed to migrate Kijo verified games:', err);
    }
  } catch (err) {
    console.error('Failed to standardize game names:', err);
  }

  console.log('NODE_ENV:', process.env.NODE_ENV);

  // Schema migrations / compatibility fixes (MySQL)
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(255) PRIMARY KEY,
      value TEXT
    )`);
  } catch (err) {
    console.warn('[Migration] Could not create settings table:', err);
  }

  try {
    await db.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted TINYINT(1) DEFAULT 0");
    await db.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS rank VARCHAR(255) DEFAULT NULL");
  } catch (err) {
    console.warn('[Migration] Could not ensure categories columns exist:', err);
  }

  // Ensure sessions has all required columns
  const sessionsMigrations = [
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration INT(11) DEFAULT 1",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS jokies_dynamic_data LONGTEXT DEFAULT NULL",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS kijo_dynamic_data LONGTEXT DEFAULT NULL",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(50) DEFAULT NULL",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS kijo_finished TINYINT(1) DEFAULT 0",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS jokies_finished TINYINT(1) DEFAULT 0",
    "ALTER TABLE sessions MODIFY COLUMN IF EXISTS status ENUM('upcoming','ongoing','completed','cancelled','pending_completion','pending_cancellation','pending_payment') DEFAULT 'upcoming'",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS started_at DATETIME DEFAULT NULL",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cancel_escalated TINYINT(1) DEFAULT 0",
    // Widen screenshot columns: varchar(255) is too small for base64 data URIs (GCS fallback)
    "ALTER TABLE sessions MODIFY COLUMN IF EXISTS screenshot_start MEDIUMTEXT NULL DEFAULT NULL",
    "ALTER TABLE sessions MODIFY COLUMN IF EXISTS screenshot_end MEDIUMTEXT NULL DEFAULT NULL",
    "ALTER TABLE sessions MODIFY COLUMN IF EXISTS final_screenshot MEDIUMTEXT NULL DEFAULT NULL",
  ];
  for (const sql of sessionsMigrations) {
    try { await db.query(sql); } catch (err) { console.warn('[Migration]', sql.slice(0, 60), err); }
  }

  // Backfill started_at for pre-existing ongoing sessions that have no start time recorded
  try {
    await db.query("UPDATE sessions SET started_at = scheduled_at WHERE status IN ('ongoing','pending_completion','pending_cancellation') AND started_at IS NULL");
  } catch (err) { console.warn('[Migration] started_at backfill failed:', err); }

  // Ensure packages has all required columns
  const packagesMigrations = [
    "ALTER TABLE packages CHANGE COLUMN IF EXISTS rank_text rank VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE packages ADD COLUMN IF NOT EXISTS rank VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_bundle TINYINT(1) DEFAULT 0",
    "ALTER TABLE packages ADD COLUMN IF NOT EXISTS bundle_start VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE packages ADD COLUMN IF NOT EXISTS bundle_end VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE packages ADD COLUMN IF NOT EXISTS criteria TEXT DEFAULT NULL",
  ];
  for (const sql of packagesMigrations) {
    try { await db.query(sql); } catch (err) { /* column may already exist */ }
  }

  // Ensure game_accounts uses `rank` not `rank_name`
  try {
    await db.query("ALTER TABLE game_accounts CHANGE COLUMN IF EXISTS rank_name rank VARCHAR(255) DEFAULT NULL");
  } catch (err) {
    try { await db.query("ALTER TABLE game_accounts ADD COLUMN IF NOT EXISTS rank VARCHAR(255) DEFAULT NULL"); } catch (_) { /* already exists */ }
  }

  // Ensure chat tables exist
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS chat_sessions (
      id INT(11) NOT NULL AUTO_INCREMENT,
      user_id INT(11) DEFAULT NULL,
      status ENUM('open','closed') DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
      PRIMARY KEY (id),
      KEY user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.query(`CREATE TABLE IF NOT EXISTS chats (
      id INT(11) NOT NULL AUTO_INCREMENT,
      session_id INT(11) DEFAULT NULL,
      sender_id INT(11) DEFAULT NULL,
      receiver_id INT(11) DEFAULT NULL,
      message TEXT DEFAULT NULL,
      is_read TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id),
      KEY session_id (session_id),
      KEY sender_id (sender_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  } catch (err) {
    console.warn('[Migration] Could not ensure chat tables exist:', err);
  }

  // Helper: only ALTER TABLE if the column doesn't already exist
  async function addColumnIfMissing(table: string, column: string, definition: string) {
    const row = await db.get<any>(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      table, column
    );
    if (!row) {
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  }

  // Feature 1: Avatar column
  await addColumnIfMissing('users', 'avatar_url', 'TEXT DEFAULT NULL');

  // Feature 2: Social links column
  await addColumnIfMissing('users', 'social_links', 'JSON DEFAULT NULL');

  // Feature 3: Notification preferences column
  await addColumnIfMissing('users', 'notification_preferences', 'JSON DEFAULT NULL');

  // Feature 5: Rating reply columns
  await addColumnIfMissing('ratings', 'reply', 'TEXT DEFAULT NULL');
  await addColumnIfMissing('ratings', 'reply_at', 'DATETIME DEFAULT NULL');

  // Feature 6: Login history table
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS login_history (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      ip_address VARCHAR(100) DEFAULT NULL,
      user_agent TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  } catch (err) {
    console.warn('[Migration] Could not create login_history table:', err);
  }

  // Feature 7: Saved payment methods table
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS saved_payment_methods (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      method_type VARCHAR(50) NOT NULL,
      account_name VARCHAR(255) NOT NULL,
      account_number VARCHAR(255) NOT NULL,
      is_default TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  } catch (err) {
    console.warn('[Migration] Could not create saved_payment_methods table:', err);
  }

  // Order chat table for Kijo-Jokies real-time messaging (includes read-receipt columns)
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS order_chats (
      id INT PRIMARY KEY AUTO_INCREMENT,
      session_id INT NOT NULL,
      sender_id INT NOT NULL,
      message TEXT NOT NULL,
      status ENUM('sending','sent','delivered','read','failed') DEFAULT 'sent',
      read_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    // Backfill columns for tables created before this migration
    await addColumnIfMissing('order_chats', 'status', "ENUM('sending','sent','delivered','read','failed') DEFAULT 'sent'");
    await addColumnIfMissing('order_chats', 'read_at', 'TIMESTAMP NULL DEFAULT NULL');
  } catch (err) {
    console.warn('[Migration] Could not create/update order_chats table:', err);
  }

  // Escrow system: payment_transactions table for Midtrans integration
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS payment_transactions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      order_id VARCHAR(100) NOT NULL UNIQUE,
      session_id INT DEFAULT NULL,
      jokies_id INT NOT NULL,
      kijo_id INT NOT NULL,
      amount INT NOT NULL,
      admin_fee INT NOT NULL DEFAULT 0,
      total_amount INT NOT NULL,
      payment_type VARCHAR(50) DEFAULT NULL,
      payment_status ENUM('pending','settlement','capture','deny','cancel','expire','refund','partial_refund') DEFAULT 'pending',
      escrow_status ENUM('none','held','released','refunded','partial_refund') DEFAULT 'none',
      midtrans_transaction_id VARCHAR(255) DEFAULT NULL,
      snap_token VARCHAR(255) DEFAULT NULL,
      snap_redirect_url TEXT DEFAULT NULL,
      idempotency_key VARCHAR(100) NOT NULL UNIQUE,
      refund_amount INT DEFAULT 0,
      refund_reason TEXT DEFAULT NULL,
      refunded_by VARCHAR(50) DEFAULT NULL,
      settled_at DATETIME DEFAULT NULL,
      released_at DATETIME DEFAULT NULL,
      refunded_at DATETIME DEFAULT NULL,
      raw_notification JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
      FOREIGN KEY (jokies_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (kijo_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    console.log('[Migration] payment_transactions table ensured.');
  } catch (err) {
    console.warn('[Migration] Could not create payment_transactions table:', err);
  }

  // Add escrow columns to sessions table
  const escrowMigrations = [
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS escrow_status ENUM('none','held','released','refunded','partial_refund') DEFAULT 'none'",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS midtrans_order_id VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_transaction_id INT DEFAULT NULL",
  ];
  for (const sql of escrowMigrations) {
    try { await db.query(sql); } catch (err) { console.warn('[Migration]', sql.slice(0, 60), err); }
  }

  // Validate SMTP config early to ensure OTP can be sent.
  try {
    await transporter.verify();
    console.log('[SMTP] Connection verified (OTP email enabled)');
  } catch (err) {
    console.error('[SMTP] Failed to verify SMTP configuration. OTP emails will not send.', err);
    // Do not exit immediately; keep server running so other features still work.
  }

  const app = express();
  const PORT = parseInt(process.env.PORT ?? '3000', 10);

  app.use(corsMiddleware({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));

  // Global API rate limiter — prevents brute-force and DoS
  const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // 120 requests per minute per IP
    message: { success: false, message: 'Terlalu banyak request. Coba lagi sebentar.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: any) => req.path === '/api/payment/webhook', // Don't double-limit webhooks
  });
  app.use('/api/', globalLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { success: false, message: 'Terlalu banyak percobaan, coba lagi setelah 15 menit' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiter for payment endpoints (stricter)
  const paymentLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 15,
    message: { success: false, message: 'Terlalu banyak request pembayaran. Coba lagi sebentar.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiter for webhook endpoint (allow Midtrans retries, but block abuse)
  const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60,
    message: 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Payment timeout: 15 min Midtrans window + 5 min server buffer
  const PAYMENT_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
  const PAYMENT_DISPLAY_TIMEOUT_MS = 15 * 60 * 1000; // 15 min shown to user

  // Auth middleware: verify JWT token on protected routes
  function requireAuth(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization'] as string | undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Autentikasi diperlukan' });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
      (req as any).user = decoded;
      next();
    } catch {
      return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kedaluwarsa' });
    }
  }

  function requireAdmin(req: any, res: any, next: any) {
    requireAuth(req, res, () => {
      if ((req as any).user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Akses Admin diperlukan' });
      }
      next();
    });
  }

  // Maintenance Middleware
  app.use(async (req, res, next) => {
    const status = await getSystemStatus();
    const isAdminUrl = req.url.startsWith('/api/admin');
    const isPublicUrl = req.url.startsWith('/api/system/status') || req.url.startsWith('/api/auth') || req.url.startsWith('/api/setup');
    
    if (status.status === 'maintenance' && !isAdminUrl && !isPublicUrl && req.url.startsWith('/api')) {
      return res.status(503).json({ success: false, message: 'System is under maintenance', schedule: status.schedule });
    }
    
    if (status.status === 'freeze' && req.url === '/api/jokies/place-order') {
      return res.status(403).json({ success: false, message: 'System is frozen. New orders are not allowed.', schedule: status.schedule });
    }
    
    next();
  });

  // Request logging middleware
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    }
    next();
  });

  // Clear stale OTPs on start
  try {
    await db.prepare("DELETE FROM otps WHERE expires_at < NOW()").run();
    console.log('Expired OTPs cleared.');
  } catch (err) {
    console.error('Failed to clear stale OTPs:', err);
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Admin Setup: check if any admin account exists
  app.get('/api/setup/status', async (req, res) => {
    try {
      const adminExists = await db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
      res.json({ needsSetup: !adminExists });
    } catch (error) {
      res.status(500).json({ needsSetup: false });
    }
  });

  // Admin Setup: create the first admin account (disabled once any admin exists)
  app.post('/api/setup/create-admin', async (req, res) => {
    try {
      const adminExists = await db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
      if (adminExists) {
        return res.status(403).json({ success: false, message: 'Admin account already exists. Setup is disabled.' });
      }

      const { email, phone, password } = req.body;

      if (!email || !phone || !password) {
        return res.status(400).json({ success: false, message: 'Email, nomor telepon, dan password wajib diisi.' });
      }

      const emojiRegex = /\p{Extended_Pictographic}/u;
      if (password.length < 8 || emojiRegex.test(password)) {
        return res.status(400).json({ success: false, message: 'Password minimal 8 karakter dan tidak boleh mengandung emoji.' });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Format email tidak valid.' });
      }

      const existingEmail = await db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
      }

      const existingPhone = await db.prepare('SELECT id FROM users WHERE phone = ?').get(phone) as any;
      if (existingPhone) {
        return res.status(400).json({ success: false, message: 'Nomor telepon sudah terdaftar.' });
      }

      // Auto-assign identity: Minox is always the admin name
      const full_name = 'Minox';
      const baseUsername = 'minox_' + email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const username = baseUsername.slice(0, 30); // cap at 30 chars

      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const result = await db.prepare(
        'INSERT INTO users (username, email, phone, full_name, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(username, email, phone, full_name, hashedPassword, 'admin', 1) as any;

      // Generate token for immediate login — OTP will still be required by the normal login flow
      const token = jwt.sign({ userId: result.insertId, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        success: true,
        message: 'Akun Minox berhasil dibuat.',
        user: { id: result.insertId, username, email, phone, full_name, role: 'admin' },
        token,
      });
    } catch (error: any) {
      console.error('[Setup] Error creating admin:', error);
      res.status(500).json({ success: false, message: 'Gagal membuat akun admin.' });
    }
  });

  // Helper: Calculate Break Until
  async function calculateBreakUntil(kijoId: number) {
    const kijo = await db.prepare('SELECT break_time FROM users WHERE id = ?').get(kijoId) as any;
    if (!kijo || !kijo.break_time) return null;

    const now = new Date();
    const breakDurationMs = kijo.break_time * 60 * 60 * 1000; // break_time is in hours
    let breakUntil = new Date(now.getTime() + breakDurationMs);

    // Check closest upcoming order
    const nextOrder = await db.prepare("SELECT scheduled_at FROM sessions WHERE user_id = ? AND status = 'upcoming' AND scheduled_at > ? ORDER BY scheduled_at ASC LIMIT 1")
      .get(kijoId, now.toISOString()) as any;

    if (nextOrder) {
      const nextOrderStart = new Date(nextOrder.scheduled_at);
      if (nextOrderStart < breakUntil) {
        // If next order starts sooner than requested break end, cap the break
        breakUntil = nextOrderStart;
      }
    }

    return breakUntil.toISOString();
  }

  // Helper: Get System Status
  let _systemStatusCache: { status: string; schedule?: any } | null = null;
  let _systemStatusCachedAt = 0;
  const SYSTEM_STATUS_TTL = 30_000; // 30 seconds

  async function getSystemStatus() {
    if (_systemStatusCache && Date.now() - _systemStatusCachedAt < SYSTEM_STATUS_TTL) {
      return _systemStatusCache;
    }
    const now = new Date();
    const schedules = await db.prepare('SELECT * FROM maintenance_schedules ORDER BY start_date ASC').all() as any[];

    for (const schedule of schedules) {
      const start = new Date(schedule.start_date);
      const end = new Date(schedule.end_date);
      const freezeStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000); // 1 week before

      if (now >= start && now <= end) {
        _systemStatusCache = { status: 'maintenance', schedule };
        _systemStatusCachedAt = Date.now();
        return _systemStatusCache;
      }
      if (now >= freezeStart && now < start) {
        _systemStatusCache = { status: 'freeze', schedule };
        _systemStatusCachedAt = Date.now();
        return _systemStatusCache;
      }
    }

    _systemStatusCache = { status: 'normal' };
    _systemStatusCachedAt = Date.now();
    return _systemStatusCache;
  }

  // Invalidate cache when maintenance schedules change
  function invalidateSystemStatusCache() {
    _systemStatusCache = null;
    _systemStatusCachedAt = 0;
  }

  // API: Get System Status
  app.get('/api/system/status', async (req, res) => {
    res.json(await getSystemStatus());
  });

  // Protect all /api/admin routes - JWT + admin role required
  app.use('/api/admin', requireAdmin);

  // Admin: Update own profile (email, phone, password)
  app.put('/api/admin/profile', async (req, res) => {
    try {
      const adminUser = (req as any).user;
      const { email, phone, currentPassword, newPassword } = req.body;

      const admin = await db.prepare('SELECT id, email, phone, password FROM users WHERE id = ? AND role = ?').get(adminUser.userId, 'admin') as any;
      if (!admin) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });

      const updates: string[] = [];
      const params: any[] = [];

      if (email && email !== admin.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ success: false, message: 'Format email tidak valid.' });
        }
        const taken = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, admin.id) as any;
        if (taken) return res.status(400).json({ success: false, message: 'Email sudah digunakan.' });
        updates.push('email = ?');
        params.push(email);
      }

      if (phone && phone !== admin.phone) {
        const taken = await db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone, admin.id) as any;
        if (taken) return res.status(400).json({ success: false, message: 'Nomor telepon sudah digunakan.' });
        updates.push('phone = ?');
        params.push(phone);
      }

      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ success: false, message: 'Password saat ini wajib diisi untuk mengubah password.' });
        }
        const match = await bcrypt.compare(currentPassword, admin.password);
        if (!match) return res.status(400).json({ success: false, message: 'Password saat ini salah.' });

        const emojiRegex = /\p{Extended_Pictographic}/u;
        if (newPassword.length < 8 || emojiRegex.test(newPassword)) {
          return res.status(400).json({ success: false, message: 'Password baru minimal 8 karakter dan tidak boleh mengandung emoji.' });
        }
        const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        updates.push('password = ?');
        params.push(hashed);
      }

      if (updates.length === 0) {
        return res.json({ success: true, message: 'Tidak ada perubahan.' });
      }

      params.push(admin.id);
      await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      const updated = await db.prepare('SELECT id, username, email, phone, full_name, role FROM users WHERE id = ?').get(admin.id) as any;
      res.json({ success: true, message: 'Profil berhasil diperbarui.', user: updated });
    } catch (error: any) {
      console.error('[Admin] Profile update error:', error);
      res.status(500).json({ success: false, message: 'Gagal memperbarui profil.' });
    }
  });

  // API: Get Maintenance Schedules
  app.get('/api/admin/maintenance', async (req, res) => {
    const schedules = await db.prepare('SELECT * FROM maintenance_schedules ORDER BY start_date ASC').all();
    res.json(schedules);
  });

  // API: Add Maintenance Schedule
  app.post('/api/admin/maintenance', async (req, res) => {
    const { start_date, end_date, reason } = req.body;
    try {
      await db.prepare('INSERT INTO maintenance_schedules (start_date, end_date, reason) VALUES (?, ?, ?)').run(start_date, end_date, reason);
      invalidateSystemStatusCache();
      
      // Notify all users
      const users = (await db.prepare('SELECT id FROM users').all()) as any[];
      for (const user of users) {
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          user.id,
          'system',
          'Jadwal Maintenance Sistem',
          `Sistem akan mengalami pemeliharaan dari ${new Date(start_date).toLocaleString()} hingga ${new Date(end_date).toLocaleString()}. Alasan: ${reason}`
        );
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Delete Maintenance Schedule
  app.delete('/api/admin/maintenance/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await db.prepare('DELETE FROM maintenance_schedules WHERE id = ?').run(id);
      invalidateSystemStatusCache();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // Auth: Forgot Password - Send OTP to registered email
  app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email wajib diisi' });

    const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Email tidak terdaftar' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await db.prepare('DELETE FROM otps WHERE identifier = ?').run(email);
    await db.prepare('INSERT INTO otps (identifier, code, expires_at) VALUES (?, ?, ?)').run(email, code, expiresAt);

    await sendOtpEmail(email, code, 'forgot-password');

    res.json({ success: true, message: 'OTP telah dikirim ke email Anda' });
  });

  // Auth: Request OTP (generic)
  app.post('/api/auth/request-otp', authLimiter, async (req, res) => {
    const { email, purpose = 'login' } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email wajib diisi' });

    // For sign-up, we allow emails that do not exist yet.
    // For all other purposes, ensure email exists in the system.
    const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (purpose !== 'signup' && !user) {
      return res.status(404).json({ success: false, message: 'Email tidak terdaftar' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await db.prepare('DELETE FROM otps WHERE identifier = ?').run(email);
    await db.prepare('INSERT INTO otps (identifier, code, expires_at) VALUES (?, ?, ?)').run(email, code, expiresAt);

    await sendOtpEmail(email, code, purpose);

    res.json({ success: true, message: 'OTP telah dikirim ke email Anda' });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const { email, otp, identifier, code } = req.body;
    const finalIdentifier = identifier || email;
    const finalCode = code || otp;

    if (!finalIdentifier || !finalCode) {
      return res.status(400).json({ success: false, message: 'Identifier dan OTP wajib diisi' });
    }

    const otpData = db.prepare('SELECT * FROM otps WHERE identifier = ? AND code = ?').get(finalIdentifier, finalCode) as any;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[OTP VERIFY]', { finalIdentifier, finalCode, found: Boolean(otpData) });
    }

    if (!otpData || new Date(otpData.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah kedaluwarsa' });
    }

    db.prepare('DELETE FROM otps WHERE identifier = ?').run(finalIdentifier);
    res.json({ success: true });
  });

  // Auth: Reset Password (from Forgot Password)
  app.post('/api/auth/reset-password-forgot', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    
    // 1. Verify OTP
    const otpData = db.prepare('SELECT * FROM otps WHERE identifier = ? AND code = ?').get(email, otp) as any;
    if (!otpData || new Date(otpData.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah kedaluwarsa' });
    }

    // 2. Validate Password
    const emojiRegex = /\p{Extended_Pictographic}/u;
    if (newPassword.length < 8 || emojiRegex.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password minimal 8 karakter dengan huruf besar, huruf kecil, angka, dan simbol, tanpa emoji' });
    }

    try {
      const hashedPwd = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hashedPwd, email);
      db.prepare('DELETE FROM otps WHERE identifier = ?').run(email);
      res.json({ success: true, message: 'Password berhasil diperbarui, silakan login kembali' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Gagal memperbarui password' });
    }
  });

  // Auth: Change Password (Internal)
  app.post('/api/users/:id/change-password', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (String((req as any).user.userId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Password lama dan baru wajib diisi' });
    }

    try {
      const user = await db.prepare('SELECT password FROM users WHERE id = ?').get(id) as any;
      if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
        return res.status(400).json({ success: false, message: 'Password lama salah' });
      }

      const emojiRegex = /\p{Extended_Pictographic}/u;
      if (newPassword.length < 8 || emojiRegex.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
        return res.status(400).json({ success: false, message: 'Password baru minimal 8 karakter dengan huruf besar, huruf kecil, angka, dan simbol, tanpa emoji' });
      }

      const hashedNew = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedNew, id);
      res.json({ success: true, message: 'Password berhasil diperbarui, silakan login kembali' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Gagal memperbarui password' });
    }
  });

  // Auth: Update Phone 2SV - Send OTP to Email
  app.post('/api/users/:id/update-phone-2sv', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (String((req as any).user.userId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const user = await db.prepare('SELECT email FROM users WHERE id = ?').get(id) as any;
      if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await db.prepare('DELETE FROM otps WHERE identifier = ?').run(user.email);
      await db.prepare('INSERT INTO otps (identifier, code, expires_at) VALUES (?, ?, ?)').run(user.email, code, expiresAt);

      await sendOtpEmail(user.email, code, 'change-phone');

      res.json({ success: true, message: 'OTP verifikasi telah dikirim ke email bisnis Anda' });
    } catch (error) {
      console.error('Update Phone 2SV Error:', error);
      res.status(500).json({ success: false, message: 'Gagal mengirim OTP' });
    }
  });

  // Auth: Verify Phone 2SV and Update Phone
  app.post('/api/users/:id/verify-phone-2sv', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (String((req as any).user.userId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    const { otp, newPhone } = req.body;
    if (!otp || !newPhone) {
      return res.status(400).json({ success: false, message: 'OTP dan nomor telepon baru wajib diisi' });
    }

    try {
      const user = await db.prepare('SELECT email FROM users WHERE id = ?').get(id) as any;
      if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

      const otpData = await db.prepare('SELECT * FROM otps WHERE identifier = ? AND code = ?').get(user.email, otp) as any;
      if (!otpData || new Date(otpData.expires_at) < new Date()) {
        return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah kedaluwarsa' });
      }

      await db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(newPhone, id);
      await db.prepare('DELETE FROM otps WHERE identifier = ?').run(user.email);
      res.json({ success: true, message: 'Nomor telepon berhasil diperbarui, silakan login kembali' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Gagal memperbarui nomor telepon' });
    }
  });

  // Auth: Send OTP (email only)
  app.post('/api/auth/send-otp', async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ success: false, message: 'Identifier (email/username/phone) wajib diisi' });

    // Resolve identifier into an email address (we currently send OTP via email)
    let recipientEmail = identifier;
    if (!identifier.includes('@')) {
      const user = db.prepare('SELECT email FROM users WHERE phone = ? OR username = ?').get(identifier, identifier) as any;
      if (!user || !user.email) {
        return res.status(404).json({ success: false, message: 'Akun tidak ditemukan' });
      }
      recipientEmail = user.email;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    try {
      db.prepare('DELETE FROM otps WHERE identifier = ?').run(recipientEmail);
      db.prepare('INSERT INTO otps (identifier, code, expires_at) VALUES (?, ?, ?)').run(recipientEmail, code, expiresAt);

      await sendOtpEmail(recipientEmail, code, 'login');

      res.json({
        success: true,
        message: 'OTP telah dikirim ke email terdaftar',
        identifier: recipientEmail,
      });
    } catch (error) {
      console.error('Send OTP Error:', error);
      res.status(500).json({ success: false, message: 'Gagal mengirim OTP' });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const { identity, password } = req.body; // identity can be email or phone or username
      console.log(`Login attempt for: ${identity}`);
      
      const user = await db.prepare('SELECT id, username, email, phone, full_name, role, has_kijo_profile, password FROM users WHERE (email = ? OR phone = ? OR username = ?)').get(identity, identity, identity) as any;
      
      if (user) {
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (passwordMatch) {
          console.log(`Login success (Step 1): ${identity}`);
          
          // Determine OTP method and target
          let method: 'email' | 'phone' = 'phone';
          let targetIdentifier = identity;

          if (user.email === identity) {
            method = 'email';
          } else if (user.phone === identity) {
            method = 'phone';
          } else if (user.username === identity) {
            method = 'email';
            targetIdentifier = user.email; // Always use email for username login
          }

          // Add login notification
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            user.id,
            'login',
            'Login Berhasil',
            `Sesi login baru terdeteksi pada ${new Date().toLocaleString('id-ID')}`
          );

          // Track login history
          try {
            await db.prepare('INSERT INTO login_history (user_id, ip_address, user_agent) VALUES (?, ?, ?)').run(
              user.id,
              req.ip || req.headers['x-forwarded-for'] || null,
              req.headers['user-agent'] || null
            );
          } catch (loginHistErr) {
            console.error('Failed to record login history:', loginHistErr);
          }

          const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
          // Strip password hash before sending to client
          const { password: _, ...safeUser } = user;
          res.json({
            success: true,
            user: safeUser,
            token,
            requires2FA: true,
            method,
            targetIdentifier
          });
        } else {
          res.status(401).json({ success: false, message: 'Identitas atau password salah' });
        }
      } else {
        res.status(401).json({ success: false, message: 'Identitas atau password salah' });
      }
    } catch (error: any) {
      console.error('Login API Error:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  });

  // Auth: Signup
  app.post('/api/auth/signup', async (req, res) => {
    const { username, email, phone, password, full_name, role, birth_date } = req.body;
    
    // 1. Email Domain Validation
    if (!email.endsWith('@gmail.com') && !email.endsWith('@yahoo.com')) {
      return res.status(400).json({ success: false, message: 'Hanya domain @gmail.com dan @yahoo.com yang diizinkan' });
    }

    // 2. Password Validation (Min 8, uppercase, lowercase, number, symbol, no emoji)
    const emojiRegex = /\p{Extended_Pictographic}/u;
    if (password.length < 8 || emojiRegex.test(password) || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({ success: false, message: 'Password minimal 8 karakter dengan huruf besar, huruf kecil, angka, dan simbol, tanpa emoji' });
    }

    // 3. Name Validation (No symbols/numbers)
    const nameRegex = /^[a-zA-Z\s]*$/;
    if (!nameRegex.test(full_name)) {
      return res.status(400).json({ success: false, message: 'Nama asli tidak boleh mengandung angka atau simbol' });
    }

    // 4. Age Validation (Min 17 years for all users)
    const birth = new Date(birth_date);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear() - (
      today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()) ? 1 : 0
    );
    if (age < 17) {
      return res.status(400).json({ success: false, message: 'Usia minimal adalah 17 tahun' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const result = await db.prepare('INSERT INTO users (username, email, phone, password, full_name, role, birth_date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(username, email, phone, hashedPassword, full_name, 'jokies', birth_date);
      const user = await db.prepare('SELECT id, username, full_name, role, email, phone, has_kijo_profile FROM users WHERE id = ?').get(result.insertId);
      res.json({ success: true, user });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ success: false, message: 'Username, Email, atau Nomor Telepon sudah digunakan' });
      } else {
        console.error('Signup Error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
      }
    }
  });

  app.get('/api/auth/me/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (String((req as any).user.userId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const user = await db.prepare('SELECT id, username, email, phone, full_name, role, has_kijo_profile, verified_game, wallet_jokies, balance_active, balance_held, avatar_url, social_links FROM users WHERE id = ?').get(id) as any;
      if (user) {
        const gameAccounts = await db.prepare('SELECT * FROM game_accounts WHERE user_id = ? AND deleted = 0').all(id);
        res.json({ success: true, user: { ...user, gameAccounts } });
      } else {
        res.status(404).json({ success: false, message: 'User tidak ditemukan' });
      }
    } catch (error) {
      console.error('Me API Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Update Kijo Profile Status
  app.post('/api/users/:id/kijo-profile', async (req, res) => {
    const { id } = req.params;
    try {
      await db.prepare('UPDATE users SET has_kijo_profile = 1 WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Submit Kijo Application
  app.post('/api/kijo/apply', async (req, res) => {
    const { userId, identificationPhotos, socialMedia, experienceType, proofPhotos, desiredGame } = req.body;
    try {
      // Check if already applied
      const existing = await db.prepare("SELECT id FROM kijo_applications WHERE user_id = ? AND status = 'pending'").get(userId);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Anda sudah memiliki pengajuan yang sedang diproses.' });
      }

      await db.prepare(`
        INSERT INTO kijo_applications (user_id, identification_photos, social_media, experience_type, proof_photos, desired_game)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, JSON.stringify(identificationPhotos), socialMedia, experienceType, JSON.stringify(proofPhotos), desiredGame);

      res.json({ success: true, message: 'Pengajuan berhasil dikirim. Mohon tunggu verifikasi admin.' });
    } catch (error) {
      console.error('Kijo Apply Error:', error);
      res.status(500).json({ success: false, message: 'Gagal mengirim pengajuan.' });
    }
  });

  // API: Get Kijo Application Status for a user
  app.get('/api/kijo/application-status/:userId', requireAuth, async (req, res) => {
    const { userId } = req.params;
    if (String((req as any).user.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const application = await db.prepare('SELECT status, created_at, desired_game FROM kijo_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
      res.json(application || null);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get Kijo Applications (Admin)
  app.get('/api/admin/kijo-applications', async (req, res) => {
    try {
      const apps = (await db.prepare(`
        SELECT a.*, u.username, u.full_name, u.email, u.phone
        FROM kijo_applications a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
      `).all()) as any[];
      
      const formattedApps = apps.map(app => ({
        ...app,
        identification_photos: JSON.parse(app.identification_photos || '[]'),
        proof_photos: JSON.parse(app.proof_photos || '[]')
      }));
      
      res.json(formattedApps);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Verify Kijo Application (Admin)
  app.post('/api/admin/verify-kijo', async (req, res) => {
    const { applicationId, status, reason } = req.body; // status: 'approved' | 'rejected'
    try {
      const application = await db.prepare('SELECT user_id, desired_game FROM kijo_applications WHERE id = ?').get(applicationId) as any;
      if (!application) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });

      await db.transaction(async () => {
        await db.prepare('UPDATE kijo_applications SET status = ? WHERE id = ?').run(status, applicationId);

        if (status === 'approved') {
          await db.prepare("UPDATE users SET role = 'kijo', is_verified = 1, verified_game = ? WHERE id = ?").run(application.desired_game, application.user_id);

          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            application.user_id,
            'system',
            'Selamat! Pengajuan Kijo Disetujui',
            `Anda sekarang resmi menjadi Kijo di Acinonyx untuk game ${application.desired_game}. Silakan lengkapi etalase Anda.`
          );
        } else {
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            application.user_id,
            'system',
            'Pengajuan Kijo Ditolak',
            `Mohon maaf, pengajuan Anda ditolak dengan alasan: ${reason || 'Data tidak sesuai kriteria'}.`
          );
        }
      })();

      res.json({ success: true });
    } catch (error) {
      console.error('Verify Kijo Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Get Marketplace Kijo List
  app.get('/api/marketplace/kijo', async (req, res) => {
    try {
      console.log('[API] Fetching Marketplace Kijo List...');
      const kijos = (await db.prepare(`
        SELECT id, username, full_name, avatar_url, role, status_ketersediaan, manual_status, work_start, work_end, motto, detail_kijo, has_kijo_profile, verified_game, max_slots,
        (SELECT COUNT(*) FROM categories c JOIN packages p ON c.id = p.category_id WHERE c.user_id = users.id AND c.visible = 1 AND p.deleted = 0 AND p.archived = 0) as total_package_count,
        (SELECT COUNT(*) FROM categories c JOIN packages p ON c.id = p.category_id WHERE c.user_id = users.id AND c.visible = 1 AND p.deleted = 0 AND p.archived = 0) as active_package_count,
        (SELECT COUNT(*) FROM categories c JOIN packages p ON c.id = p.category_id WHERE c.user_id = users.id AND p.package_type = 'VIP' AND c.visible = 1 AND p.deleted = 0 AND p.archived = 0) as has_vip
        FROM users 
        WHERE role = 'kijo'
      `).all()) as any[];

      console.log(`[API] Found ${kijos.length} Kijos.`);

      const now = new Date();
      const nowStr = now.toISOString().replace('T', ' ').substring(0, 19);

      const detailedKijos = await Promise.all(kijos.map(async (kijo) => {
        // Check for holidays
        const holiday = await db.prepare('SELECT * FROM holidays WHERE user_id = ? AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)').get(kijo.id, nowStr, nowStr) as any;
        
        // Get average rating
        const ratingStats = await db.prepare('SELECT AVG(stars) as avg_stars, COUNT(*) as total_reviews FROM ratings WHERE user_id = ?').get(kijo.id) as any;
        
        // Get traits
        const traits = await db.prepare('SELECT trait_key, level FROM traits WHERE user_id = ?').all(kijo.id);
        
        // Get active games (only those with visible packages)
        const activeGames = await db.prepare(`
          SELECT DISTINCT c.game_name 
          FROM categories c 
          JOIN packages p ON c.id = p.category_id 
          WHERE c.user_id = ? AND c.visible = 1 AND p.deleted = 0 AND p.archived = 0
        `).all(kijo.id);
        
        // Get total booked (completed sessions)
        const totalBooked = await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND status = 'completed'").get(kijo.id) as { count: number };

        // Get active orders count
        const activeOrders = await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND status IN ('upcoming', 'ongoing')").get(kijo.id) as { count: number };

        // Determine effective status
        let effectiveStatus = kijo.manual_status || 'online';
        if (holiday) {
          effectiveStatus = 'holiday';
        } else if (kijo.max_slots !== 0 && activeOrders.count >= (kijo.max_slots || 3)) {
          effectiveStatus = 'busy';
        }

        return {
          ...kijo,
          effective_status: effectiveStatus,
          rating: ratingStats.avg_stars || 0,
          total_reviews: ratingStats.total_reviews || 0,
          traits,
          games: activeGames.map((g: any) => g.game_name),
          total_booked: totalBooked.count,
          active_orders: activeOrders.count
        };
      }));

      res.json(detailedKijos);
    } catch (error) {
      console.error('Marketplace API Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Get Kijo Detail (Packages)
  app.get('/api/marketplace/kijo/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[API] Fetching Kijo Detail for ID: ${id}`);
    try {
      const kijo = await db.prepare('SELECT id, username, full_name, avatar_url, motto, detail_kijo, status_ketersediaan, manual_status, work_start, work_end, verified_game, max_slots FROM users WHERE id = ?').get(id) as any;
      if (!kijo) {
        console.log(`[API] Kijo with ID ${id} not found.`);
        return res.status(404).json({ success: false, message: 'Kijo tidak ditemukan' });
      }

      const now = new Date();
      const nowStr = now.toISOString().replace('T', ' ').substring(0, 19);
      const holiday = await db.prepare('SELECT * FROM holidays WHERE user_id = ? AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)').get(id, nowStr, nowStr) as any;
      const activeOrders = await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND status IN ('upcoming', 'ongoing')").get(id) as { count: number };

      let effectiveStatus = kijo.manual_status || 'online';
      if (holiday) {
        effectiveStatus = 'holiday';
      } else if (kijo.max_slots !== 0 && activeOrders.count >= (kijo.max_slots || 3)) {
        effectiveStatus = 'busy';
      }

      console.log(`[API] Fetching etalase for Kijo ID: ${id}`);
      const etalase = (await db.prepare(`
        SELECT c.* FROM categories c
        LEFT JOIN game_accounts ga ON c.game_account_id = ga.id
        WHERE c.user_id = ? AND c.visible = 1
        AND (c.game_account_id IS NULL OR (ga.id IS NOT NULL AND ga.deleted = 0))
      `).all(id)) as any[];
      console.log(`[API] Found ${etalase.length} visible categories for Kijo ${id}.`);
      
      const detailedEtalase = await Promise.all(etalase.map(async (cat: any) => {
        const packages = (await db.prepare('SELECT id, name, price, duration, package_type, player_count, min_players, max_players, archived, deleted, rank, is_recurring, is_bundle, bundle_start, bundle_end, recurring_extra_duration, recurring_every_quantity, criteria FROM packages WHERE category_id = ? AND deleted = 0 AND archived = 0').all(cat.id)) as any[];
        console.log(`[API] Category ${cat.id} (${cat.name}) has ${packages.length} active packages.`);
        return { ...cat, packages };
      }));

      const ratingStats = await db.prepare('SELECT AVG(stars) as avg_stars, COUNT(*) as total_reviews FROM ratings WHERE user_id = ?').get(id) as any;
      const totalBooked = await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND status = 'completed'").get(id) as { count: number };

      const activeGames = (await db.prepare(`
        SELECT DISTINCT c.game_name 
        FROM categories c 
        JOIN packages p ON c.id = p.category_id 
        WHERE c.user_id = ? AND c.visible = 1 AND p.deleted = 0 AND p.archived = 0
      `).all(id)) as any[];
      const traits = (await db.prepare('SELECT trait_key, level FROM traits WHERE user_id = ?').all(id)) as any[];
      const boostingAccounts = (await db.prepare("SELECT id, nickname, game_id FROM game_accounts WHERE user_id = ? AND account_type = 'boosting' AND deleted = 0").all(id)) as any[];

      res.json({
        ...kijo,
        effective_status: effectiveStatus,
        etalase: detailedEtalase,
        rating: ratingStats.avg_stars || 0,
        total_reviews: ratingStats.total_reviews || 0,
        total_booked: totalBooked.count,
        active_orders: activeOrders.count,
        games: activeGames.map((g: any) => g.game_name),
        traits,
        boosting_accounts: boostingAccounts
      });
    } catch (error: any) {
      console.error('[API] Kijo Detail Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // API: Get public reviews for a Kijo
  app.get('/api/marketplace/kijo/:id/reviews', async (req, res) => {
    const { id } = req.params;
    try {
      const reviews = await db.prepare(`
        SELECT r.stars, r.skill_rating, r.attitude_rating, r.comment, r.tags, r.reply, r.reply_at, r.created_at,
               u.full_name as jokies_name, u.avatar_url as jokies_avatar
        FROM ratings r
        JOIN users u ON r.jokies_id = u.id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
      `).all(id);
      res.json(reviews);
    } catch (error: any) {
      console.error('[API] Kijo Reviews Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // API: Get Orders for Buyer (Jokies)
  app.get('/api/jokies/orders/:userId', requireAuth, async (req: any, res: any) => {
    const userId = req.user.userId;
    try {
      // Auto-start: only for THIS Jokies' upcoming sessions
      const now = new Date();
      const nowIso = now.toISOString();
      const sessionsToStart = (await db.prepare("SELECT id, user_id FROM sessions WHERE jokies_id = ? AND status = 'upcoming' AND scheduled_at <= ?").all(userId, nowIso)) as any[];
      
      for (const session of sessionsToStart) {
        await db.prepare("UPDATE sessions SET status = 'ongoing', started_at = NOW() WHERE id = ?").run(session.id);
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          session.user_id, 'system', 'Sesi Dimulai Otomatis',
          `Sesi #${session.id} telah dimulai secara otomatis karena sudah melewati waktu mulai.`
        );
      }

      // Auto-cancel: Jokies' upcoming sessions past scheduled_at + duration
      try {
        const expiredSessions = (await db.prepare(`
          SELECT id, user_id, total_price, duration, scheduled_at
          FROM sessions WHERE jokies_id = ? AND status = 'upcoming'
        `).all(userId)) as any[];
        for (const s of expiredSessions) {
          const end = new Date(new Date(s.scheduled_at).getTime() + (s.duration || 1) * 60 * 60 * 1000);
          if (now > end) {
            await db.transaction(async () => {
              await db.prepare("UPDATE sessions SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'system', cancellation_reason = 'Otomatis dibatalkan: melewati waktu booking + durasi tanpa dimulai' WHERE id = ?").run(s.id);
              if (s.total_price) {
                await db.prepare('UPDATE users SET wallet_jokies = wallet_jokies + ? WHERE id = ?').run(s.total_price, userId);
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  userId, 'order_update', 'Pesanan Dibatalkan Otomatis',
                  `Pesanan #${s.id} dibatalkan otomatis karena melewati waktu booking. Dana Rp ${(s.total_price || 0).toLocaleString()} dikembalikan ke wallet Anda.`
                );
              }
              if (s.user_id) {
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  s.user_id, 'system', 'Pesanan Expired',
                  `Pesanan #${s.id} dibatalkan otomatis karena melewati waktu booking + durasi tanpa dimulai.`
                );
              }
            })();
          }
        }
      } catch (e) {
        console.error('Auto-cancel expired jokies sessions error:', e);
      }

      // Auto-cancel: pending_payment sessions older than 20 minutes (15 min Midtrans + 5 min buffer)
      try {
        const pendingPayments = (await db.prepare(`
          SELECT id, user_id, created_at FROM sessions WHERE jokies_id = ? AND status = 'pending_payment'
        `).all(userId)) as any[];
        for (const s of pendingPayments) {
          const createdAt = new Date(s.created_at).getTime();
          if (now.getTime() - createdAt > PAYMENT_TIMEOUT_MS) {
            await db.transaction(async () => {
              await db.prepare("UPDATE sessions SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'system', cancellation_reason = 'Otomatis dibatalkan: pembayaran tidak diselesaikan dalam waktu yang ditentukan' WHERE id = ? AND status = 'pending_payment'").run(s.id);
              await db.prepare("UPDATE payment_transactions SET payment_status = 'expire', escrow_status = 'none', updated_at = NOW() WHERE session_id = ? AND payment_status = 'pending'").run(s.id);
              await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                userId, 'order_update', 'Pembayaran Kedaluwarsa',
                `Pesanan #${s.id} dibatalkan otomatis karena pembayaran tidak diselesaikan dalam waktu yang ditentukan.`
              );
            })();
          }
        }
      } catch (e) {
        console.error('Auto-cancel pending_payment jokies error:', e);
      }

      // Auto-complete: ongoing sessions past scheduled_at + duration (unattended)
      try {
        const ongoingSessions = (await db.prepare(`
          SELECT id, user_id, scheduled_at, duration, screenshot_start, screenshot_end, total_price, price, admin_fee, escrow_status, payment_transaction_id
          FROM sessions WHERE jokies_id = ? AND status = 'ongoing'
        `).all(userId)) as any[];
        for (const s of ongoingSessions) {
          const endTime = new Date(new Date(s.scheduled_at).getTime() + (s.duration || 1) * 60 * 60 * 1000);
          if (now > endTime) {
            const hasProofs = !!(s.screenshot_start && s.screenshot_end);
            await db.transaction(async () => {
              if (hasProofs) {
                // Kijo uploaded both proofs → auto-complete with escrow release
                await db.prepare("UPDATE sessions SET status = 'completed', completed_at = NOW(), kijo_finished = 1, jokies_finished = 1, escrow_status = 'released' WHERE id = ? AND status = 'ongoing'").run(s.id);
                // Release escrow: move held balance to Kijo's active balance
                const kijoEarnings = s.price || (s.total_price - (s.admin_fee || 0));
                await db.prepare('UPDATE users SET balance_active = balance_active + ? WHERE id = ?').run(kijoEarnings, s.user_id);
                if (s.payment_transaction_id) {
                  await db.prepare("UPDATE payment_transactions SET escrow_status = 'released', released_at = NOW(), updated_at = NOW() WHERE id = ?").run(s.payment_transaction_id);
                }
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  s.user_id, 'order_update', 'Pesanan Selesai Otomatis',
                  `Pesanan #${s.id} telah diselesaikan otomatis. Dana Rp ${(kijoEarnings || 0).toLocaleString()} dicairkan ke Saldo Aktif Anda.`
                );
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  userId, 'order_update', 'Pesanan Selesai Otomatis',
                  `Pesanan #${s.id} telah diselesaikan otomatis karena durasi sesi telah selesai.`
                );
              } else {
                // No proofs → mark pending_completion, Kijo must upload proofs to get paid
                await db.prepare("UPDATE sessions SET status = 'pending_completion', kijo_finished = 0 WHERE id = ? AND status = 'ongoing'").run(s.id);
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  s.user_id, 'order_update', 'Sesi Selesai — Unggah Bukti',
                  `Durasi pesanan #${s.id} telah berakhir. Silakan unggah bukti pengerjaan (Sebelum & Sesudah) agar dana dapat dicairkan.`
                );
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  userId, 'order_update', 'Durasi Sesi Berakhir',
                  `Durasi pesanan #${s.id} telah berakhir. Menunggu Partner mengunggah bukti pengerjaan.`
                );
              }
            })();
          }
        }
      } catch (e) {
        console.error('Auto-complete ongoing jokies sessions error:', e);
      }

      const orders = (await db.prepare(`
        SELECT s.*, u.full_name as kijo_name, u.username as kijo_username,
          (SELECT COUNT(*) FROM ratings r WHERE r.session_id = s.id) as has_rating
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.jokies_id = ? 
        ORDER BY s.id DESC
      `).all(userId)) as any[];

      // Add inactivity check for 'ongoing' sessions
      const ordersWithInactivity = orders.map((order: any) => {
        if (order.status === 'ongoing') {
          const scheduledTime = new Date(order.scheduled_at);
          const diffMins = (new Date().getTime() - scheduledTime.getTime()) / (1000 * 60);
          if (diffMins > 15 && !order.screenshot_start) {
            return { ...order, needs_admin_chat: true };
          }
        }
        return order;
      });

      res.json(ordersWithInactivity);
    } catch (error) {
      console.error('Error fetching jokies orders:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil data pesanan' });
    }
  });

  // API: Get Admin Settings
  app.get('/api/admin/settings', async (req, res) => {
    try {
      const adminFee = (await db.prepare('SELECT value FROM settings WHERE `key` = ?').get('admin_fee')) as any;
      res.json({ admin_fee: adminFee ? parseInt(adminFee.value) : 10 });
    } catch (error: any) {
      console.warn('[API] /api/admin/settings failed, attempting to recover:', error?.message || error);
      // Try to ensure settings table exists and return defaults.
      try {
        await db.query(`CREATE TABLE IF NOT EXISTS settings (
          \`key\` VARCHAR(255) PRIMARY KEY,
          value TEXT
        )`);
        res.json({ admin_fee: 10 });
      } catch (innerErr) {
        console.error('[API] /api/admin/settings recovery failed:', innerErr);
        res.status(500).json({ success: false });
      }
    }
  });

  // API: Place Order
  app.post('/api/jokies/place-order', async (req, res) => {
    const { jokiesId, kijoId, title, price, quantity, player_count, duration, scheduledAt, gameTitle, rankStart, rankEnd, paymentMethod, jokiesNickname, jokiesGameId, jokiesGameAccountId, categoryId, kijoGameAccountId: requestedKijoGameAccountId } = req.body;
    try {
      // 1. Check if user has personal game account for this game (skip for Simulasi)
      if (paymentMethod !== 'Simulasi') {
        const personalAccount = await db.prepare(`
          SELECT id FROM game_accounts 
          WHERE user_id = ? 
          AND game_name LIKE ?
          AND account_type = 'personal' 
          AND deleted = 0
        `).get(jokiesId, `%${gameTitle}%`);

        if (!personalAccount) {
          return res.status(400).json({ 
            success: false, 
            message: 'Anda harus menambahkan detail akun game personal untuk game ini di halaman Akun sebelum melakukan pemesanan.' 
          });
        }
      }

      // Fetch jokies user data
      const jokies = await db.prepare('SELECT full_name, wallet_jokies, jokies_lock_until FROM users WHERE id = ?').get(jokiesId) as any;
      if (!jokies) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

      if (paymentMethod !== 'Simulasi' && jokies.jokies_lock_until && new Date(jokies.jokies_lock_until) > new Date()) {
        const lockTime = new Date(jokies.jokies_lock_until).toLocaleTimeString('id-ID');
        return res.status(403).json({ success: false, message: `Tidak dapat melakukan pemesanan selama 60 menit setelah pembatalan (Hingga ${lockTime}).` });
      }

      // Validate Jokies Game Account
      let finalJokiesNickname = jokiesNickname;
      let finalJokiesGameId = jokiesGameId;
      let finalJokiesGameAccountId = jokiesGameAccountId;
      let finalJokiesDynamicData = req.body.dynamic_data ? JSON.stringify(req.body.dynamic_data) : null;

      if (jokiesGameAccountId) {
        const acc = await db.prepare('SELECT nickname, game_id, dynamic_data FROM game_accounts WHERE id = ? AND user_id = ? AND account_type = \'personal\' AND deleted = 0').get(jokiesGameAccountId, jokiesId) as any;
        if (acc) {
          finalJokiesNickname = acc.nickname;
          finalJokiesGameId = acc.game_id;
          if (!finalJokiesDynamicData) finalJokiesDynamicData = acc.dynamic_data;
        }
      } else if (jokiesNickname && jokiesGameId) {
        const acc = await db.prepare('SELECT id FROM game_accounts WHERE user_id = ? AND game_name = ? AND nickname = ? AND game_id = ? AND deleted = 0').get(jokiesId, gameTitle, jokiesNickname, jokiesGameId) as any;
        if (acc) finalJokiesGameAccountId = acc.id;
      }

      // Get Kijo data
      const kijo = await db.prepare('SELECT full_name, work_start, work_end, break_time, pre_order_days, max_slots FROM users WHERE id = ?').get(kijoId) as any;
      if (!kijo) return res.status(404).json({ success: false, message: 'Kijo tidak ditemukan' });

      // Pre-order days check
      const scheduledDate = new Date(scheduledAt);
      const now = new Date();
      const maxDate = new Date();
      maxDate.setDate(now.getDate() + (kijo.pre_order_days ?? 7));
      maxDate.setHours(23, 59, 59, 999);
      if (scheduledDate > maxDate) {
        return res.status(400).json({ success: false, message: `Kijo ini hanya menerima pesanan maksimal ${kijo.pre_order_days ?? 7} hari ke depan.` });
      }

      // Max slots check (0 = unlimited) — include pending_payment to prevent overbooking
      const effectiveMaxSlots = kijo.max_slots === null ? 3 : (kijo.max_slots || 0);
      if (effectiveMaxSlots > 0) {
        const activeOrders = await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND status IN ('upcoming', 'ongoing', 'pending_payment')").get(kijoId) as any;
        if ((activeOrders?.count ?? 0) >= effectiveMaxSlots) {
          return res.status(400).json({ success: false, message: 'Slot pesanan Kijo sudah penuh.' });
        }
      }

      // Admin fee
      const adminFeeSetting = await db.prepare('SELECT value FROM settings WHERE `key` = ?').get('admin_fee') as any;
      const adminFeePercent = adminFeeSetting ? (parseInt(adminFeeSetting.value) || 10) : 10;
      const basePrice = (price || 0) * (quantity || 1);
      const adminFee = Math.round((basePrice * adminFeePercent) / 100);
      const totalPrice = basePrice + adminFee;

      // Wallet balance check
      if (paymentMethod === 'Wallet') {
        if ((jokies.wallet_jokies ?? 0) < totalPrice) {
          return res.status(400).json({ success: false, message: 'Saldo Wallet tidak mencukupi' });
        }
      }

      // Fetch Kijo's boosting game account
      let kijoGameAccount: any = null;
      
      if (requestedKijoGameAccountId) {
        kijoGameAccount = await db.prepare('SELECT id, nickname, game_id, dynamic_data FROM game_accounts WHERE id = ? AND user_id = ? AND account_type = \'boosting\' AND deleted = 0').get(requestedKijoGameAccountId, kijoId) as any;
      }
      
      if (!kijoGameAccount && categoryId) {
        const category = await db.prepare('SELECT rank FROM categories WHERE id = ?').get(categoryId) as any;
        if (category?.rank) {
          kijoGameAccount = await db.prepare(`
            SELECT id, nickname, game_id, dynamic_data 
            FROM game_accounts 
            WHERE user_id = ? AND game_name LIKE ? AND account_type = 'boosting' AND rank = ? AND deleted = 0
          `).get(kijoId, `%${gameTitle}%`, category.rank) as any;
        }
      }
      
      if (!kijoGameAccount) {
        kijoGameAccount = await db.prepare(`
          SELECT id, nickname, game_id, dynamic_data 
          FROM game_accounts 
          WHERE user_id = ? AND game_name LIKE ? AND account_type = 'boosting' AND deleted = 0
        `).get(kijoId, `%${gameTitle}%`) as any;
      }

      const kijoNickname = kijoGameAccount?.nickname || '-';
      const kijoGameId = kijoGameAccount?.game_id || '-';
      const kijoGameAccountId = kijoGameAccount?.id || null;
      const kijoDynamicData = kijoGameAccount?.dynamic_data || null;

      const result = await db.transaction(async () => {
        if (paymentMethod === 'Wallet') {
          await db.prepare('UPDATE users SET wallet_jokies = wallet_jokies - ? WHERE id = ?').run(totalPrice, jokiesId);
        }

        const insert = await db.prepare(`
          INSERT INTO sessions (user_id, jokies_id, title, customer_name, price, admin_fee, total_price, quantity, player_count, scheduled_at, duration, status, game_title, rank_start, rank_end, payment_method, jokies_nickname, jokies_game_id, jokies_game_account_id, jokies_dynamic_data, kijo_nickname, kijo_game_id, kijo_game_account_id, kijo_dynamic_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(kijoId, jokiesId, title, jokies.full_name, price, adminFee, totalPrice, quantity || 1, player_count || 1, scheduledAt, duration || 1, 'upcoming', gameTitle, rankStart || '', rankEnd || '', paymentMethod, finalJokiesNickname, finalJokiesGameId, finalJokiesGameAccountId, finalJokiesDynamicData, kijoNickname, kijoGameId, kijoGameAccountId, kijoDynamicData);

        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          kijoId, 'order_new', 'Pesanan Baru!',
          `Anda menerima pesanan baru: ${title}. ID Pesanan: #${insert.insertId}`
        );

        const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as any[];
        for (const admin of admins) {
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            admin.id, 'system', 'Pesanan Baru Masuk',
            `Pesanan baru #${insert.insertId} telah dibuat oleh ${jokies.full_name} untuk ${kijo.full_name}.`
          );
        }

        return insert;
      })();
      
      res.json({ success: true, orderId: result.insertId });
    } catch (error) {
      console.error('Error placing order:', error);
      res.status(500).json({ success: false, message: 'Gagal membuat pesanan: ' + (error as any)?.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MIDTRANS PAYMENT & ESCROW SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  // Expose Midtrans Client Key to frontend
  app.get('/api/payment/client-key', (_req, res) => {
    res.json({ clientKey: MIDTRANS_CLIENT_KEY, isProduction: MIDTRANS_IS_PRODUCTION });
  });

  // Public endpoint for admin fee (not behind requireAdmin)
  app.get('/api/settings/admin-fee', async (_req, res) => {
    try {
      const adminFee = (await db.prepare('SELECT value FROM settings WHERE `key` = ?').get('admin_fee')) as any;
      res.json({ admin_fee: adminFee ? parseInt(adminFee.value) : 10 });
    } catch {
      res.json({ admin_fee: 10 });
    }
  });

  // Create Midtrans Snap Transaction (with idempotency)
  app.post('/api/payment/create-transaction', requireAuth, paymentLimiter, async (req: any, res: any) => {
    const jokiesId = req.user.userId;
    const { kijoId, title, price, quantity, player_count, duration, scheduledAt, gameTitle, rankStart, rankEnd, jokiesNickname, jokiesGameId, jokiesGameAccountId, categoryId, kijoGameAccountId: requestedKijoGameAccountId, dynamic_data, idempotencyKey } = req.body;

    if (!idempotencyKey) {
      return res.status(400).json({ success: false, message: 'idempotencyKey is required' });
    }
    if (!MIDTRANS_SERVER_KEY) {
      return res.status(500).json({ success: false, message: 'Payment gateway belum dikonfigurasi.' });
    }

    try {
      // IDEMPOTENCY CHECK: If this key already exists, return the existing transaction
      const existing = await db.prepare(
        'SELECT * FROM payment_transactions WHERE idempotency_key = ?'
      ).get(idempotencyKey) as any;

      if (existing) {
        // Already created — return stored snap token
        if (existing.snap_token) {
          return res.json({
            success: true,
            snapToken: existing.snap_token,
            snapRedirectUrl: existing.snap_redirect_url,
            orderId: existing.order_id,
            alreadyCreated: true,
          });
        }
        // If somehow we have a record but no snap token, let it recreate below
      }

      // 1. Validate jokies
      const jokies = await db.prepare('SELECT full_name, wallet_jokies, jokies_lock_until, email, phone FROM users WHERE id = ?').get(jokiesId) as any;
      if (!jokies) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

      if (jokies.jokies_lock_until && new Date(jokies.jokies_lock_until) > new Date()) {
        const lockTime = new Date(jokies.jokies_lock_until).toLocaleTimeString('id-ID');
        return res.status(403).json({ success: false, message: `Tidak dapat melakukan pemesanan selama 60 menit setelah pembatalan (Hingga ${lockTime}).` });
      }

      // 2. Validate personal game account
      const personalAccount = await db.prepare(`
        SELECT id FROM game_accounts 
        WHERE user_id = ? AND game_name LIKE ? AND account_type = 'personal' AND deleted = 0
      `).get(jokiesId, `%${gameTitle}%`);
      if (!personalAccount) {
        return res.status(400).json({ success: false, message: 'Anda harus menambahkan detail akun game personal untuk game ini.' });
      }

      // 3. Validate Kijo
      const kijo = await db.prepare('SELECT full_name, work_start, work_end, break_time, pre_order_days, max_slots FROM users WHERE id = ?').get(kijoId) as any;
      if (!kijo) return res.status(404).json({ success: false, message: 'Kijo tidak ditemukan' });

      // Pre-order days check
      const scheduledDate = new Date(scheduledAt);
      const now = new Date();
      const maxDate = new Date();
      maxDate.setDate(now.getDate() + (kijo.pre_order_days ?? 7));
      maxDate.setHours(23, 59, 59, 999);
      if (scheduledDate > maxDate) {
        return res.status(400).json({ success: false, message: `Kijo ini hanya menerima pesanan maksimal ${kijo.pre_order_days ?? 7} hari ke depan.` });
      }

      // Lead time check: slot must be at least 20 minutes from now
      const BOOKING_LEAD_TIME_MS = 20 * 60 * 1000;
      if (scheduledDate.getTime() - now.getTime() < BOOKING_LEAD_TIME_MS) {
        return res.status(400).json({ success: false, message: 'Pemesanan harus dilakukan minimal 20 menit sebelum waktu mulai.' });
      }

      // Max slots check — include pending_payment to prevent overbooking
      const effectiveMaxSlots = kijo.max_slots === null ? 3 : (kijo.max_slots || 0);
      if (effectiveMaxSlots > 0) {
        const activeOrders = await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND status IN ('upcoming', 'ongoing', 'pending_payment')").get(kijoId) as any;
        if ((activeOrders?.count ?? 0) >= effectiveMaxSlots) {
          return res.status(400).json({ success: false, message: 'Slot pesanan Kijo sudah penuh.' });
        }
      }

      // Time overlap check — prevent double-booking the same time slot
      const sessionDurationMs = (duration || 1) * 60 * 60 * 1000;
      const breakTime = kijo.break_time || 0;
      const breakMs = breakTime * 60 * 60 * 1000;
      const requestedStart = scheduledDate.getTime();
      const requestedEnd = requestedStart + sessionDurationMs;

      const existingSessions = (await db.prepare(
        "SELECT scheduled_at, duration FROM sessions WHERE user_id = ? AND status IN ('upcoming', 'ongoing', 'pending_payment') AND DATE(scheduled_at) = DATE(?)"
      ).all(kijoId, scheduledAt)) as any[];

      for (const s of existingSessions) {
        const sStart = new Date(s.scheduled_at).getTime();
        const sDuration = (s.duration || 1) * 60 * 60 * 1000;
        const sEnd = sStart + sDuration;
        const sEndWithBreak = sEnd + breakMs;
        // Overlap: requested session overlaps with existing session + break buffer
        // Also check reverse: existing session starts during requested session + break
        if (requestedStart < sEndWithBreak && requestedEnd > sStart) {
          return res.status(409).json({ success: false, message: 'Slot waktu ini sudah terisi. Silakan pilih waktu lain.' });
        }
      }

      // 4. Calculate prices
      const adminFeeSetting = await db.prepare('SELECT value FROM settings WHERE `key` = ?').get('admin_fee') as any;
      const adminFeePercent = adminFeeSetting ? (parseInt(adminFeeSetting.value) || 10) : 10;
      const basePrice = (price || 0) * (quantity || 1);
      const adminFee = Math.round((basePrice * adminFeePercent) / 100);
      const totalPrice = basePrice + adminFee;

      // 5. Generate unique order ID for Midtrans
      const orderId = `ACX-${Date.now()}-${jokiesId}`;

      // 6. Create Snap transaction via Midtrans API
      const snapPayload = {
        transaction_details: {
          order_id: orderId,
          gross_amount: totalPrice,
        },
        item_details: [
          {
            id: `service-${categoryId || 'pkg'}`,
            price: basePrice,
            quantity: 1,
            name: (title || 'Layanan Gaming').substring(0, 50),
          },
          {
            id: 'admin-fee',
            price: adminFee,
            quantity: 1,
            name: `Biaya Penanganan (${adminFeePercent}%)`,
          },
        ],
        customer_details: {
          first_name: jokies.full_name || 'Customer',
          email: jokies.email || undefined,
          phone: jokies.phone || undefined,
        },
        callbacks: {
          finish: '/orders',
        },
      };

      const authString = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');
      const snapResponse = await fetch(MIDTRANS_SNAP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authString}`,
        },
        body: JSON.stringify(snapPayload),
      });

      if (!snapResponse.ok) {
        const errBody = await snapResponse.text();
        console.error('[Midtrans] Snap creation failed:', snapResponse.status, errBody);
        return res.status(502).json({ success: false, message: 'Gagal membuat transaksi pembayaran.' });
      }

      const snapData = await snapResponse.json() as { token: string; redirect_url: string };

      // 7. Store payment transaction & booking data in DB (within transaction)
      let createdSessionId: number | bigint = 0;
      await db.transaction(async () => {
        // Resolve jokies game account
        let finalJokiesNickname = jokiesNickname;
        let finalJokiesGameId = jokiesGameId;
        let finalJokiesGameAccountId = jokiesGameAccountId;
        let finalJokiesDynamicData = dynamic_data ? JSON.stringify(dynamic_data) : null;

        if (jokiesGameAccountId) {
          const acc = await db.prepare("SELECT nickname, game_id, dynamic_data FROM game_accounts WHERE id = ? AND user_id = ? AND account_type = 'personal' AND deleted = 0").get(jokiesGameAccountId, jokiesId) as any;
          if (acc) {
            finalJokiesNickname = acc.nickname;
            finalJokiesGameId = acc.game_id;
            if (!finalJokiesDynamicData) finalJokiesDynamicData = acc.dynamic_data;
          }
        }

        // Resolve kijo game account
        let kijoGameAccount: any = null;
        if (requestedKijoGameAccountId) {
          kijoGameAccount = await db.prepare("SELECT id, nickname, game_id, dynamic_data FROM game_accounts WHERE id = ? AND user_id = ? AND account_type = 'boosting' AND deleted = 0").get(requestedKijoGameAccountId, kijoId) as any;
        }
        if (!kijoGameAccount && categoryId) {
          const category = await db.prepare('SELECT rank FROM categories WHERE id = ?').get(categoryId) as any;
          if (category?.rank) {
            kijoGameAccount = await db.prepare("SELECT id, nickname, game_id, dynamic_data FROM game_accounts WHERE user_id = ? AND game_name LIKE ? AND account_type = 'boosting' AND rank = ? AND deleted = 0").get(kijoId, `%${gameTitle}%`, category.rank) as any;
          }
        }
        if (!kijoGameAccount) {
          kijoGameAccount = await db.prepare("SELECT id, nickname, game_id, dynamic_data FROM game_accounts WHERE user_id = ? AND game_name LIKE ? AND account_type = 'boosting' AND deleted = 0").get(kijoId, `%${gameTitle}%`) as any;
        }

        const kijoNickname = kijoGameAccount?.nickname || '-';
        const kijoGameId_val = kijoGameAccount?.game_id || '-';
        const kijoGameAccountId_val = kijoGameAccount?.id || null;
        const kijoDynamicData = kijoGameAccount?.dynamic_data || null;

        // Create session in 'pending_payment' — will be activated by webhook
        const insert = await db.prepare(`
          INSERT INTO sessions (user_id, jokies_id, title, customer_name, price, admin_fee, total_price, quantity, player_count, scheduled_at, duration, status, game_title, rank_start, rank_end, payment_method, jokies_nickname, jokies_game_id, jokies_game_account_id, jokies_dynamic_data, kijo_nickname, kijo_game_id, kijo_game_account_id, kijo_dynamic_data, midtrans_order_id, escrow_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?, 'Midtrans', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none')
        `).run(kijoId, jokiesId, title, jokies.full_name, price, adminFee, totalPrice, quantity || 1, player_count || 1, scheduledAt, duration || 1, gameTitle, rankStart || '', rankEnd || '', finalJokiesNickname, finalJokiesGameId, finalJokiesGameAccountId, finalJokiesDynamicData, kijoNickname, kijoGameId_val, kijoGameAccountId_val, kijoDynamicData, orderId);

        const sessionId = insert.insertId;
        createdSessionId = sessionId;

        // Store payment transaction
        await db.prepare(`
          INSERT INTO payment_transactions (order_id, session_id, jokies_id, kijo_id, amount, admin_fee, total_amount, payment_status, escrow_status, snap_token, snap_redirect_url, idempotency_key)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'none', ?, ?, ?)
        `).run(orderId, sessionId, jokiesId, kijoId, basePrice, adminFee, totalPrice, snapData.token, snapData.redirect_url, idempotencyKey);

        // Update session with payment_transaction reference
        await db.prepare('UPDATE sessions SET payment_transaction_id = LAST_INSERT_ID() WHERE id = ?').run(sessionId);
      })();

      res.json({
        success: true,
        snapToken: snapData.token,
        snapRedirectUrl: snapData.redirect_url,
        orderId,
        sessionId: createdSessionId,
      });

    } catch (error) {
      console.error('[Payment] Create transaction error:', error);
      res.status(500).json({ success: false, message: 'Gagal membuat transaksi: ' + (error as any)?.message });
    }
  });

  // Midtrans Webhook Notification Handler
  // This endpoint MUST return 200 OK quickly to prevent webhook looping
  app.post('/api/payment/webhook', webhookLimiter, async (req, res) => {
    // Always respond 200 first to prevent Midtrans retry loops
    const body = req.body;
    res.status(200).json({ status: 'OK' });

    try {
      const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, transaction_id, payment_type } = body;

      if (!order_id || !signature_key) {
        console.warn('[Webhook] Missing order_id or signature_key');
        return;
      }

      // 1. Verify signature: SHA512(order_id + status_code + gross_amount + server_key)
      const expectedSignature = crypto
        .createHash('sha512')
        .update(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
        .digest('hex');

      if (signature_key !== expectedSignature) {
        console.error('[Webhook] Signature mismatch for order:', order_id);
        return;
      }

      // 2. Fetch the payment transaction
      const payment = await db.prepare('SELECT * FROM payment_transactions WHERE order_id = ?').get(order_id) as any;
      if (!payment) {
        console.warn('[Webhook] No payment_transaction found for order_id:', order_id);
        return;
      }

      // 3. Idempotency: skip if already processed to a terminal state
      if (['settlement', 'capture', 'deny', 'cancel', 'expire', 'refund'].includes(payment.payment_status) && payment.payment_status !== 'pending') {
        // Allow re-processing: expire -> settlement (late webhook reconciliation), settlement -> refund
        const allowedTransitions: Record<string, string[]> = {
          'expire': ['settlement', 'capture'], // Late payment arrived after auto-cancel
          'settlement': ['refund'],
        };
        const allowed = allowedTransitions[payment.payment_status];
        if (!allowed || !allowed.includes(transaction_status)) {
          console.log('[Webhook] Skipping:', order_id, `${payment.payment_status} -> ${transaction_status}`);
          return;
        }
        console.log('[Webhook] Reconciliation:', order_id, `${payment.payment_status} -> ${transaction_status}`);
      }

      // Store raw notification for audit
      await db.prepare('UPDATE payment_transactions SET raw_notification = ?, midtrans_transaction_id = ?, payment_type = ? WHERE id = ?')
        .run(JSON.stringify(body), transaction_id || null, payment_type || null, payment.id);

      // 4. Process based on transaction_status
      if (transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status === 'accept')) {
        // ── PAYMENT SUCCESS: Activate order, set escrow to HELD ──
        await db.transaction(async () => {
          // Update payment transaction
          await db.prepare(`
            UPDATE payment_transactions SET payment_status = 'settlement', escrow_status = 'held', settled_at = NOW() WHERE id = ?
          `).run(payment.id);

          // Check current session status for reconciliation
          const currentSession = await db.prepare('SELECT status FROM sessions WHERE id = ?').get(payment.session_id) as any;

          if (currentSession?.status === 'pending_payment') {
            // Normal flow: pending_payment -> upcoming
            await db.prepare(`
              UPDATE sessions SET status = 'upcoming', escrow_status = 'held', payment_method = ? WHERE id = ? AND status = 'pending_payment'
            `).run(payment_type || 'Midtrans', payment.session_id);
          } else if (currentSession?.status === 'cancelled') {
            // Re-activate: session was auto-cancelled but payment actually succeeded (late webhook)
            await db.prepare(`
              UPDATE sessions SET status = 'upcoming', escrow_status = 'held', payment_method = ?, cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL WHERE id = ?
            `).run(payment_type || 'Midtrans', payment.session_id);
            console.log('[Webhook] Re-activated cancelled session:', payment.session_id, '— late settlement for order:', order_id);
          }
          // If session is already 'upcoming' or beyond, skip (idempotent)

          // Notify Kijo about new order
          const session = await db.prepare('SELECT title, customer_name FROM sessions WHERE id = ?').get(payment.session_id) as any;
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            payment.kijo_id, 'order_new', 'Pesanan Baru!',
            `Anda menerima pesanan baru: ${session?.title || 'Pesanan'}. ID Pesanan: #${payment.session_id}`
          );

          // Notify Jokies payment success
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            payment.jokies_id, 'system', 'Pembayaran Berhasil!',
            `Pembayaran untuk pesanan #${payment.session_id} sebesar Rp ${payment.total_amount.toLocaleString()} berhasil. Dana ditahan dalam Escrow.`
          );

          // Notify admins
          const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as any[];
          for (const admin of admins) {
            await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
              admin.id, 'system', 'Pembayaran Masuk',
              `Pembayaran Midtrans untuk pesanan #${payment.session_id} berhasil. Total: Rp ${payment.total_amount.toLocaleString()}. Escrow: HELD.`
            );
          }
        })();

        io.to('admin-room').emit('admin-refresh');
        console.log('[Webhook] Settlement processed for order:', order_id);

      } else if (['deny', 'cancel', 'expire'].includes(transaction_status)) {
        // ── PAYMENT FAILED/EXPIRED: Cancel the pending session ──
        await db.transaction(async () => {
          await db.prepare(`UPDATE payment_transactions SET payment_status = ? WHERE id = ?`).run(transaction_status, payment.id);

          // Cancel the pending_payment session
          await db.prepare(`
            UPDATE sessions SET status = 'cancelled', cancelled_by = 'system', cancellation_reason = ?, cancelled_at = NOW() WHERE id = ? AND status = 'pending_payment'
          `).run(`Pembayaran ${transaction_status}`, payment.session_id);

          // Notify jokies
          const statusLabel = transaction_status === 'expire' ? 'kedaluwarsa' : (transaction_status === 'deny' ? 'ditolak' : 'dibatalkan');
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            payment.jokies_id, 'system', 'Pembayaran Gagal',
            `Pembayaran untuk pesanan #${payment.session_id} ${statusLabel}. Silakan coba lagi.`
          );
        })();

        io.to('admin-room').emit('admin-refresh');
        console.log('[Webhook] Payment failed/expired for order:', order_id, transaction_status);

      } else if (transaction_status === 'pending') {
        // Payment is still pending (e.g. waiting for bank transfer)
        await db.prepare(`UPDATE payment_transactions SET payment_status = 'pending' WHERE id = ?`).run(payment.id);
        console.log('[Webhook] Payment pending for order:', order_id);
      }

    } catch (error) {
      console.error('[Webhook] Error processing notification:', error);
    }
  });

  // Check payment status
  app.get('/api/payment/status/:orderId', requireAuth, paymentLimiter, async (req: any, res: any) => {
    const { orderId } = req.params;
    try {
      const payment = await db.prepare(
        'SELECT order_id, payment_status, escrow_status, session_id, total_amount, payment_type, settled_at FROM payment_transactions WHERE order_id = ?'
      ).get(orderId) as any;

      if (!payment) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

      // Optionally verify with Midtrans API for real-time status
      if (payment.payment_status === 'pending' && MIDTRANS_SERVER_KEY) {
        try {
          const authString = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');
          const mtRes = await fetch(`${MIDTRANS_API_URL}/${orderId}/status`, {
            headers: { 'Authorization': `Basic ${authString}` },
          });
          if (mtRes.ok) {
            const mtData = await mtRes.json() as any;
            payment.midtrans_status = mtData.transaction_status;
          }
        } catch (err) {
          console.warn('[Payment] Could not check Midtrans status:', err);
        }
      }

      res.json({ success: true, payment });
    } catch (error) {
      console.error('[Payment] Status check error:', error);
      res.status(500).json({ success: false });
    }
  });

  // Resume payment: return snap token for a pending_payment session so user can re-open Snap popup
  app.get('/api/payment/resume/:sessionId', requireAuth, paymentLimiter, async (req: any, res: any) => {
    const userId = req.user.userId;
    const { sessionId } = req.params;
    try {
      const session = await db.prepare("SELECT id, jokies_id, status, created_at FROM sessions WHERE id = ? AND status = 'pending_payment'").get(sessionId) as any;
      if (!session) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan atau sudah tidak menunggu pembayaran.' });
      if (session.jokies_id !== userId) return res.status(403).json({ success: false, message: 'Anda bukan pemilik pesanan ini.' });

      // Check if payment has expired (15 min display window — user sees this)
      const createdAt = new Date(session.created_at).getTime();
      if (Date.now() - createdAt > PAYMENT_DISPLAY_TIMEOUT_MS) {
        return res.status(410).json({ success: false, message: 'Waktu pembayaran telah habis. Pesanan akan dibatalkan otomatis.' });
      }

      const payment = await db.prepare("SELECT snap_token, snap_redirect_url, order_id FROM payment_transactions WHERE session_id = ? AND payment_status = 'pending'").get(sessionId) as any;
      if (!payment || !payment.snap_token) {
        return res.status(404).json({ success: false, message: 'Token pembayaran tidak ditemukan.' });
      }

      const remainingMs = PAYMENT_DISPLAY_TIMEOUT_MS - (Date.now() - createdAt);
      res.json({
        success: true,
        snapToken: payment.snap_token,
        snapRedirectUrl: payment.snap_redirect_url,
        orderId: payment.order_id,
        remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
      });
    } catch (error) {
      console.error('[Payment] Resume error:', error);
      res.status(500).json({ success: false });
    }
  });

  // Verify payment: actively check Midtrans API and sync session status
  // Called by frontend after Snap onSuccess to ensure order moves to 'upcoming'
  app.post('/api/payment/verify/:sessionId', requireAuth, paymentLimiter, async (req: any, res: any) => {
    const userId = req.user.userId;
    const { sessionId } = req.params;
    try {
      const payment = await db.prepare(
        'SELECT * FROM payment_transactions WHERE session_id = ?'
      ).get(sessionId) as any;
      if (!payment) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

      // Security: only the jokies who owns the order can verify
      if (payment.jokies_id !== userId) return res.status(403).json({ success: false, message: 'Akses ditolak.' });

      // If already settled, return success immediately
      if (payment.payment_status === 'settlement') {
        return res.json({ success: true, status: 'settlement', message: 'Pembayaran sudah dikonfirmasi.' });
      }

      // If not pending or expire, nothing to verify
      if (payment.payment_status !== 'pending' && payment.payment_status !== 'expire') {
        return res.json({ success: false, status: payment.payment_status, message: `Status pembayaran: ${payment.payment_status}` });
      }

      // Query Midtrans API for real-time status
      if (!MIDTRANS_SERVER_KEY) {
        return res.status(500).json({ success: false, message: 'Server key tidak dikonfigurasi.' });
      }

      const authString = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');
      const mtRes = await fetch(`${MIDTRANS_API_URL}/${payment.order_id}/status`, {
        headers: { 'Authorization': `Basic ${authString}`, 'Content-Type': 'application/json' },
      });

      if (!mtRes.ok) {
        console.warn('[Verify] Midtrans API error:', mtRes.status);
        return res.json({ success: false, status: 'pending', message: 'Menunggu konfirmasi dari Midtrans. Coba lagi dalam beberapa saat.' });
      }

      const mtData = await mtRes.json() as any;
      const txnStatus = mtData.transaction_status;
      const fraudStatus = mtData.fraud_status;

      if (txnStatus === 'settlement' || (txnStatus === 'capture' && fraudStatus === 'accept')) {
        // Payment confirmed by Midtrans — run settlement + reconciliation logic
        await db.transaction(async () => {
          await db.prepare(`
            UPDATE payment_transactions SET payment_status = 'settlement', escrow_status = 'held', settled_at = NOW(), payment_type = ?, midtrans_transaction_id = ?, raw_notification = ? WHERE id = ?
          `).run(mtData.payment_type || 'Midtrans', mtData.transaction_id || null, JSON.stringify(mtData), payment.id);

          // Check current session status for reconciliation
          const currentSession = await db.prepare('SELECT status FROM sessions WHERE id = ?').get(payment.session_id) as any;

          if (currentSession?.status === 'pending_payment') {
            await db.prepare(`
              UPDATE sessions SET status = 'upcoming', escrow_status = 'held', payment_method = ? WHERE id = ? AND status = 'pending_payment'
            `).run(mtData.payment_type || 'Midtrans', payment.session_id);
          } else if (currentSession?.status === 'cancelled') {
            // Re-activate: was auto-cancelled but payment actually succeeded
            await db.prepare(`
              UPDATE sessions SET status = 'upcoming', escrow_status = 'held', payment_method = ?, cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL WHERE id = ?
            `).run(mtData.payment_type || 'Midtrans', payment.session_id);
            console.log('[Verify] Re-activated cancelled session:', payment.session_id);
          }

          const session = await db.prepare('SELECT title FROM sessions WHERE id = ?').get(payment.session_id) as any;
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            payment.kijo_id, 'order_new', 'Pesanan Baru!',
            `Anda menerima pesanan baru: ${session?.title || 'Pesanan'}. ID Pesanan: #${payment.session_id}`
          );
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            payment.jokies_id, 'system', 'Pembayaran Berhasil!',
            `Pembayaran untuk pesanan #${payment.session_id} sebesar Rp ${payment.total_amount.toLocaleString()} berhasil. Dana ditahan dalam Escrow.`
          );
        })();

        io.to('admin-room').emit('admin-refresh');
        console.log('[Verify] Settlement confirmed via API for session:', sessionId);
        return res.json({ success: true, status: 'settlement', message: 'Pembayaran berhasil dikonfirmasi!' });
      } else if (['deny', 'cancel', 'expire'].includes(txnStatus)) {
        // Payment failed — cancel session
        await db.transaction(async () => {
          await db.prepare('UPDATE payment_transactions SET payment_status = ? WHERE id = ?').run(txnStatus, payment.id);
          await db.prepare("UPDATE sessions SET status = 'cancelled', cancelled_by = 'system', cancellation_reason = ?, cancelled_at = NOW() WHERE id = ? AND status = 'pending_payment'")
            .run(`Pembayaran ${txnStatus}`, payment.session_id);
        })();

        return res.json({ success: false, status: txnStatus, message: `Pembayaran ${txnStatus}.` });
      } else {
        // Still pending
        return res.json({ success: false, status: 'pending', message: 'Pembayaran masih diproses. Coba lagi dalam beberapa saat.' });
      }
    } catch (error) {
      console.error('[Verify] Error:', error);
      res.status(500).json({ success: false, message: 'Gagal memverifikasi pembayaran.' });
    }
  });

  // API: Cancel Order (Jokies or Kijo) - Now sends to Admin for verification
  app.post('/api/orders/cancel', requireAuth, async (req: any, res: any) => {
    const authUserId = req.user.userId;
    const authRole = req.user.role;
    const { orderId, reason } = req.body;
    try {
      const order = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(orderId) as any;
      if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });

      // Determine the caller's relationship to this order using JWT identity
      let callerRole: string;
      if (order.jokies_id === authUserId) callerRole = 'jokies';
      else if (order.user_id === authUserId) callerRole = 'kijo';
      else if (authRole === 'admin') callerRole = 'admin';
      else return res.status(403).json({ success: false, message: 'Anda bukan peserta pesanan ini' });

      if (order.status !== 'upcoming' && order.status !== 'ongoing' && order.status !== 'pending_completion') {
        return res.status(400).json({ success: false, message: 'Pesanan tidak dapat dibatalkan pada status ini' });
      }

      if (!reason) return res.status(400).json({ success: false, message: 'Alasan pembatalan wajib diisi' });

      // Admin can force-cancel via their own endpoint; this is for Kijo/Jokies
      if (callerRole === 'admin') {
        // Admin uses force-cancel endpoint instead
        return res.status(400).json({ success: false, message: 'Admin gunakan endpoint force-cancel.' });
      }

      // Jokies auto-cancel: 1+ hour before scheduled_at, no agreement needed
      if (callerRole === 'jokies' && order.status === 'upcoming') {
        const scheduledAt = new Date(order.scheduled_at).getTime();
        const now = Date.now();
        const diffMinutes = (scheduledAt - now) / (1000 * 60);

        if (diffMinutes >= 60) {
          // Auto-cancel with partial refund (admin fee lost) — Jokies cancel
          await db.transaction(async () => {
            await db.prepare("UPDATE sessions SET status = 'cancelled', escrow_status = 'partial_refund', cancellation_reason = ?, cancelled_at = NOW(), cancelled_by = 'jokies' WHERE id = ?").run(reason, orderId);
            // Partial refund: price only (admin fee retained by admin)
            if (order.payment_method !== 'Simulasi') {
              await db.prepare('UPDATE users SET wallet_jokies = wallet_jokies + ? WHERE id = ?').run(order.price, order.jokies_id);
            }
            // Update escrow in payment_transactions if exists
            if (order.payment_transaction_id) {
              await db.prepare("UPDATE payment_transactions SET escrow_status = 'partial_refund', refund_amount = ?, refund_reason = ?, refunded_by = 'jokies', refunded_at = NOW() WHERE id = ?")
                .run(order.price, reason, order.payment_transaction_id);
            }
            // Set jokies lock (1 hour)
            await db.prepare("UPDATE users SET jokies_lock_until = DATE_ADD(NOW(), INTERVAL 60 MINUTE) WHERE id = ?").run(order.jokies_id);
            // Notify Kijo
            await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
              order.user_id, 'system', 'Pesanan Dibatalkan',
              `Pesanan #${orderId} telah dibatalkan oleh pelanggan. Alasan: ${reason}`
            );
            // Notify Jokies
            await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
              order.jokies_id, 'system', 'Pembatalan Berhasil',
              `Pesanan #${orderId} berhasil dibatalkan. Refund Rp ${order.price.toLocaleString()} (biaya admin tidak dikembalikan) telah dikembalikan ke wallet.`
            );
          })();
          io.to('admin-room').emit('admin-refresh');
          return res.json({ success: true, message: 'Pesanan berhasil dibatalkan. Refund (tanpa biaya admin) telah dikembalikan ke wallet.' });
        }
      }

      // Peer agreement required: set to pending_cancellation
      await db.prepare("UPDATE sessions SET status = 'pending_cancellation', cancellation_reason = ?, cancelled_at = NOW(), cancelled_by = ? WHERE id = ?").run(reason, callerRole, orderId);

      // Notify the OTHER party to agree or reject
      const otherUserId = callerRole === 'jokies' ? order.user_id : order.jokies_id;
      const callerLabel = callerRole === 'jokies' ? 'Pelanggan' : 'Partner';
      await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
        otherUserId, 'system', 'Permintaan Pembatalan',
        `${callerLabel} mengajukan pembatalan pesanan #${orderId}. Silakan setujui atau tolak pembatalan.`
      );

      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true, message: 'Permintaan pembatalan telah dikirim. Menunggu persetujuan pihak lain.' });
    } catch (error) {
      console.error('Cancel Order Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Agree to Cancel (peer agreement)
  app.post('/api/orders/agree-cancel', requireAuth, async (req: any, res: any) => {
    const authUserId = req.user.userId;
    const { orderId } = req.body;
    try {
      const order = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(orderId) as any;
      if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      if (order.status !== 'pending_cancellation') {
        return res.status(400).json({ success: false, message: 'Pesanan tidak dalam status menunggu pembatalan' });
      }

      // Verify caller is the OTHER party (not the initiator)
      const isJokies = order.jokies_id === authUserId;
      const isKijo = order.user_id === authUserId;
      if (!isJokies && !isKijo) return res.status(403).json({ success: false, message: 'Anda bukan peserta pesanan ini' });
      if (order.cancelled_by === 'jokies' && isJokies) return res.status(400).json({ success: false, message: 'Anda yang mengajukan pembatalan, tunggu persetujuan pihak lain.' });
      if (order.cancelled_by === 'kijo' && isKijo) return res.status(400).json({ success: false, message: 'Anda yang mengajukan pembatalan, tunggu persetujuan pihak lain.' });

      await db.transaction(async () => {
        const escrowLabel = order.cancelled_by === 'jokies' ? 'partial_refund' : 'refunded';
        await db.prepare("UPDATE sessions SET status = 'cancelled', escrow_status = ? WHERE id = ?").run(escrowLabel, orderId);

        // Refund logic: Jokies cancel = partial (price only), Kijo cancel = full (total_price)
        if (order.payment_method !== 'Simulasi') {
          const refundAmount = order.cancelled_by === 'jokies' ? order.price : order.total_price;
          await db.prepare('UPDATE users SET wallet_jokies = wallet_jokies + ? WHERE id = ?').run(refundAmount, order.jokies_id);
        }

        // Update payment_transactions escrow
        if (order.payment_transaction_id) {
          const refundAmount = order.cancelled_by === 'jokies' ? order.price : order.total_price;
          await db.prepare("UPDATE payment_transactions SET escrow_status = ?, refund_amount = ?, refunded_by = ?, refunded_at = NOW() WHERE id = ?")
            .run(escrowLabel, refundAmount, order.cancelled_by, order.payment_transaction_id);
        }

        // Set jokies lock if jokies initiated
        if (order.cancelled_by === 'jokies') {
          await db.prepare("UPDATE users SET jokies_lock_until = DATE_ADD(NOW(), INTERVAL 60 MINUTE) WHERE id = ?").run(order.jokies_id);
        }

        const refundLabel = order.cancelled_by === 'jokies'
          ? `Refund Rp ${order.price.toLocaleString()} (biaya admin tidak dikembalikan)`
          : `Refund penuh Rp ${order.total_price.toLocaleString()}`;

        // Notify both
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          order.jokies_id, 'system', 'Pembatalan Disetujui',
          `Pembatalan pesanan #${orderId} telah disetujui. ${refundLabel} telah dikembalikan ke wallet.`
        );
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          order.user_id, 'system', 'Pembatalan Disetujui',
          `Pembatalan pesanan #${orderId} telah disetujui oleh kedua belah pihak.`
        );
      })();

      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true, message: 'Pembatalan disetujui.' });
    } catch (error) {
      console.error('Agree Cancel Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Reject Cancel (escalate to admin)
  app.post('/api/orders/reject-cancel', requireAuth, async (req: any, res: any) => {
    const authUserId = req.user.userId;
    const { orderId } = req.body;
    try {
      const order = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(orderId) as any;
      if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      if (order.status !== 'pending_cancellation') {
        return res.status(400).json({ success: false, message: 'Pesanan tidak dalam status menunggu pembatalan' });
      }

      // Verify caller is the OTHER party
      const isJokies = order.jokies_id === authUserId;
      const isKijo = order.user_id === authUserId;
      if (!isJokies && !isKijo) return res.status(403).json({ success: false, message: 'Anda bukan peserta pesanan ini' });
      if (order.cancelled_by === 'jokies' && isJokies) return res.status(400).json({ success: false, message: 'Anda yang mengajukan pembatalan.' });
      if (order.cancelled_by === 'kijo' && isKijo) return res.status(400).json({ success: false, message: 'Anda yang mengajukan pembatalan.' });

      // Escalate to admin
      await db.prepare("UPDATE sessions SET cancel_escalated = 1 WHERE id = ?").run(orderId);

      const rejectorLabel = isJokies ? 'Pelanggan' : 'Partner';
      // Notify both parties
      await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
        order.jokies_id, 'system', 'Pembatalan Ditolak',
        `${rejectorLabel} menolak pembatalan pesanan #${orderId}. Masalah dieskalasi ke Admin untuk keputusan akhir.`
      );
      await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
        order.user_id, 'system', 'Pembatalan Ditolak',
        `${rejectorLabel} menolak pembatalan pesanan #${orderId}. Masalah dieskalasi ke Admin untuk keputusan akhir.`
      );
      // Notify admin
      const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as any[];
      for (const admin of admins) {
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          admin.id, 'system', 'Sengketa Baru',
          `Pembatalan pesanan #${orderId} ditolak oleh ${rejectorLabel}. Perlu keputusan Admin.`
        );
      }

      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true, message: 'Pembatalan ditolak. Masalah akan dieskalasi ke Admin.' });
    } catch (error) {
      console.error('Reject Cancel Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Revert Cancellation (cancel-the-cancel)
  app.post('/api/orders/revert-cancel', requireAuth, async (req: any, res: any) => {
    const authUserId = req.user.userId;
    const { orderId } = req.body;
    try {
      const order = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(orderId) as any;
      if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      if (order.status !== 'pending_cancellation') {
        return res.status(400).json({ success: false, message: 'Pesanan tidak dalam status menunggu pembatalan' });
      }
      // Only the initiator can revert, and only before escalation
      const isJokies = order.jokies_id === authUserId;
      const isKijo = order.user_id === authUserId;
      if (!isJokies && !isKijo) return res.status(403).json({ success: false, message: 'Anda bukan peserta pesanan ini' });
      if (order.cancelled_by === 'jokies' && !isJokies) return res.status(400).json({ success: false, message: 'Hanya pihak yang mengajukan yang bisa membatalkan permintaan ini.' });
      if (order.cancelled_by === 'kijo' && !isKijo) return res.status(400).json({ success: false, message: 'Hanya pihak yang mengajukan yang bisa membatalkan permintaan ini.' });
      if (order.cancel_escalated) return res.status(400).json({ success: false, message: 'Tidak bisa membatalkan, sudah dieskalasi ke Admin.' });

      // Restore to previous status
      const restoreStatus = order.started_at ? 'ongoing' : 'upcoming';
      await db.prepare("UPDATE sessions SET status = ?, cancelled_by = NULL, cancellation_reason = NULL, cancelled_at = NULL, cancel_escalated = 0 WHERE id = ?").run(restoreStatus, orderId);

      const otherUserId = isJokies ? order.user_id : order.jokies_id;
      const callerLabel = isJokies ? 'Pelanggan' : 'Partner';
      await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
        otherUserId, 'system', 'Pembatalan Dibatalkan',
        `${callerLabel} membatalkan permintaan pembatalan pesanan #${orderId}. Pesanan dilanjutkan.`
      );

      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true, message: 'Permintaan pembatalan berhasil dibatalkan. Pesanan dilanjutkan.' });
    } catch (error) {
      console.error('Revert Cancel Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Admin Approve Cancellation (for escalated disputes)
  app.post('/api/admin/sessions/:id/approve-cancel', requireAuth, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    try {
      const order = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
      if (!order) return res.status(404).json({ success: false });

      await db.transaction(async () => {
        const escrowLabel = order.cancelled_by === 'jokies' ? 'partial_refund' : 'refunded';
        await db.prepare("UPDATE sessions SET status = 'cancelled', escrow_status = ?, cancel_escalated = 0 WHERE id = ?").run(escrowLabel, id);

        // Refund logic: jokies cancel = partial, kijo/admin cancel = full
        if (order.payment_method !== 'Simulasi') {
          if (order.cancelled_by === 'jokies') {
            await db.prepare('UPDATE users SET wallet_jokies = wallet_jokies + ? WHERE id = ?').run(order.price, order.jokies_id);
          } else {
            await db.prepare('UPDATE users SET wallet_jokies = wallet_jokies + ? WHERE id = ?').run(order.total_price, order.jokies_id);
          }
        }

        // Update escrow in payment_transactions
        if (order.payment_transaction_id) {
          const refundAmount = order.cancelled_by === 'jokies' ? order.price : order.total_price;
          await db.prepare("UPDATE payment_transactions SET escrow_status = ?, refund_amount = ?, refunded_by = ?, refunded_at = NOW() WHERE id = ?")
            .run(escrowLabel, refundAmount, order.cancelled_by || 'admin', order.payment_transaction_id);
        }

        // Notify both
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          order.jokies_id, 'system', 'Pembatalan Disetujui', `Admin telah menyetujui pembatalan pesanan #${id}.`
        );
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          order.user_id, 'system', 'Pembatalan Disetujui', `Admin telah menyetujui pembatalan pesanan #${id}.`
        );
      })();
      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false });
    }
  });

  // API: Jokies Withdrawal
  app.post('/api/jokies/withdraw', (req, res) => {
    const { userId, amount, destination } = req.body;
    try {
      if (amount < 20000) {
        return res.status(400).json({ success: false, message: 'Minimal penarikan adalah Rp 20.000' });
      }
      const user = db.prepare('SELECT wallet_jokies, last_refund_at FROM users WHERE id = ?').get(userId) as any;
      
      if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

      if (user.wallet_jokies < amount) {
        return res.status(400).json({ success: false, message: 'Saldo tidak mencukupi' });
      }

      // 7-day rule check
      let finalAmount = amount;
      let feeNote = '';
      if (user.last_refund_at) {
        const lastRefund = new Date(user.last_refund_at);
        const diffDays = (new Date().getTime() - lastRefund.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays < 7) {
          // Under 7 days, user bears the transfer fee (e.g., Rp 6.500)
          const transferFee = 6500;
          if (amount <= transferFee) {
            return res.status(400).json({ success: false, message: 'Jumlah penarikan terlalu kecil untuk menutupi biaya transfer (Rp 6.500)' });
          }
          finalAmount = amount - transferFee;
          feeNote = ' (Dipotong biaya transfer Rp 6.500 karena penarikan < 7 hari)';
        }
      }

      db.transaction(() => {
        db.prepare('UPDATE users SET wallet_jokies = wallet_jokies - ? WHERE id = ?').run(amount, userId);
        db.prepare('INSERT INTO withdrawals (user_id, amount, destination, status) VALUES (?, ?, ?, ?)')
          .run(userId, amount, destination, 'pending');
        db.prepare('INSERT INTO transactions (user_id, type, amount, description, status) VALUES (?, ?, ?, ?, ?)')
          .run(userId, 'withdrawal', amount, `Penarikan Refund ke ${destination}${feeNote}`, 'pending');
      })();

      res.json({ success: true });
    } catch (error) {
      console.error('Jokies Withdraw Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Kijo Marks Order as Finished - requires proofs already uploaded + 15 min since started_at
  app.post('/api/kijo/finish-order', requireAuth, async (req: any, res: any) => {
    const kijoId = req.user.userId;
    const { orderId } = req.body;
    try {
      const order = await db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(orderId, kijoId) as any;
      if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      if (order.status !== 'ongoing') return res.status(400).json({ success: false, message: 'Pesanan harus berstatus sedang berjalan.' });

      // Check 15 min elapsed since started_at
      if (order.started_at) {
        const startedAt = new Date(order.started_at).getTime();
        const diffMinutes = (Date.now() - startedAt) / (1000 * 60);
        if (diffMinutes < 15) {
          return res.status(403).json({ success: false, message: 'Pesanan minimal harus berjalan selama 15 menit sebelum diselesaikan.' });
        }
      }

      // Check both proofs are uploaded
      if (!order.screenshot_start || !order.screenshot_end) {
        return res.status(400).json({ success: false, message: 'Wajib mengunggah bukti pengerjaan Sebelum & Sesudah sebelum menyelesaikan pesanan.' });
      }

      await db.prepare("UPDATE sessions SET kijo_finished = 1, status = 'pending_completion' WHERE id = ?").run(orderId);

      await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
        order.jokies_id,
        'order_update',
        'Pesanan Selesai (Menunggu Konfirmasi)',
        `Partner telah menyelesaikan pesanan #${orderId}. Konfirmasi untuk menyelesaikan pesanan dan mencairkan dana.`
      );

      res.json({ success: true, message: 'Pesanan telah ditandai selesai. Menunggu konfirmasi pelanggan.' });
    } catch (error) {
      console.error('[finish-order]', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Admin Approve Completion
  app.post('/api/admin/sessions/:id/approve-complete', async (req, res) => {
    const { id } = req.params;
    try {
      const order = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
      if (!order) return res.status(404).json({ success: false });

      await db.transaction(async () => {
        await db.prepare("UPDATE sessions SET status = 'completed', escrow_status = 'released', completed_at = NOW() WHERE id = ?").run(id);

        // Release escrow: Transfer funds to Kijo balance_active
        await db.prepare('UPDATE users SET balance_active = balance_active + ? WHERE id = ?').run(order.price, order.user_id);

        // Update payment_transactions escrow -> released
        if (order.payment_transaction_id) {
          await db.prepare("UPDATE payment_transactions SET escrow_status = 'released', released_at = NOW() WHERE id = ?").run(order.payment_transaction_id);
        }

        // Set Break Time
        const breakUntil = await calculateBreakUntil(order.user_id);
        if (breakUntil) {
          await db.prepare('UPDATE users SET break_until = ? WHERE id = ?').run(breakUntil, order.user_id);
        }

        // Notify both
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          order.user_id, 'order_completed', 'Verifikasi Selesai & Dana Cair!', `Admin telah memverifikasi pesanan #${id}. Saldo Rp ${order.price.toLocaleString()} telah ditambahkan ke Saldo Aktif.`
        );
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          order.jokies_id, 'order_completed', 'Pesanan Selesai', `Admin telah memverifikasi penyelesaian pesanan #${id}.`
        );
      })();
      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false });
    }
  });

  // API: Jokies Confirms/Completes Order
  // Jokies can finish from 'ongoing' (direct) or 'pending_completion' (after Kijo requested).
  // Jokies is the authority — no kijo_finished requirement.
  app.post('/api/jokies/confirm-finish', requireAuth, async (req: any, res: any) => {
    const jokiesId = req.user.userId;
    const { orderId } = req.body;
    try {
      const order = await db.prepare('SELECT * FROM sessions WHERE id = ? AND jokies_id = ?').get(orderId, jokiesId) as any;
      if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      if (order.status === 'completed') {
        return res.status(400).json({ success: false, message: 'Pesanan sudah selesai' });
      }
      // Valid statuses: ongoing (direct finish by Jokies) or pending_completion (Kijo already requested)
      if (!['ongoing', 'pending_completion'].includes(order.status)) {
        return res.status(400).json({ success: false, message: 'Pesanan tidak dalam status yang valid untuk diselesaikan' });
      }

      await db.transaction(async () => {
        await db.prepare("UPDATE sessions SET jokies_finished = 1, status = 'completed', escrow_status = 'released', completed_at = NOW() WHERE id = ?").run(orderId);
        
        // Release escrow: Transfer funds to Kijo balance_active
        await db.prepare('UPDATE users SET balance_active = balance_active + ? WHERE id = ?').run(order.price, order.user_id);

        // Update payment_transactions escrow -> released
        if (order.payment_transaction_id) {
          await db.prepare("UPDATE payment_transactions SET escrow_status = 'released', released_at = NOW() WHERE id = ?").run(order.payment_transaction_id);
        }
        
        // Set Break Time
        const breakUntil = await calculateBreakUntil(order.user_id);
        if (breakUntil) {
          await db.prepare('UPDATE users SET break_until = ? WHERE id = ?').run(breakUntil, order.user_id);
        }

        // Add notification for Kijo
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          order.user_id,
          'order_completed',
          'Pesanan Selesai & Dana Cair!',
          `Pelanggan telah mengonfirmasi penyelesaian pesanan #${orderId}. Saldo Rp ${order.price.toLocaleString()} telah ditambahkan ke saldo aktif Anda.`
        );
      })();

      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Update Phone Number
  app.post('/api/users/:id/phone', async (req, res) => {
    const { id } = req.params;
    const { phone } = req.body;
    try {
      await db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ success: false, message: 'Nomor telepon sudah digunakan' });
      } else {
        res.status(500).json({ success: false, message: 'Gagal memperbarui nomor telepon' });
      }
    }
  });

  // API: Get Etalase (Categories & Packages)
  app.get('/api/kijo/etalase/:userId', async (req, res) => {
    const { userId } = req.params;
    const categories = (await db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY game_name ASC, name ASC').all(userId)) as any[];
    
    const etalase = await Promise.all(categories.map(async (cat, catIdx) => {
      const packages = (await db.prepare('SELECT * FROM packages WHERE category_id = ? AND deleted = 0').all(cat.id)) as any[];
      const packagesWithSlot = packages.map((pkg, pkgIdx) => ({
        ...pkg,
        slot_id: `${catIdx + 1}-${pkgIdx + 1}`
      }));
      return { 
        ...cat, 
        slot_id: (catIdx + 1).toString(),
        packages: packagesWithSlot 
      };
    }));

    res.json(etalase);
  });

  // API: Add Category
  app.post('/api/kijo/categories', requireAuth, async (req, res) => {
    const { userId, name, game_name, game_account_id, rank } = req.body;
    if (String((req as any).user.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      // Verify user exists first
      const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Validate game_account_id references a non-deleted boosting account owned by this user
      if (game_account_id) {
        const acct = await db.prepare(`SELECT id FROM game_accounts WHERE id = ? AND user_id = ? AND deleted = 0 AND account_type = 'boosting'`).get(game_account_id, userId);
        if (!acct) {
          return res.status(400).json({ success: false, message: 'Akun boosting tidak valid atau sudah dihapus' });
        }
      }

      await db.transaction(async () => {
        await db.prepare('INSERT INTO categories (user_id, name, game_name, game_account_id, rank) VALUES (?, ?, ?, ?, ?)').run(userId, name, game_name, game_account_id, rank || null);
        await db.prepare('UPDATE users SET has_kijo_profile = 1 WHERE id = ?').run(userId);
      })();
      res.json({ success: true });
    } catch (error: any) {
      console.error('Add Category Error:', error);
      res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
  });

  // API: Update Category
  app.post('/api/kijo/categories/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, game_name, game_account_id, rank } = req.body;
    const userId = (req as any).user.userId;
    try {
      const cat = await db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
      if (!cat) return res.status(403).json({ success: false, message: 'Tidak diizinkan' });

      if (game_account_id) {
        const acct = await db.prepare(`SELECT id FROM game_accounts WHERE id = ? AND user_id = ? AND deleted = 0 AND account_type = 'boosting'`).get(game_account_id, userId);
        if (!acct) return res.status(400).json({ success: false, message: 'Akun boosting tidak valid' });
        // Re-link to a valid account: restore category visibility
        await db.prepare('UPDATE categories SET name = ?, game_name = ?, game_account_id = ?, rank = ?, visible = 1 WHERE id = ?').run(name, game_name, game_account_id, rank || null, id);
      } else {
        await db.prepare('UPDATE categories SET name = ?, game_name = ?, game_account_id = ?, rank = ? WHERE id = ?').run(name, game_name, game_account_id || null, rank || null, id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Add Package
  app.post('/api/kijo/packages', async (req, res) => {
    const { categoryId, name, price, duration, package_type, player_count, min_players, max_players, is_bundle, bundle_start, bundle_end, rank, is_recurring, recurring_extra_duration, recurring_every_quantity, criteria } = req.body;
    try {
      await db.prepare('INSERT INTO packages (category_id, name, price, duration, package_type, player_count, min_players, max_players, is_bundle, bundle_start, bundle_end, rank, is_recurring, recurring_extra_duration, recurring_every_quantity, criteria) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(categoryId, name, price, duration, package_type || 'SOLO', player_count || 2, min_players || 2, max_players || 4, is_bundle || 0, bundle_start || null, bundle_end || null, rank || null, is_recurring || 0, recurring_extra_duration || 0, recurring_every_quantity || 1, criteria || null);
      res.json({ success: true });
    } catch (error) {
      console.error('Add Package Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Update Package
  app.post('/api/kijo/packages/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price, duration, package_type, player_count, min_players, max_players, is_bundle, bundle_start, bundle_end, rank, is_recurring, recurring_extra_duration, recurring_every_quantity, criteria } = req.body;
    try {
      await db.prepare('UPDATE packages SET name = ?, price = ?, duration = ?, package_type = ?, player_count = ?, min_players = ?, max_players = ?, is_bundle = ?, bundle_start = ?, bundle_end = ?, rank = ?, is_recurring = ?, recurring_extra_duration = ?, recurring_every_quantity = ?, criteria = ? WHERE id = ?').run(name, price, duration, package_type || 'SOLO', player_count || 2, min_players || 2, max_players || 4, is_bundle || 0, bundle_start || null, bundle_end || null, rank || null, is_recurring || 0, recurring_extra_duration || 0, recurring_every_quantity || 1, criteria || null, id);
      res.json({ success: true });
    } catch (error) {
      console.error('Update Package Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Delete Category (Smart Delete with Renaming)
  app.delete('/api/kijo/categories/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID tidak valid' });

    try {
      const deleteTx = db.transaction(async (catId: number) => {
        const category = await db.prepare('SELECT * FROM categories WHERE id = ?').get(catId) as any;
        if (!category) return 0;
        if (String(category.user_id) !== String((req as any).user.userId)) return 0;

        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // Get all packages in this category
        const packages = await db.prepare('SELECT * FROM packages WHERE category_id = ?').all(catId) as any[];

        // Check category history BEFORE processing packages (since we detach them)
        let categoryHasHistory = false;
        for (const pkg of packages) {
          const ordered = await db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND title = ?').get(category.user_id, pkg.name) as { count: number };
          if (ordered && ordered.count > 0) {
            categoryHasHistory = true;
          }
        }

        // Now process each package
        for (const pkg of packages) {
          const ordered = await db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND title = ?').get(category.user_id, pkg.name) as { count: number };

          if (ordered && ordered.count > 0) {
            const archivedName = `${pkg.name}_archived_${timestamp}`;
            await db.prepare('UPDATE packages SET name = ?, deleted = 1, category_id = NULL WHERE id = ?').run(archivedName, pkg.id);
          } else {
            await db.prepare('DELETE FROM packages WHERE id = ?').run(pkg.id);
          }
        }

        if (categoryHasHistory) {
          const archivedCatName = `${category.name}_archived_${timestamp}`;
          await db.prepare('UPDATE categories SET name = ?, deleted = 1 WHERE id = ?').run(archivedCatName, catId);
          return 1;
        } else {
          const result = await db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
          return (result as any).affectedRows;
        }
      });

      const changes = await deleteTx(id);
      if (changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Kategori tidak ditemukan atau sudah terhapus' });
      }
    } catch (error: any) {
      console.error('Delete Category Error:', error);
      res.status(500).json({ success: false, message: error.message || 'Gagal menghapus kategori' });
    }
  });

  // API: Clear All Packages in Category (Smart Delete with Renaming)
  app.delete('/api/kijo/categories/:id/packages', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
      const clearTx = db.transaction(async (catId: number) => {
        const category = (await db.prepare('SELECT user_id FROM categories WHERE id = ?').get(catId)) as { user_id: number };
        if (!category) throw new Error('Category not found');
        if (String(category.user_id) !== String((req as any).user.userId)) throw new Error('Tidak diizinkan');

        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const packages = (await db.prepare('SELECT * FROM packages WHERE category_id = ?').all(catId)) as any[];

        for (const pkg of packages) {
          const ordered = (await db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND title = ?').get(category.user_id, pkg.name)) as { count: number };

          if (ordered && ordered.count > 0) {
            const archivedName = `${pkg.name}_archived_${timestamp}`;
            await db.prepare('UPDATE packages SET name = ?, deleted = 1, category_id = NULL WHERE id = ?').run(archivedName, pkg.id);
          } else {
            await db.prepare('DELETE FROM packages WHERE id = ?').run(pkg.id);
          }
        }
      });
      await clearTx(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Clear Packages Error:', error);
      res.status(500).json({ success: false, message: error.message || 'Gagal mengosongkan paket' });
    }
  });

  // API: Duplicate Category (with all packages)
  app.post('/api/kijo/categories/:id/duplicate', requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    try {
      const cat = await db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId) as any;
      if (!cat) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });

      const result = await db.prepare(
        'INSERT INTO categories (user_id, name, game_name, game_account_id, rank, visible) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, `${cat.name} (Copy)`, cat.game_name, cat.game_account_id, cat.rank, 0);
      const newCatId = result.insertId || (result as any).insertId || 0;

      const packages = (await db.prepare('SELECT * FROM packages WHERE category_id = ? AND deleted = 0').all(id)) as any[];
      for (const pkg of packages) {
        await db.prepare(
          'INSERT INTO packages (category_id, name, price, duration, package_type, player_count, min_players, max_players, is_bundle, bundle_start, bundle_end, rank, is_recurring, recurring_extra_duration, recurring_every_quantity, criteria) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(newCatId, pkg.name, pkg.price, pkg.duration, pkg.package_type, pkg.player_count, pkg.min_players, pkg.max_players, pkg.is_bundle, pkg.bundle_start, pkg.bundle_end, pkg.rank, pkg.is_recurring, pkg.recurring_extra_duration, pkg.recurring_every_quantity, pkg.criteria);
      }

      res.json({ success: true, newCategoryId: newCatId });
    } catch (error: any) {
      console.error('Duplicate Category Error:', error);
      res.status(500).json({ success: false, message: error.message || 'Gagal menduplikasi' });
    }
  });

  // API: Toggle Category Visibility
  app.post('/api/kijo/categories/:id/visibility', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { visible } = req.body; // 1 or 0
    const userId = (req as any).user.userId;
    try {
      const cat = await db.prepare('SELECT id, game_account_id, user_id FROM categories WHERE id = ?').get(id) as any;
      if (!cat || String(cat.user_id) !== String(userId)) {
        return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
      }
      // Block showing category if no valid account is linked
      if (visible === 1 && cat.game_account_id) {
        const acct = await db.prepare('SELECT id FROM game_accounts WHERE id = ? AND deleted = 0').get(cat.game_account_id) as any;
        if (!acct) {
          return res.status(400).json({ success: false, message: 'Tidak dapat menampilkan kategori tanpa akun boosting aktif' });
        }
      }
      if (visible === 1 && !cat.game_account_id) {
        return res.status(400).json({ success: false, message: 'Tambahkan akun boosting ke kategori terlebih dahulu' });
      }
      await db.prepare('UPDATE categories SET visible = ? WHERE id = ?').run(visible, id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Delete Package (Smart Delete with Renaming)
  app.delete('/api/kijo/packages/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID Paket tidak valid' });

    try {
      const pkg = await db.prepare('SELECT * FROM packages WHERE id = ?').get(id) as any;
      if (!pkg) {
        return res.status(404).json({ success: false, message: 'Paket tidak ditemukan' });
      }

      const category = (await db.prepare('SELECT user_id FROM categories WHERE id = ?').get(pkg.category_id)) as { user_id: number };
      const userId = category ? category.user_id : null;

      if (userId && String(userId) !== String((req as any).user.userId)) {
        return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
      }

      const ordered = userId ? (await db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND title = ?').get(userId, pkg.name)) as { count: number } : { count: 0 };

      if (ordered && ordered.count > 0) {
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const archivedName = `${pkg.name}_archived_${timestamp}`;
        await db.prepare('UPDATE packages SET name = ?, deleted = 1, category_id = NULL WHERE id = ?').run(archivedName, id);
      } else {
        await db.prepare('DELETE FROM packages WHERE id = ?').run(id);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete Package Error:', error);
      res.status(500).json({ success: false, message: error.message || 'Gagal menghapus paket' });
    }
  });

  // API: Toggle Package Archive Status
  app.post('/api/kijo/packages/:id/archive', async (req, res) => {
    const { id } = req.params;
    const { archived } = req.body; // 1 or 0
    try {
      await db.prepare('UPDATE packages SET archived = ? WHERE id = ?').run(archived, id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Toggle Manual Status
  app.post('/api/kijo/settings/status', async (req, res) => {
    const { userId, status } = req.body;
    try {
      await db.prepare('UPDATE users SET manual_status = ? WHERE id = ?').run(status, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Update Operational Settings
  app.post('/api/kijo/settings/operational', async (req, res) => {
    const { userId, work_start, work_end, break_start, break_end, break_time, pre_order_days, weekly_days, off_days, max_slots } = req.body;
    try {
      await db.prepare(`
        UPDATE users 
        SET work_start = ?, work_end = ?, break_start = ?, break_end = ?, break_time = ?, pre_order_days = ?, weekly_days = ?, off_days = ?, max_slots = ? 
        WHERE id = ?
      `).run(work_start, work_end, break_start, break_end, break_time, pre_order_days, weekly_days, JSON.stringify(off_days), max_slots, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Operational Settings Error:', error);
      res.status(500).json({ success: false });
    }
  });

  app.get('/api/kijo/available-slots/:id', async (req, res) => {
    const { id } = req.params;
    const { date } = req.query; // Expecting YYYY-MM-DD
    try {
      const kijo = (await db.prepare('SELECT work_start, work_end, break_start, break_end, break_time, weekly_days, pre_order_days, break_until FROM users WHERE id = ?').get(id)) as any;
      if (!kijo) return res.status(404).json({ success: false, message: 'Kijo tidak ditemukan' });

      // Get existing sessions for this date (include pending_payment to lock slots during checkout)
      const sessions = (await db.prepare("SELECT scheduled_at, duration FROM sessions WHERE user_id = ? AND status IN ('upcoming', 'ongoing', 'pending_payment') AND scheduled_at LIKE ?").all(id, `${date}%`)) as any[];

      // Get holidays for this kijo (for date picker to disable holiday days)
      const holidays = (await db.prepare('SELECT start_date, end_date FROM holidays WHERE user_id = ? ORDER BY start_date ASC').all(id)) as any[];

      res.json({
        work_start: kijo.work_start,
        work_end: kijo.work_end,
        break_start: kijo.break_start,
        break_end: kijo.break_end,
        break_time: kijo.break_time,
        weekly_days: kijo.weekly_days,
        pre_order_days: kijo.pre_order_days !== null ? kijo.pre_order_days : 7,
        break_until: kijo.break_until,
        holidays,
        busy_slots: sessions.map(s => ({
          start: s.scheduled_at,
          duration: s.duration || 1
        }))
      });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  app.post('/api/orders/start', requireAuth, async (req: any, res: any) => {
    const { orderId } = req.body;
    const authUserId = req.user.userId;
    try {
      const session = await db.prepare('SELECT user_id, jokies_id, game_title, kijo_nickname FROM sessions WHERE id = ?').get(orderId) as any;
      if (!session || (session.user_id !== authUserId && session.jokies_id !== authUserId && req.user.role !== 'admin')) {
        return res.status(403).json({ success: false, message: 'Anda bukan peserta pesanan ini' });
      }
      if (session && (session.kijo_nickname === '-' || !session.kijo_nickname)) {
        const boostingAcc = await db.prepare(`
          SELECT nickname, game_id, id 
          FROM game_accounts 
          WHERE user_id = ? 
          AND game_name LIKE ?
          AND account_type = 'boosting' 
          AND deleted = 0
        `).get(session.user_id, `%${session.game_title}%`) as any;
        if (boostingAcc) {
          await db.prepare("UPDATE sessions SET kijo_nickname = ?, kijo_game_id = ?, kijo_game_account_id = ? WHERE id = ?").run(boostingAcc.nickname, boostingAcc.game_id, boostingAcc.id, orderId);
        }
      }
      await db.prepare("UPDATE sessions SET status = 'ongoing', started_at = NOW() WHERE id = ? AND status = 'upcoming'").run(orderId);
      
      // Notify Jokies
      const updatedSession = await db.prepare('SELECT jokies_id, title FROM sessions WHERE id = ?').get(orderId) as any;
      if (updatedSession) {
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          updatedSession.jokies_id,
          'order_update',
          'Sesi Dimulai!',
          `Partner telah memulai sesi untuk pesanan #${orderId} (${updatedSession.title}). Selamat bermain!`
        );
      }

      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to start session' });
    }
  });

  // API: Get Holidays
  app.get('/api/kijo/holidays/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
      const holidays = await db.prepare('SELECT * FROM holidays WHERE user_id = ? ORDER BY start_date ASC').all(userId);
      res.json(holidays);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Add Holiday
  app.post('/api/kijo/holidays', async (req, res) => {
    const { userId, start_date, end_date, reason } = req.body;
    try {
      const result = await db.prepare('INSERT INTO holidays (user_id, start_date, end_date, reason) VALUES (?, ?, ?, ?)').run(userId, start_date, end_date, reason);
      res.json({ success: true, id: (result as any).insertId });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Delete Holiday
  app.delete('/api/kijo/holidays/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID Libur tidak valid' });
    
    console.log(`[SERVER] Delete Holiday Request for ID: ${id}`);
    try {
      const result = await db.prepare('DELETE FROM holidays WHERE id = ?').run(id);
      const changes = (result as any).affectedRows;
      console.log(`[SERVER] Holiday ${id} deleted. Changes: ${changes}`);
      if (changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Jadwal libur tidak ditemukan' });
      }
    } catch (error: any) {
      console.error('[SERVER] Delete Holiday Error:', error);
      res.status(500).json({ success: false, message: error.message || 'Gagal menghapus jadwal libur' });
    }
  });

  // API: Get User Stats
  app.get('/api/kijo/stats/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
      const user = (await db.prepare('SELECT id, username, email, phone, full_name, role, balance_active, balance_held, wallet_jokies, status_ketersediaan, work_start, work_end, break_start, break_end, weekly_days, off_days, manual_status, max_slots, break_time, pre_order_days, motto, detail_kijo, is_suspended, is_verified, has_kijo_profile, break_until, verified_game, created_at FROM users WHERE id = ?').get(userId)) as any;
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Count active orders for status logic
      const activeOrders = (await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND status = 'ongoing'").get(userId)) as { count: number };

      res.json({
        ...user,
        active_orders: activeOrders.count
      });
    } catch (error: any) {
      console.error(`Error fetching stats for user ${userId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: error.message
      });
    }
  });

  // API: Get Sessions
  app.get('/api/kijo/sessions/:userId', requireAuth, async (req: any, res: any) => {
    const userId = req.user.userId;

    // Auto-start: only for THIS Kijo's upcoming sessions that are past scheduled_at
    try {
      const nowIso = new Date().toISOString();
      const sessionsToStart = (await db.prepare("SELECT id, jokies_id FROM sessions WHERE user_id = ? AND status = 'upcoming' AND scheduled_at <= ?").all(userId, nowIso)) as any[];
      
      for (const session of sessionsToStart) {
        await db.prepare("UPDATE sessions SET status = 'ongoing', started_at = NOW() WHERE id = ?").run(session.id);
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          userId, 'system', 'Sesi Dimulai Otomatis',
          `Sesi #${session.id} telah dimulai secara otomatis karena sudah melewati waktu mulai.`
        );
        if (session.jokies_id) {
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            session.jokies_id, 'order_update', 'Sesi Dimulai!',
            `Sesi #${session.id} telah dimulai secara otomatis.`
          );
        }
      }
    } catch (e) {
      console.error('Auto-start Session Error:', e);
    }

    // Auto-cancel: upcoming sessions past scheduled_at + duration that were never started
    try {
      const expiredSessions = (await db.prepare(`
        SELECT id, jokies_id, total_price, duration, scheduled_at
        FROM sessions WHERE user_id = ? AND status = 'upcoming'
      `).all(userId)) as any[];
      const now = new Date();
      for (const s of expiredSessions) {
        const end = new Date(new Date(s.scheduled_at).getTime() + (s.duration || 1) * 60 * 60 * 1000);
        if (now > end) {
          await db.transaction(async () => {
            await db.prepare("UPDATE sessions SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'system', cancellation_reason = 'Otomatis dibatalkan: melewati waktu booking + durasi tanpa dimulai' WHERE id = ?").run(s.id);
            if (s.jokies_id && s.total_price) {
              await db.prepare('UPDATE users SET wallet_jokies = wallet_jokies + ? WHERE id = ?').run(s.total_price, s.jokies_id);
              await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                s.jokies_id, 'order_update', 'Pesanan Dibatalkan Otomatis',
                `Pesanan #${s.id} dibatalkan otomatis karena melewati waktu booking. Dana Rp ${(s.total_price || 0).toLocaleString()} dikembalikan ke wallet Anda.`
              );
            }
            await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
              userId, 'system', 'Pesanan Expired',
              `Pesanan #${s.id} dibatalkan otomatis karena melewati waktu booking + durasi tanpa dimulai.`
            );
          })();
        }
      }
    } catch (e) {
      console.error('Auto-cancel expired sessions error:', e);
    }

    // Auto-cancel: pending_payment sessions older than 20 minutes (15 min Midtrans + 5 min buffer)
    try {
      const now2 = new Date();
      const pendingPayments = (await db.prepare(`
        SELECT id, jokies_id, created_at FROM sessions WHERE user_id = ? AND status = 'pending_payment'
      `).all(userId)) as any[];
      for (const s of pendingPayments) {
        const createdAt = new Date(s.created_at).getTime();
        if (now2.getTime() - createdAt > PAYMENT_TIMEOUT_MS) {
          await db.transaction(async () => {
            await db.prepare("UPDATE sessions SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'system', cancellation_reason = 'Otomatis dibatalkan: pembayaran tidak diselesaikan dalam waktu yang ditentukan' WHERE id = ? AND status = 'pending_payment'").run(s.id);
            await db.prepare("UPDATE payment_transactions SET payment_status = 'expire', escrow_status = 'none', updated_at = NOW() WHERE session_id = ? AND payment_status = 'pending'").run(s.id);
            if (s.jokies_id) {
              await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                s.jokies_id, 'order_update', 'Pembayaran Kedaluwarsa',
                `Pesanan #${s.id} dibatalkan otomatis karena pembayaran tidak diselesaikan dalam waktu yang ditentukan.`
              );
            }
          })();
        }
      }
    } catch (e) {
      console.error('Auto-cancel pending_payment kijo sessions error:', e);
    }

    // Auto-complete: ongoing sessions past scheduled_at + duration (unattended)
    try {
      const nowAC = new Date();
      const ongoingSessions = (await db.prepare(`
        SELECT id, jokies_id, scheduled_at, duration, screenshot_start, screenshot_end, total_price, price, admin_fee, escrow_status, payment_transaction_id
        FROM sessions WHERE user_id = ? AND status = 'ongoing'
      `).all(userId)) as any[];
      for (const s of ongoingSessions) {
        const endTime = new Date(new Date(s.scheduled_at).getTime() + (s.duration || 1) * 60 * 60 * 1000);
        if (nowAC > endTime) {
          const hasProofs = !!(s.screenshot_start && s.screenshot_end);
          await db.transaction(async () => {
            if (hasProofs) {
              await db.prepare("UPDATE sessions SET status = 'completed', completed_at = NOW(), kijo_finished = 1, jokies_finished = 1, escrow_status = 'released' WHERE id = ? AND status = 'ongoing'").run(s.id);
              const kijoEarnings = s.price || (s.total_price - (s.admin_fee || 0));
              await db.prepare('UPDATE users SET balance_active = balance_active + ? WHERE id = ?').run(kijoEarnings, userId);
              if (s.payment_transaction_id) {
                await db.prepare("UPDATE payment_transactions SET escrow_status = 'released', released_at = NOW(), updated_at = NOW() WHERE id = ?").run(s.payment_transaction_id);
              }
              await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                userId, 'order_update', 'Pesanan Selesai Otomatis',
                `Pesanan #${s.id} telah diselesaikan otomatis. Dana Rp ${(kijoEarnings || 0).toLocaleString()} dicairkan ke Saldo Aktif Anda.`
              );
              if (s.jokies_id) {
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  s.jokies_id, 'order_update', 'Pesanan Selesai Otomatis',
                  `Pesanan #${s.id} telah diselesaikan otomatis karena durasi sesi telah selesai.`
                );
              }
            } else {
              await db.prepare("UPDATE sessions SET status = 'pending_completion', kijo_finished = 0 WHERE id = ? AND status = 'ongoing'").run(s.id);
              await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                userId, 'order_update', 'Sesi Selesai — Unggah Bukti',
                `Durasi pesanan #${s.id} telah berakhir. Silakan unggah bukti pengerjaan (Sebelum & Sesudah) agar dana dapat dicairkan.`
              );
              if (s.jokies_id) {
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  s.jokies_id, 'order_update', 'Durasi Sesi Berakhir',
                  `Durasi pesanan #${s.id} telah berakhir. Menunggu Partner mengunggah bukti pengerjaan.`
                );
              }
            }
          })();
        }
      }
    } catch (e) {
      console.error('Auto-complete ongoing kijo sessions error:', e);
    }

    // Notification check for sessions starting in 10 mins
    try {
      const now = new Date();
      const tenMinsLater = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
      const nowIso = now.toISOString();
      
      const upcomingSoon = (await db.prepare("SELECT id, title, scheduled_at FROM sessions WHERE user_id = ? AND status = 'upcoming' AND scheduled_at > ? AND scheduled_at <= ?").all(userId, nowIso, tenMinsLater)) as any[];
      
      for (const session of upcomingSoon) {
        const exists = await db.prepare("SELECT id FROM notifications WHERE user_id = ? AND type = 'order_reminder' AND message LIKE ?").get(userId, `%#${session.id}%`);
        if (!exists) {
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            userId, 'order_reminder', 'Sesi Akan Dimulai!',
            `Pesanan #${session.id} (${session.title}) akan dimulai dalam kurang dari 10 menit. Bersiaplah!`
          );
        }
      }
    } catch (e) {
      console.error('Reminder Notification Error:', e);
    }

    const sessions = (await db.prepare(`
      SELECT s.*, u.full_name as jokies_name, u.username as jokies_username 
      FROM sessions s 
      JOIN users u ON s.jokies_id = u.id 
      WHERE s.user_id = ?
    `).all(userId)) as any[];
    
    const grouped = {
      upcoming: sessions.filter((s: any) => s.status === 'upcoming'),
      ongoing: sessions.filter((s: any) => s.status === 'ongoing' || s.status === 'pending_completion' || s.status === 'pending_cancellation'),
      history: sessions.filter((s: any) => s.status === 'completed' || s.status === 'cancelled')
    };

    res.json(grouped);
  });

  // API: Get Notifications
  app.get('/api/kijo/notifications/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
      const notifications = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(userId);
      res.json(Array.isArray(notifications) ? notifications : []);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Mark All as Read
  app.post('/api/kijo/notifications/read-all', (req, res) => {
    const { userId } = req.body;
    try {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Delete Specific Notification
  app.delete('/api/kijo/notifications/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Mark Notification as Read
  app.post('/api/kijo/notifications/:id/read', async (req, res) => {
    const { id } = req.params;
    try {
      await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Clear All Notifications
  app.delete('/api/kijo/notifications/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
      await db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get User Traits
  app.get('/api/kijo/traits/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
      const traits = await db.prepare('SELECT * FROM traits WHERE user_id = ?').all(userId);
      res.json(traits);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get Kijo Completed Order History (for public profile)
  app.get('/api/marketplace/kijo/:userId/history', async (req, res) => {
    const { userId } = req.params;
    try {
      const history = await db.prepare(`
        SELECT s.id, s.title, s.scheduled_at, s.status, p.package_type, p.duration
        FROM sessions s
        JOIN packages p ON s.title = p.name
        WHERE s.user_id = ? AND s.status = 'completed'
        ORDER BY s.scheduled_at DESC
        LIMIT 10
      `).all(userId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get Account Data (Ratings, Game Accounts, Wallet, Stats)
  app.get('/api/kijo/account/:userId', requireAuth, async (req, res) => {
    const { userId } = req.params;
    if (String((req as any).user.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const user = await db.prepare('SELECT id, username, email, phone, full_name, role, balance_active, balance_held, wallet_jokies, status_ketersediaan, work_start, work_end, break_start, break_end, weekly_days, off_days, manual_status, max_slots, break_time, pre_order_days, motto, detail_kijo, is_suspended, is_verified, has_kijo_profile, break_until, verified_game, created_at, avatar_url, social_links, notification_preferences FROM users WHERE id = ?').get(userId) as any;
      if (!user) return res.status(404).json({ error: 'User not found' });

      const isKijo = user.role === 'kijo';
      
      const ratings = isKijo 
        ? await db.prepare(`
            SELECT r.*, u.username as jokies_username, u.full_name as jokies_name, u.avatar_url as jokies_avatar
            FROM ratings r
            LEFT JOIN users u ON r.jokies_id = u.id
            WHERE r.user_id = ? ORDER BY r.created_at DESC`).all(userId)
        : await db.prepare(`
            SELECT r.*, u.username as kijo_username, u.full_name as kijo_name, u.avatar_url as kijo_avatar
            FROM ratings r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.jokies_id = ? ORDER BY r.created_at DESC`).all(userId);
        
      const gameAccounts = await db.prepare('SELECT * FROM game_accounts WHERE user_id = ? AND deleted = 0').all(userId);
      const transactions = await db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(userId);
      const withdrawals = await db.prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      
      // Lifetime Stats
      const monthlyOrders = isKijo
        ? await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND status = 'completed'").get(userId) as { count: number }
        : await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE jokies_id = ? AND status = 'completed'").get(userId) as { count: number };

      const cancelledOrders = isKijo
        ? await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND status = 'cancelled'").get(userId) as { count: number }
        : await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE jokies_id = ? AND status = 'cancelled'").get(userId) as { count: number };
      
      // Total Booked
      const totalBooked = isKijo
        ? await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND status = 'completed'").get(userId) as { count: number }
        : await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE jokies_id = ? AND status = 'completed'").get(userId) as { count: number };

      // Pending earnings for Kijo: sum of prices for orders not yet completed
      if (isKijo) {
        const pendingResult = await db.prepare(
          "SELECT COALESCE(SUM(price), 0) as total FROM sessions WHERE user_id = ? AND status IN ('upcoming', 'ongoing', 'pending_completion')"
        ).get(userId) as { total: number };
        user.balance_held = pendingResult.total;

        // Saldo Refund: total refunded escrow for Kijo
        const refundResult = await db.prepare(
          "SELECT COALESCE(SUM(pt.total_amount), 0) as total FROM payment_transactions pt JOIN sessions s ON pt.session_id = s.id WHERE s.user_id = ? AND pt.escrow_status IN ('refunded', 'partial_refund')"
        ).get(userId) as { total: number };
        user.balance_refund = refundResult.total;
      } else {
        // Saldo Refund for Jokies: total refunded to their wallet from cancelled orders
        const refundResult = await db.prepare(
          "SELECT COALESCE(SUM(pt.total_amount), 0) as total FROM payment_transactions pt JOIN sessions s ON pt.session_id = s.id WHERE s.jokies_id = ? AND pt.escrow_status IN ('refunded', 'partial_refund')"
        ).get(userId) as { total: number };
        user.balance_refund = refundResult.total;
      }

      // Active Games (Games that have at least one category OR is the verified game)
      const activeGames = await db.prepare(`
        SELECT DISTINCT game_name FROM categories WHERE user_id = ? AND game_name IS NOT NULL
        UNION
        SELECT verified_game FROM users WHERE id = ? AND verified_game IS NOT NULL AND role = 'kijo'
      `).all(userId, userId) as { game_name: string }[];

      // Login history (last 5)
      let loginHistory: any[] = [];
      try {
        loginHistory = await db.prepare('SELECT id, ip_address, user_agent, created_at FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId) as any[];
      } catch (e) { /* table may not exist yet — pending server restart */ }

      // Saved payment methods
      let savedPaymentMethods: any[] = [];
      try {
        savedPaymentMethods = await db.prepare('SELECT * FROM saved_payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(userId) as any[];
      } catch (e) { /* table may not exist yet — pending server restart */ }

      res.json({
        user,
        ratings,
        gameAccounts,
        transactions,
        withdrawals,
        activeGames: activeGames.map(g => g.game_name),
        loginHistory,
        savedPaymentMethods,
        stats: {
          monthlyOrders: monthlyOrders.count,
          cancelledOrders: cancelledOrders.count,
          totalBooked: totalBooked.count
        }
      });
    } catch (error) {
      console.error('Account Data Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // =====================================================
  // Feature 1: Avatar Upload (base64 → GCS / URL)
  // =====================================================
  app.post('/api/users/:id/avatar', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (String((req as any).user.userId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const { avatar_url } = req.body;
      if (!avatar_url || typeof avatar_url !== 'string') {
        return res.status(400).json({ success: false, message: 'avatar_url wajib diisi' });
      }
      // 10 MB cap on raw base64 string
      if (avatar_url.length > 10 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'Avatar terlalu besar (maks 10MB)' });
      }
      // Upload to GCS if it's a base64 data URI, else store as-is
      const finalUrl = await uploadBase64ToGCS(GCS_BUCKET_PROFIL, avatar_url, 'avatars', `user-${id}`);
      await db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(finalUrl, id);
      res.json({ success: true, avatar_url: finalUrl, message: 'Avatar berhasil diperbarui' });
    } catch (error) {
      console.error('Avatar Update Error:', error);
      res.status(500).json({ success: false, message: 'Gagal memperbarui avatar' });
    }
  });

  // =====================================================
  // Feature 2: Social Links
  // =====================================================
  app.post('/api/users/:id/social-links', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (String((req as any).user.userId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const { social_links } = req.body;
      if (!social_links || typeof social_links !== 'object') {
        return res.status(400).json({ success: false, message: 'social_links wajib diisi' });
      }
      // Only allow known keys
      const allowed = ['discord', 'steam', 'battlenet'];
      const filtered: Record<string, string> = {};
      for (const key of allowed) {
        if (social_links[key] !== undefined) {
          filtered[key] = String(social_links[key]);
        }
      }
      await db.prepare('UPDATE users SET social_links = ? WHERE id = ?').run(JSON.stringify(filtered), id);
      res.json({ success: true, message: 'Social links berhasil diperbarui', social_links: filtered });
    } catch (error) {
      console.error('Social Links Update Error:', error);
      res.status(500).json({ success: false, message: 'Gagal memperbarui social links' });
    }
  });

  // =====================================================
  // Feature 3: Notification Preferences
  // =====================================================
  app.post('/api/users/:id/notification-preferences', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (String((req as any).user.userId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const { preferences } = req.body;
      if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({ success: false, message: 'preferences wajib diisi' });
      }
      const allowed = ['new_order', 'order_completed', 'withdrawal_update', 'system_announcement'];
      const filtered: Record<string, boolean> = {};
      for (const key of allowed) {
        filtered[key] = preferences[key] === true;
      }
      await db.prepare('UPDATE users SET notification_preferences = ? WHERE id = ?').run(JSON.stringify(filtered), id);
      res.json({ success: true, message: 'Preferensi notifikasi berhasil diperbarui', preferences: filtered });
    } catch (error) {
      console.error('Notification Preferences Update Error:', error);
      res.status(500).json({ success: false, message: 'Gagal memperbarui preferensi notifikasi' });
    }
  });

  // =====================================================
  // Feature 4: Session History Export (CSV)
  // =====================================================
  app.get('/api/kijo/sessions-export/:userId', requireAuth, async (req, res) => {
    const { userId } = req.params;
    if (String((req as any).user.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
      if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

      const sessions = user.role === 'kijo'
        ? await db.prepare('SELECT s.id, s.status, s.scheduled_at, s.duration, s.created_at, u.username AS jokies_name FROM sessions s LEFT JOIN users u ON s.jokies_id = u.id WHERE s.user_id = ? ORDER BY s.created_at DESC').all(userId) as any[]
        : await db.prepare('SELECT s.id, s.status, s.scheduled_at, s.duration, s.created_at, u.username AS kijo_name FROM sessions s LEFT JOIN users u ON s.user_id = u.id WHERE s.jokies_id = ? ORDER BY s.created_at DESC').all(userId) as any[];

      // Build CSV
      const partnerHeader = user.role === 'kijo' ? 'Jokies' : 'Kijo';
      const header = `ID,Status,Scheduled At,Duration,Created At,${partnerHeader}`;
      const rows = sessions.map((s: any) => {
        const partner = user.role === 'kijo' ? (s.jokies_name || '') : (s.kijo_name || '');
        return `${s.id},${s.status},"${s.scheduled_at || ''}",${s.duration || ''},"${s.created_at || ''}","${partner}"`;
      });
      const csv = [header, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="sessions-${userId}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Session Export Error:', error);
      res.status(500).json({ success: false, message: 'Gagal mengekspor sesi' });
    }
  });

  // =====================================================
  // Feature 5: Rating Reply
  // =====================================================
  app.post('/api/kijo/ratings/:ratingId/reply', requireAuth, async (req, res) => {
    const { ratingId } = req.params;
    try {
      const { reply } = req.body;
      if (!reply || typeof reply !== 'string' || reply.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Balasan wajib diisi' });
      }
      if (reply.length > 300) {
        return res.status(400).json({ success: false, message: 'Balasan maksimal 300 karakter' });
      }

      // Verify the rating belongs to the logged-in user (kijo)
      const rating = await db.prepare('SELECT id, user_id FROM ratings WHERE id = ?').get(ratingId) as any;
      if (!rating) {
        return res.status(404).json({ success: false, message: 'Rating tidak ditemukan' });
      }
      if (String(rating.user_id) !== String((req as any).user.userId)) {
        return res.status(403).json({ success: false, message: 'Tidak diizinkan membalas rating ini' });
      }

      await db.prepare('UPDATE ratings SET reply = ?, reply_at = NOW() WHERE id = ?').run(reply.trim(), ratingId);
      res.json({ success: true, message: 'Balasan berhasil disimpan' });
    } catch (error) {
      console.error('Rating Reply Error:', error);
      res.status(500).json({ success: false, message: 'Gagal menyimpan balasan' });
    }
  });

  // =====================================================
  // Feature 6: Login History
  // =====================================================
  app.get('/api/users/:id/login-history', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (String((req as any).user.userId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const history = await db.prepare('SELECT id, ip_address, user_agent, created_at FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(id);
      res.json({ success: true, history });
    } catch (error) {
      console.error('Login History Error:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil riwayat login' });
    }
  });

  // =====================================================
  // Feature 7: Saved Payment Methods
  // =====================================================
  app.get('/api/users/:id/payment-methods', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (String((req as any).user.userId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const methods = await db.prepare('SELECT * FROM saved_payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(id);
      res.json({ success: true, methods });
    } catch (error) {
      console.error('Payment Methods Get Error:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil metode pembayaran' });
    }
  });

  app.post('/api/users/:id/payment-methods', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (String((req as any).user.userId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const { method_type, account_name, account_number, is_default } = req.body;
      if (!method_type || !account_name || !account_number) {
        return res.status(400).json({ success: false, message: 'method_type, account_name, dan account_number wajib diisi' });
      }

      // If setting as default, unset other defaults first
      if (is_default) {
        await db.prepare('UPDATE saved_payment_methods SET is_default = 0 WHERE user_id = ?').run(id);
      }

      const result = await db.prepare('INSERT INTO saved_payment_methods (user_id, method_type, account_name, account_number, is_default) VALUES (?, ?, ?, ?, ?)').run(
        id, method_type, account_name, account_number, is_default ? 1 : 0
      );
      res.json({ success: true, message: 'Metode pembayaran berhasil disimpan', id: result.insertId });
    } catch (error) {
      console.error('Payment Methods Add Error:', error);
      res.status(500).json({ success: false, message: 'Gagal menyimpan metode pembayaran' });
    }
  });

  app.delete('/api/users/:id/payment-methods/:methodId', requireAuth, async (req, res) => {
    const { id, methodId } = req.params;
    if (String((req as any).user.userId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      // Verify the payment method belongs to this user
      const method = await db.prepare('SELECT id FROM saved_payment_methods WHERE id = ? AND user_id = ?').get(methodId, id) as any;
      if (!method) {
        return res.status(404).json({ success: false, message: 'Metode pembayaran tidak ditemukan' });
      }
      await db.prepare('DELETE FROM saved_payment_methods WHERE id = ? AND user_id = ?').run(methodId, id);
      res.json({ success: true, message: 'Metode pembayaran berhasil dihapus' });
    } catch (error) {
      console.error('Payment Methods Delete Error:', error);
      res.status(500).json({ success: false, message: 'Gagal menghapus metode pembayaran' });
    }
  });

  // API: Request Withdrawal
  app.post('/api/kijo/withdraw', requireAuth, async (req, res) => {
    const { userId, amount, destination } = req.body;
    if (String((req as any).user.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      if (typeof amount !== 'number' || amount < 20000) {
        return res.status(400).json({ success: false, message: 'Minimal penarikan adalah Rp 20.000' });
      }
      if (amount <= 0) {
        return res.status(400).json({ success: false, message: 'Jumlah penarikan tidak valid' });
      }
      if (!destination) {
        return res.status(400).json({ success: false, message: 'Tujuan penarikan wajib diisi' });
      }

      await db.transaction(async () => {
        const user = await db.prepare('SELECT balance_active FROM users WHERE id = ?').get(userId) as any;
        if (!user || user.balance_active < amount) {
          throw new Error('INSUFFICIENT_BALANCE');
        }
        await db.prepare('UPDATE users SET balance_active = balance_active - ? WHERE id = ?').run(amount, userId);
        await db.prepare('INSERT INTO withdrawals (user_id, amount, destination) VALUES (?, ?, ?)').run(userId, amount, destination);
        await db.prepare('INSERT INTO transactions (user_id, type, amount, description, status) VALUES (?, ?, ?, ?, ?)').run(userId, 'withdrawal', amount, `Penarikan ke ${destination}`, 'pending');
      })();

      res.json({ success: true });
    } catch (error: any) {
      if (error?.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ success: false, message: 'Saldo tidak mencukupi' });
      }
      res.status(500).json({ success: false });
    }
  });

  // API: Get Available Games (From game_titles table)
  app.get('/api/kijo/available-games', async (req, res) => {
    const { userId, type } = req.query;
    try {
      let games;
      if (userId && type === 'boosting') {
        // Check if user is a Kijo
        const user = await db.prepare('SELECT role, verified_game FROM users WHERE id = ?').get(userId) as any;
        if (user && user.role === 'kijo' && user.verified_game) {
          games = await db.prepare(`
            SELECT name, input_schema, ranks 
            FROM game_titles 
            WHERE name = ?
          `).all(user.verified_game) as any[];
        } else {
          games = await db.prepare(`
            SELECT name, input_schema, ranks 
            FROM game_titles 
            WHERE is_active = 1 
            ORDER BY name ASC
          `).all() as any[];
        }
      } else {
        games = await db.prepare('SELECT name, input_schema, ranks FROM game_titles WHERE is_active = 1 ORDER BY name ASC').all() as any[];
      }
      res.json(games.map(g => ({
        name: g.name,
        schema: JSON.parse(g.input_schema || '[]'),
        ranks: JSON.parse(g.ranks || '[]')
      })));
    } catch (error) {
      res.status(500).json([]);
    }
  });

  app.get('/api/kijo/my-games/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
      const games = await db.prepare(`
        SELECT DISTINCT game_name FROM categories WHERE user_id = ? AND game_name IS NOT NULL
        UNION
        SELECT verified_game FROM users WHERE id = ? AND verified_game IS NOT NULL AND role = 'kijo'
      `).all(userId, userId) as { game_name: string }[];
      res.json(games.map(g => g.game_name));
    } catch (error) {
      res.status(500).json([]);
    }
  });

  // API: Admin Manage Games (Using game_titles)
  app.get('/api/admin/games', async (req, res) => {
    try {
      const games = await db.prepare('SELECT * FROM game_titles ORDER BY created_at DESC').all() as any[];
      const formatted = games.map(g => ({
        ...g,
        input_schema: JSON.parse(g.input_schema || '[]'),
        ranks: JSON.parse(g.ranks || '[]')
      }));
      res.json(formatted);
    } catch (error) {
      res.status(500).json([]);
    }
  });

  app.post('/api/admin/games', async (req, res) => {
    const { name, is_active, input_schema, ranks } = req.body;
    try {
      await db.prepare('INSERT INTO game_titles (name, is_active, input_schema, ranks) VALUES (?, ?, ?, ?)').run(
        name,
        is_active ? 1 : 0,
        JSON.stringify(input_schema || []),
        JSON.stringify(ranks || [])
      );
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ success: false, message: 'Game sudah ada atau data tidak valid' });
    }
  });

  app.put('/api/admin/games/:id', async (req, res) => {
    const { id } = req.params;
    const { name, is_active, input_schema, ranks } = req.body;
    try {
      await db.prepare('UPDATE game_titles SET name = ?, is_active = ?, input_schema = ?, ranks = ? WHERE id = ?').run(
        name,
        is_active ? 1 : 0,
        JSON.stringify(input_schema || []),
        JSON.stringify(ranks || []),
        id
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  app.delete('/api/admin/games/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const game = await db.prepare('SELECT name FROM game_titles WHERE id = ?').get(id) as any;
      if (!game) return res.status(404).json({ success: false, message: 'Game tidak ditemukan' });

      // Check for active usage in categories (etalase)
      const usageCount = await db.prepare('SELECT COUNT(*) as count FROM categories WHERE game_name = ? AND deleted = 0').get(game.name) as { count: number };
      
      // Check for active orders
      const orderCount = await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE game_title = ? AND status IN ('upcoming', 'ongoing')").get(game.name) as { count: number };

      if (usageCount.count > 0 || orderCount.count > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Game ini tidak dapat dihapus karena sedang digunakan oleh ${usageCount.count} etalase dan memiliki ${orderCount.count} pesanan aktif. Nonaktifkan game ini saja atau hapus data terkait terlebih dahulu.` 
        });
      }

      await db.prepare('DELETE FROM game_titles WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // API: Get Game Accounts
  app.get('/api/kijo/game-accounts/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
      const accounts = await db.prepare('SELECT * FROM game_accounts WHERE user_id = ? AND deleted = 0').all(userId);
      res.json(Array.isArray(accounts) ? accounts : []);
    } catch (error) {
      console.error('Get Game Accounts Error:', error);
      res.status(500).json([]);
    }
  });

  // API: Update/Add Game Account
  app.post('/api/kijo/game-accounts', requireAuth, async (req, res) => {
    const { id, userId, game_name, nickname, game_id, rank, server, dynamic_data, account_type } = req.body;
    if (String((req as any).user.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    try {
      const dynamicDataStr = dynamic_data ? JSON.stringify(dynamic_data) : null;
      
      if (id) {
        await db.prepare(`
          UPDATE game_accounts SET 
            nickname = ?, 
            game_id = ?, 
            rank = ?, 
            server = ?,
            dynamic_data = ?,
            account_type = ?
          WHERE id = ? AND user_id = ?
        `).run(nickname, game_id, rank, server, dynamicDataStr, account_type || 'personal', id, userId);

        // Update sessions that are missing kijo details (boosting accounts only)
        if (account_type === 'boosting') {
          await db.prepare(`
            UPDATE sessions SET 
              kijo_nickname = ?, 
              kijo_game_id = ?, 
              kijo_game_account_id = ?
            WHERE user_id = ? 
            AND game_title LIKE ?
            AND (kijo_nickname = '-' OR kijo_nickname IS NULL OR kijo_nickname = '') 
            AND status IN ('upcoming', 'ongoing')
          `).run(nickname, game_id, id, userId, `%${game_name}%`);
        }
      } else {
        // Check for a soft-deleted duplicate before inserting
        const existingDeleted = await db.prepare(
          `SELECT id FROM game_accounts WHERE user_id = ? AND game_name = ? AND game_id = ? AND account_type = ? AND deleted = 1`
        ).get(userId, game_name, game_id, account_type || 'personal') as any;

        if (existingDeleted) {
          // Restore the deleted account instead of creating a new duplicate
          await db.prepare(`
            UPDATE game_accounts SET
              deleted = 0, nickname = ?, rank = ?, server = ?, dynamic_data = ?
            WHERE id = ?
          `).run(nickname, rank, server, dynamicDataStr, existingDeleted.id);

          // Restore visibility of categories that were hidden due to this account's deletion
          await db.prepare('UPDATE categories SET visible = 1 WHERE game_account_id = ? AND user_id = ?').run(existingDeleted.id, userId);

          if (account_type === 'boosting') {
            await db.prepare(`
              UPDATE sessions SET
                kijo_nickname = ?,
                kijo_game_id = ?,
                kijo_game_account_id = ?
              WHERE user_id = ?
              AND game_title LIKE ?
              AND (kijo_nickname = '-' OR kijo_nickname IS NULL OR kijo_nickname = '')
              AND status IN ('upcoming', 'ongoing')
            `).run(nickname, game_id, existingDeleted.id, userId, `%${game_name}%`);
          }

          return res.json({ success: true, restored: true });
        }

        const result = await db.prepare(`
          INSERT INTO game_accounts (user_id, game_name, nickname, game_id, rank, server, dynamic_data, account_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userId, game_name, nickname, game_id, rank, server, dynamicDataStr, account_type || 'personal');
        const accountId = result.insertId || (result as any).insertId || (result as any).insert_id || (result as any).insertId || 0;

        // Update sessions that are missing kijo details (boosting accounts only)
        if (account_type === 'boosting') {
          await db.prepare(`
            UPDATE sessions SET 
              kijo_nickname = ?, 
              kijo_game_id = ?, 
              kijo_game_account_id = ?
            WHERE user_id = ? 
            AND game_title LIKE ?
            AND (kijo_nickname = '-' OR kijo_nickname IS NULL OR kijo_nickname = '') 
            AND status IN ('upcoming', 'ongoing')
          `).run(nickname, game_id, accountId, userId, `%${game_name}%`);
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Game Account Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Update Motto
  app.post('/api/kijo/update-motto', requireAuth, async (req, res) => {
    const { userId, motto } = req.body;
    if (String((req as any).user.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
    }
    if (typeof motto === 'string' && motto.length > 500) {
      return res.status(400).json({ success: false, message: 'Motto maksimal 500 karakter' });
    }
    try {
      await db.prepare('UPDATE users SET motto = ? WHERE id = ?').run(motto, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Update Motto Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Delete Game Account
  app.delete('/api/kijo/game-accounts/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    try {
      // Smart delete: block if active sessions reference this account
      const activeSessions = db.prepare(`
        SELECT COUNT(*) as count FROM sessions
        WHERE (jokies_game_account_id = ? OR kijo_game_account_id = ?)
        AND status IN ('upcoming', 'ongoing')
      `).get(id, id) as any;

      if (activeSessions.count > 0) {
        return res.status(409).json({
          success: false,
          message: `Tidak dapat menghapus akun game ini. Ada ${activeSessions.count} pesanan aktif yang terkait. Selesaikan pesanan terlebih dahulu.`
        });
      }

      // Soft delete the account
      await db.prepare('UPDATE game_accounts SET deleted = 1 WHERE id = ? AND user_id = ?').run(id, userId);

      // Hide (but don't hard-delete) etalase categories that used this account
      await db.prepare('UPDATE categories SET visible = 0 WHERE game_account_id = ? AND user_id = ?').run(id, userId);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Reset Password
  app.post('/api/kijo/reset-password', async (req, res) => {
    const { userId, newPassword, otp, email } = req.body;
    if (!userId || !newPassword || !otp || !email) {
      return res.status(400).json({ success: false, message: 'Parameter tidak lengkap' });
    }
    const otpData = db.prepare('SELECT * FROM otps WHERE identifier = ? AND code = ?').get(email, otp) as any;
    if (!otpData || new Date(otpData.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah kedaluwarsa' });
    }
    // Verify OTP belongs to this user
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND email = ?').get(userId, email) as any;
    if (!user) return res.status(403).json({ success: false, message: 'Akses ditolak' });
    try {
      const hashedPwd = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPwd, userId);
      db.prepare('DELETE FROM otps WHERE identifier = ?').run(email);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Submit Rating
  app.post('/api/jokies/ratings', async (req, res) => {
    const { userId, jokiesId, sessionId, stars, skillRating, attitudeRating, comment, tags, finalScreenshot } = req.body;
    try {
      // Upload screenshot to GCS if provided
      const screenshotUrl = finalScreenshot
        ? await uploadBase64ToGCS(GCS_BUCKET_BUKTI, finalScreenshot, 'ratings', `session-${sessionId}-final`)
        : finalScreenshot;

      await db.transaction(async () => {
        await db.run(
          `INSERT INTO ratings (user_id, jokies_id, session_id, stars, skill_rating, attitude_rating, comment, tags, final_screenshot)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          userId, jokiesId, sessionId, stars, skillRating, attitudeRating, comment, JSON.stringify(tags), screenshotUrl
        );

        // Reward Jokies (Not specified but good for UX)
        await db.run(
          'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
          jokiesId, 'system', 'Ulasan Terkirim', 'Terima kasih! Ulasanmu membantu KIJO membangun reputasi.'
        );

        // Admin Warning Logic
        if (stars === 1) {
          const admin = await db.get<any>("SELECT id FROM users WHERE role = 'admin'");
          if (admin) {
            await db.run(
              'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
              admin.id, 'system', 'PERINGATAN AUDIT: Bintang 1',
              `KIJO ID #${userId} mendapatkan rating Bintang 1. Segera audit riwayat pengerjaan.`
            );
          }
        }
      })();
      res.json({ success: true });
    } catch (error) {
      console.error('Rating Submission Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Rate Jokies (by Kijo)
  app.post('/api/kijo/rate-jokies', (req, res) => {
    const { kijoId, jokiesId, sessionId, tags } = req.body;
    try {
      db.transaction(() => {
        if (tags && Array.isArray(tags)) {
          for (const tag of tags) {
            const existing = db.prepare('SELECT * FROM traits WHERE user_id = ? AND trait_key = ?').get(jokiesId, tag);
            if (!existing) {
              db.prepare('INSERT INTO traits (user_id, trait_key, level, progress) VALUES (?, ?, ?, ?)').run(jokiesId, tag, 1, 100);
            }
          }
        }

        db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          jokiesId,
          'system',
          'Badge Baru Diterima!',
          `KIJO telah memberikan Anda badge reputasi baru. Cek di halaman Traits!`
        );
      })();
      res.json({ success: true });
    } catch (error) {
      console.error('Rate Jokies Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // --- ADMIN (MINOX) APIs ---

  // API: Get Admin Notifications
  app.get('/api/admin/notifications', async (req, res) => {
    try {
      const notifications = await db.prepare(`
        SELECT n.*, u.full_name as user_name
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        WHERE n.user_id IN (SELECT id FROM users WHERE role = 'admin')
        ORDER BY n.created_at DESC LIMIT 100
      `).all();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Mark all admin notifications as read
  app.post('/api/admin/notifications/read-all', async (req, res) => {
    try {
      await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id IN (SELECT id FROM users WHERE role = 'admin')").run();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get Admin Stats
  app.get('/api/admin/stats', async (req, res) => {
    try {
      let totalOmzet = { total: 0 };
      let profitAdmin = { total: 0 };

      try {
        totalOmzet = await db.prepare("SELECT SUM(total_price) as total FROM sessions WHERE status = 'completed'").get() as { total: number };
      } catch (e) {
        console.warn('Fallback: total_price column missing, trying price + admin_fee');
        try {
          totalOmzet = await db.prepare("SELECT SUM(price + admin_fee) as total FROM sessions WHERE status = 'completed'").get() as { total: number };
        } catch (e2) {
          console.warn('Fallback: admin_fee also missing, using price only');
          totalOmzet = await db.prepare("SELECT SUM(price) as total FROM sessions WHERE status = 'completed'").get() as { total: number };
        }
      }

      try {
        profitAdmin = await db.prepare("SELECT SUM(admin_fee) as total FROM sessions WHERE status = 'completed'").get() as { total: number };
      } catch (e) {
        console.warn('Fallback: admin_fee column missing, using 0');
        profitAdmin = { total: 0 };
      }

      const kijoCount = await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'kijo' AND is_suspended = 0").get() as { count: number };
      const jokiesCount = await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'jokies' AND is_suspended = 0").get() as { count: number };
      
      // Daily trends (Last 30 days)
      const dailyTrends = await db.prepare(`
        SELECT DATE(scheduled_at) as date, COUNT(*) as count
        FROM sessions
        WHERE scheduled_at IS NOT NULL
        GROUP BY date
        ORDER BY date ASC
        LIMIT 30
      `).all();

      // Hourly trends (Peak times)
      const hourlyTrends = await db.prepare(`
        SELECT DATE_FORMAT(scheduled_at, '%H') as hour, COUNT(*) as count
        FROM sessions
        WHERE scheduled_at IS NOT NULL
        GROUP BY hour
        ORDER BY hour ASC
      `).all();

      // Monthly trends (Yearly overview)
      const monthlyTrends = await db.prepare(`
        SELECT DATE_FORMAT(scheduled_at, '%Y-%m') as month, COUNT(*) as count
        FROM sessions
        WHERE scheduled_at IS NOT NULL
        GROUP BY month
        ORDER BY month ASC
      `).all();

      // Yearly trends
      const yearlyTrends = await db.prepare(`
        SELECT YEAR(scheduled_at) as year, COUNT(*) as count
        FROM sessions
        WHERE scheduled_at IS NOT NULL
        GROUP BY year
        ORDER BY year ASC
      `).all();

      const cancellationStats = await db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'cancelled'").get() as { count: number };
      
      const adminFeeSetting = await db.prepare('SELECT value FROM settings WHERE `key` = ?').get('admin_fee') as { value: string };
      const currentAdminFee = parseInt(adminFeeSetting?.value || '10');

      res.json({
        totalOmzet: totalOmzet.total || 0,
        profitAdmin: profitAdmin.total || 0,
        adminFee: currentAdminFee,
        stats: {
          kijo: kijoCount.count,
          jokies: jokiesCount.count
        },
        dailyTrends,
        hourlyTrends,
        monthlyTrends,
        yearlyTrends,
        cancellationStats: cancellationStats.count
      });
    } catch (error) {
      console.error('Admin Stats Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Get Admin Users
  app.get('/api/admin/users', async (req, res) => {
    try {
      const kijos = await db.prepare(`
        SELECT u.id, u.username, u.full_name, u.birth_date, u.is_suspended, u.is_verified,
               (SELECT AVG(stars) FROM ratings WHERE user_id = u.id) as rating
        FROM users u
        WHERE u.role = 'kijo'
      `).all();

      const jokies = await db.prepare(`
        SELECT id, username, full_name, email, is_suspended,
               (SELECT COUNT(*) FROM sessions WHERE jokies_id = users.id) as total_orders
        FROM users
        WHERE role = 'jokies'
      `).all();

      res.json({ kijos, jokies });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Suspend User
  app.post('/api/admin/users/:id/suspend', async (req, res) => {
    const { id } = req.params;
    const { suspend, adminId } = req.body;
    try {
      await db.prepare('UPDATE users SET is_suspended = ? WHERE id = ?').run(suspend ? 1 : 0, id);
      if (adminId) logAdminAction(adminId, suspend ? 'suspend_user' : 'unsuspend_user', 'users', parseInt(id), `User ID ${id} ${suspend ? 'suspended' : 'unsuspended'}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Verify Kijo Age
  app.post('/api/admin/users/:id/verify', async (req, res) => {
    const { id } = req.params;
    const { adminId } = req.body;
    try {
      await db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(id);
      if (adminId) logAdminAction(adminId, 'verify_user', 'users', parseInt(id), `User ID ${id} verified`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get Admin Sessions (Monitoring)
  app.get('/api/admin/sessions', async (req, res) => {
    try {
      const upcoming = await db.prepare("SELECT s.*, uj.full_name as jokies_name, uk.full_name as kijo_name FROM sessions s LEFT JOIN users uj ON s.jokies_id = uj.id LEFT JOIN users uk ON s.user_id = uk.id WHERE s.status = 'upcoming' ORDER BY s.scheduled_at ASC").all();
      const ongoing = await db.prepare("SELECT s.*, uj.full_name as jokies_name, uk.full_name as kijo_name FROM sessions s LEFT JOIN users uj ON s.jokies_id = uj.id LEFT JOIN users uk ON s.user_id = uk.id WHERE s.status IN ('ongoing', 'pending_completion', 'pending_cancellation') AND (s.cancel_escalated = 0 OR s.cancel_escalated IS NULL) ORDER BY s.scheduled_at ASC").all();
      const disputes = await db.prepare(`
        SELECT s.*, uj.full_name as jokies_name, uk.full_name as kijo_name
        FROM sessions s
        LEFT JOIN users uj ON s.jokies_id = uj.id
        LEFT JOIN users uk ON s.user_id = uk.id
        WHERE (s.status = 'cancelled' AND s.cancellation_reason IS NOT NULL)
          OR (s.status = 'pending_cancellation' AND s.cancel_escalated = 1)
        ORDER BY s.cancelled_at DESC
      `).all();
      const history = await db.prepare("SELECT s.*, uj.full_name as jokies_name, uk.full_name as kijo_name FROM sessions s LEFT JOIN users uj ON s.jokies_id = uj.id LEFT JOIN users uk ON s.user_id = uk.id WHERE s.status = 'completed' ORDER BY s.completed_at DESC LIMIT 50").all();

      res.json({ upcoming, ongoing, disputes, history });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get dispute chat history (for admin)
  app.get('/api/admin/sessions/:id/chat', requireAuth, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false });
    try {
      const messages = await db.prepare(`
        SELECT oc.*, u.full_name as sender_name, u.username as sender_username
        FROM order_chats oc
        LEFT JOIN users u ON oc.sender_id = u.id
        WHERE oc.session_id = ?
        ORDER BY oc.created_at ASC
        LIMIT 200
      `).all(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Admin Force Complete
  app.post('/api/admin/sessions/:id/complete', async (req, res) => {
    const { id } = req.params;
    try {
      const session = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
      if (!session) return res.status(404).json({ error: 'Session not found' });

      await db.transaction(async () => {
        await db.prepare("UPDATE sessions SET status = 'completed', completed_at = NOW() WHERE id = ?").run(id);
        
        const payoutAmount = (session.total_price || (session.price + (session.admin_fee || 0))) - (session.admin_fee || 0);
        await db.prepare('UPDATE users SET balance_active = balance_active + ? WHERE id = ?').run(payoutAmount, session.user_id);
        
        // Set Break Time
        const breakUntil = await calculateBreakUntil(session.user_id);
        if (breakUntil) {
          await db.prepare('UPDATE users SET break_until = ? WHERE id = ?').run(breakUntil, session.user_id);
        }

        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          session.user_id,
          'order_completed',
          'Pesanan Diselesaikan Admin',
          `Pesanan #${session.id} telah diselesaikan oleh Admin Minox.`
        );
      })();
      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Admin Topup Balance (Money Simulation for Testing)
  app.post('/api/admin/users/:id/topup', async (req, res) => {
    const { id } = req.params;
    const { amount, wallet_type } = req.body; // wallet_type: 'jokies' | 'kijo'
    try {
      if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Jumlah tidak valid' });
      const user = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(id) as any;
      if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

      if (wallet_type === 'jokies') {
        await db.prepare('UPDATE users SET wallet_jokies = wallet_jokies + ? WHERE id = ?').run(Number(amount), id);
      } else if (wallet_type === 'kijo') {
        await db.prepare('UPDATE users SET balance_active = balance_active + ? WHERE id = ?').run(Number(amount), id);
      } else {
        return res.status(400).json({ error: 'Tipe wallet tidak valid' });
      }

      await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
        id, 'system', 'Topup Saldo (Test)', `Admin telah menambahkan Rp ${Number(amount).toLocaleString()} ke ${wallet_type === 'jokies' ? 'Wallet Jokies' : 'Balance Kijo'} Anda.`
      );
      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Gagal topup saldo' });
    }
  });

  // API: Admin Force Start Session (Override scheduled time)
  app.post('/api/admin/sessions/:id/force-start', async (req, res) => {
    const { id } = req.params;
    try {
      const session = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
      if (session.status !== 'upcoming') return res.status(400).json({ error: 'Sesi bukan dalam status mendatang' });

      // Copy kijo account data from game_accounts if missing
      if (!session.kijo_nickname || session.kijo_nickname === '-') {
        const boostingAcc = await db.prepare(`
          SELECT nickname, game_id, id FROM game_accounts
          WHERE user_id = ? AND game_name LIKE ?
          AND account_type = 'boosting' AND deleted = 0
        `).get(session.user_id, `%${session.game_title}%`) as any;
        if (boostingAcc) {
          await db.prepare('UPDATE sessions SET kijo_nickname = ?, kijo_game_id = ?, kijo_game_account_id = ? WHERE id = ?').run(boostingAcc.nickname, boostingAcc.game_id, boostingAcc.id, id);
        }
      }

      await db.prepare("UPDATE sessions SET status = 'ongoing', started_at = NOW() WHERE id = ?").run(id);

      await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
        session.user_id, 'order_update', 'Sesi Dimulai Admin', `Admin telah memulai sesi pesanan #${id} secara manual.`
      );
      await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
        session.jokies_id, 'order_update', 'Sesi Dimulai!', `Partner telah memulai sesi untuk pesanan #${id}.`
      );

      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memulai sesi' });
    }
  });

  // API: Admin Force Cancel Session — always full refund
  app.post('/api/admin/sessions/:id/force-cancel', async (req, res) => {
    const { id } = req.params;
    try {
      const session = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
      if (!['upcoming', 'ongoing', 'pending_cancellation', 'pending_payment'].includes(session.status)) {
        return res.status(400).json({ error: 'Sesi sudah selesai atau dibatalkan' });
      }

      await db.transaction(async () => {
        await db.prepare("UPDATE sessions SET status = 'cancelled', escrow_status = 'refunded', cancelled_by = 'admin', cancelled_at = NOW(), cancellation_reason = 'Dibatalkan oleh Admin' WHERE id = ?").run(id);
        // Admin force-cancel always gives full refund (total_price)
        if (session.payment_method !== 'Simulasi') {
          await db.prepare('UPDATE users SET wallet_jokies = wallet_jokies + ? WHERE id = ?').run(session.total_price, session.jokies_id);
        }
        // Update escrow in payment_transactions
        if (session.payment_transaction_id) {
          await db.prepare("UPDATE payment_transactions SET escrow_status = 'refunded', refund_amount = ?, refunded_by = 'admin', refunded_at = NOW() WHERE id = ?")
            .run(session.total_price, session.payment_transaction_id);
        }
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          session.jokies_id, 'system', 'Pesanan Dibatalkan Admin', `Pesanan #${id} telah dibatalkan oleh Admin Minox. Refund penuh Rp ${session.total_price.toLocaleString()} telah dikembalikan ke Saldo Refund.`
        );
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          session.user_id, 'system', 'Pesanan Dibatalkan Admin', `Pesanan #${id} telah dibatalkan oleh Admin Minox.`
        );
      })();

      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Gagal membatalkan sesi' });
    }
  });

  // API: Admin Reject Cancellation (restore pending_cancellation → ongoing)
  app.post('/api/admin/sessions/:id/reject-cancel', async (req, res) => {
    const { id } = req.params;
    try {
      const session = await db.prepare("SELECT * FROM sessions WHERE id = ? AND status = 'pending_cancellation'").get(id) as any;
      if (!session) return res.status(404).json({ error: 'Tidak ada pengajuan pembatalan untuk sesi ini' });

      // Restore to previous status: upcoming if never started, otherwise ongoing
      const restoreStatus = session.started_at ? 'ongoing' : 'upcoming';
      await db.prepare("UPDATE sessions SET status = ?, cancelled_by = NULL, cancel_escalated = 0 WHERE id = ?").run(restoreStatus, id);

      await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
        session.jokies_id, 'system', 'Pembatalan Ditolak Admin', `Admin menolak pengajuan pembatalan pesanan #${id}. Sesi dilanjutkan.`
      );
      await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
        session.user_id, 'system', 'Pembatalan Ditolak Admin', `Admin menolak pengajuan pembatalan pesanan #${id}. Lanjutkan sesi.`
      );

      io.to('admin-room').emit('admin-refresh');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menolak pembatalan' });
    }
  });

  // API: Get OTP Logs
  app.get('/api/admin/otps', async (req, res) => {
    try {
      const logs = await db.prepare('SELECT * FROM otps ORDER BY created_at DESC LIMIT 100').all();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Start Chat Session (Ticket)
  app.post('/api/chat/sessions', async (req, res) => {
    const { userId } = req.body;
    try {
      // Check for existing open session
      const existing = await db.prepare("SELECT id FROM chat_sessions WHERE user_id = ? AND status = 'open'").get(userId) as any;
      if (existing) {
        return res.json({ success: true, sessionId: existing.id });
      }

      const result = await db.prepare('INSERT INTO chat_sessions (user_id, status) VALUES (?, ?)').run(userId, 'open');
      const sessionId = (result as any).insertId || (result as any).insert_id || (result as any).lastInsertRowid || 0;
      res.json({ success: true, sessionId });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Close Chat Session
  app.post('/api/chat/sessions/:id/close', async (req, res) => {
    const { id } = req.params;
    try {
      await db.prepare("UPDATE chat_sessions SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get Chat Sessions (Admin)
  app.get('/api/admin/chat-sessions', async (req, res) => {
    try {
      const sessions = await db.prepare(`
        SELECT s.*, u.username, u.full_name, u.role as user_role
        FROM chat_sessions s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
      `).all();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get Messages by Session
  app.get('/api/chat/sessions/:id/messages', (req, res) => {
    const { id } = req.params;
    try {
      const messages = db.prepare(`
        SELECT c.*, u.username as sender_name, u.role as sender_role
        FROM chats c
        JOIN users u ON c.sender_id = u.id
        WHERE c.session_id = ?
        ORDER BY c.created_at ASC
      `).all(id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Send Message in Session
  app.post('/api/chat/messages', (req, res) => {
    const { sessionId, senderId, receiverId, message } = req.body;
    try {
      db.prepare('INSERT INTO chats (session_id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)').run(sessionId, senderId, receiverId, message);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get Admin Chats
  app.get('/api/admin/chats', async (req, res) => {
    try {
      const admin = await db.prepare("SELECT id FROM users WHERE role = 'admin'").get() as any;
      if (!admin) return res.json([]);

      const chats = await db.prepare(`
        SELECT c.*, u.username as sender_name, u.role as sender_role
        FROM chats c
        JOIN users u ON c.sender_id = u.id
        WHERE c.receiver_id = ?
        ORDER BY c.created_at DESC
      `).all(admin.id);
      res.json(chats);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Send Admin Chat
  app.post('/api/admin/chats/send', async (req, res) => {
    const { receiverId, message } = req.body;
    try {
      const admin = await db.prepare("SELECT id FROM users WHERE role = 'admin'").get() as any;
      if (!admin) return res.status(403).json({ error: 'Admin not found' });

      await db.prepare('INSERT INTO chats (sender_id, receiver_id, message) VALUES (?, ?, ?)').run(admin.id, receiverId, message);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Calculate/Update Traits (Refined Logic)
  app.post('/api/kijo/traits/:userId/calculate', async (req, res) => {
    const { userId } = req.params;
    try {
      const user = await db.prepare('SELECT id, work_start, work_end, break_time FROM users WHERE id = ?').get(userId) as any;
      const completedSessions = await db.prepare("SELECT * FROM sessions WHERE user_id = ? AND status = 'completed'").all(userId) as any[];
      
      // 1. Iron Wall Logic (Tiered)
      const count = completedSessions.length;
      let ironWallLevel = 0;
      if (count >= 75) ironWallLevel = 4;
      else if (count >= 50) ironWallLevel = 3;
      else if (count >= 25) ironWallLevel = 2;
      else if (count >= 5) ironWallLevel = 1;

      if (ironWallLevel > 0) {
        await db.prepare('INSERT INTO traits (user_id, trait_key, level, progress) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE level = VALUES(level), progress = 100').run(userId, 'iron_wall', ironWallLevel, 100);
      }

      // 2. Secret Agent (100+ orders)
      if (count >= 100) {
        await db.prepare('INSERT INTO traits (user_id, trait_key, level, progress) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE level = VALUES(level), progress = 100').run(userId, 'secret_agent', 1, 100);
      }

      // 3. Early Bird / Night Owl based on work hours
      if (user.work_start) {
        const startHour = parseInt(user.work_start.split(':')[0]);
        if (startHour >= 6 && startHour <= 11) {
          await db.prepare('INSERT INTO traits (user_id, trait_key, level, progress) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE level = VALUES(level), progress = 100').run(userId, 'early_bird', 1, 100);
        } else {
          await db.prepare('DELETE FROM traits WHERE user_id = ? AND trait_key = ?').run(userId, 'early_bird');
        }
      }
      
      if (user.work_end) {
        const endHour = parseInt(user.work_end.split(':')[0]);
        if (endHour >= 22 || endHour <= 4) {
          await db.prepare('INSERT INTO traits (user_id, trait_key, level, progress) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE level = VALUES(level), progress = 100').run(userId, 'night_owl', 1, 100);
        } else {
          await db.prepare('DELETE FROM traits WHERE user_id = ? AND trait_key = ?').run(userId, 'night_owl');
        }
      }

      // 4. Trustees (Repeat Orders from same jokies)
      const repeatCustomers = await db.prepare(`
        SELECT jokies_id, COUNT(*) as count
        FROM sessions
        WHERE user_id = ? AND status = 'completed'
        GROUP BY jokies_id
        HAVING count > 1
      `).all(userId) as any[];

      if (repeatCustomers.length > 0) {
        await db.prepare('INSERT INTO traits (user_id, trait_key, level, progress) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE level = VALUES(level), progress = 100').run(userId, 'trustees', 1, 100);
      } else {
        await db.prepare('DELETE FROM traits WHERE user_id = ? AND trait_key = ?').run(userId, 'trustees');
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Trait Calculation Error:', error);
      res.status(500).json({ success: false });
    }
  });

  // API: Update Admin Settings
  app.post('/api/admin/settings', async (req, res) => {
    const { key, value, admin_fee, adminId } = req.body;
    try {
      if (admin_fee !== undefined) {
        await db.prepare('INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)').run('admin_fee', admin_fee.toString());
        if (adminId) logAdminAction(adminId, 'update_setting', 'settings', null, `Updated admin_fee to ${admin_fee}`);
      } else if (key && value !== undefined) {
        await db.prepare('INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)').run(key, value.toString());
        if (adminId) logAdminAction(adminId, 'update_setting', 'settings', null, `Updated ${key} to ${value}`);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // Helper: Audit Logging
  function logAdminAction(adminId: number, action: string, targetType: string, targetId: number | null, details: string) {
    db.prepare('INSERT INTO audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)').run(
      adminId, action, targetType, targetId, details
    ).catch((e: any) => console.error('Audit Log Error:', e));
  }

  // API: Get Audit Logs
  app.get('/api/admin/audit-logs', async (req, res) => {
    try {
      const logs = await db.prepare(`
        SELECT l.*, u.username as admin_username
        FROM audit_logs l
        JOIN users u ON l.admin_id = u.id
        ORDER BY l.created_at DESC LIMIT 100
      `).all();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get Public Announcements
  app.get('/api/announcements', async (req, res) => {
    const { role } = req.query;
    try {
      const announcements = await db.prepare(`
        SELECT * FROM announcements 
        WHERE is_active = 1 
        AND (target = 'all' OR target = ?) 
        ORDER BY created_at DESC
      `).all(role);
      res.json(Array.isArray(announcements) ? announcements : []);
    } catch (error) {
      console.error('[API] /api/announcements error:', error);
      res.json([]);
    }
  });

  // API: Get Financial Stats
  app.get('/api/admin/financials', async (req, res) => {
    try {
      const totalRevenue = await db.prepare('SELECT SUM(total_price) as total FROM sessions WHERE status = "completed"').get() as any;
      const totalProfit = await db.prepare('SELECT SUM(admin_fee) as total FROM sessions WHERE status = "completed"').get() as any;
      const pendingWithdrawals = await db.prepare('SELECT SUM(amount) as total FROM withdrawals WHERE status = "pending"').get() as any;
      const successWithdrawals = await db.prepare('SELECT SUM(amount) as total FROM withdrawals WHERE status = "success"').get() as any;

      const recentTransactions = await db.prepare(`
        SELECT t.*, u.username 
        FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        ORDER BY t.created_at DESC LIMIT 50
      `).all();

      res.json({
        totalRevenue: totalRevenue.total || 0,
        totalProfit: totalProfit.total || 0,
        pendingWithdrawals: pendingWithdrawals.total || 0,
        successWithdrawals: successWithdrawals.total || 0,
        recentTransactions
      });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get Withdrawals
  app.get('/api/admin/withdrawals', async (req, res) => {
    try {
      const withdrawals = await db.prepare(`
        SELECT w.*, u.username, u.full_name, u.role 
        FROM withdrawals w 
        JOIN users u ON w.user_id = u.id 
        ORDER BY w.created_at DESC
      `).all();
      res.json(withdrawals);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Approve Withdrawal
  app.post('/api/admin/withdrawals/:id/approve', async (req, res) => {
    const { id } = req.params;
    const { adminId } = req.body;
    try {
      await db.transaction(async () => {
        const withdrawal = await db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id) as any;
        if (!withdrawal || withdrawal.status !== 'pending') throw new Error('Invalid withdrawal');

        await db.prepare('UPDATE withdrawals SET status = "success" WHERE id = ?').run(id);
        await db.prepare('INSERT INTO transactions (user_id, type, amount, description, status) VALUES (?, ?, ?, ?, ?)').run(
          withdrawal.user_id, 'withdrawal', withdrawal.amount, `Withdrawal Success: ${withdrawal.destination}`, 'success'
        );
        
        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          withdrawal.user_id, 'system', 'Penarikan Dana Berhasil', `Penarikan dana sebesar Rp ${withdrawal.amount.toLocaleString()} telah berhasil dikirim.`
        );

        if (adminId) logAdminAction(adminId, 'approve_withdrawal', 'withdrawals', parseInt(id), `Approved withdrawal of ${withdrawal.amount}`);
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // API: Reject Withdrawal
  app.post('/api/admin/withdrawals/:id/reject', async (req, res) => {
    const { id } = req.params;
    const { adminId, reason } = req.body;
    try {
      await db.transaction(async () => {
        const withdrawal = await db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id) as any;
        if (!withdrawal || withdrawal.status !== 'pending') throw new Error('Invalid withdrawal');

        await db.prepare('UPDATE withdrawals SET status = "rejected" WHERE id = ?').run(id);
        
        // Refund balance
        const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(withdrawal.user_id) as any;
        if (user.role === 'kijo') {
          await db.prepare('UPDATE users SET balance_active = balance_active + ? WHERE id = ?').run(withdrawal.amount, withdrawal.user_id);
        } else {
          await db.prepare('UPDATE users SET wallet_jokies = wallet_jokies + ? WHERE id = ?').run(withdrawal.amount, withdrawal.user_id);
        }

        await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
          withdrawal.user_id, 'system', 'Penarikan Dana Ditolak', `Penarikan dana sebesar Rp ${withdrawal.amount.toLocaleString()} ditolak. Alasan: ${reason}`
        );

        if (adminId) logAdminAction(adminId, 'reject_withdrawal', 'withdrawals', parseInt(id), `Rejected withdrawal. Reason: ${reason}`);
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // API: Get Announcements
  app.get('/api/admin/announcements', async (req, res) => {
    try {
      const announcements = await db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();
      res.json(announcements);
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Add Announcement
  app.post('/api/admin/announcements', async (req, res) => {
    const { title, content, type, target, adminId } = req.body;
    try {
      const result = await db.prepare('INSERT INTO announcements (title, content, type, target) VALUES (?, ?, ?, ?)').run(title, content, type, target);
      const announcementId = (result as any).insertId || (result as any).insert_id || (result as any).lastInsertRowid || 0;
      if (adminId) logAdminAction(adminId, 'create_announcement', 'announcements', announcementId, `Created announcement: ${title}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Toggle Announcement
  app.post('/api/admin/announcements/:id/toggle', async (req, res) => {
    const { id } = req.params;
    const { is_active, adminId } = req.body;
    try {
      await db.prepare('UPDATE announcements SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id);
      if (adminId) logAdminAction(adminId, 'toggle_announcement', 'announcements', parseInt(id), `Toggled announcement ${id} to ${is_active}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Delete Announcement
  app.delete('/api/admin/announcements/:id', async (req, res) => {
    const { id } = req.params;
    const { adminId } = req.body;
    try {
      await db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
      if (adminId) logAdminAction(adminId, 'delete_announcement', 'announcements', parseInt(id), `Deleted announcement ${id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // API: Get User Full Details
  app.get('/api/admin/users/:id/full-details', async (req, res) => {
    const { id } = req.params;
    try {
      const user = await db.prepare('SELECT id, username, email, phone, full_name, role, balance_active, balance_held, wallet_jokies, status_ketersediaan, manual_status, is_suspended, is_verified, has_kijo_profile, verified_game, created_at FROM users WHERE id = ?').get(id) as any;
      if (!user) return res.status(404).json({ success: false });

      const orders = await db.prepare('SELECT * FROM sessions WHERE user_id = ? OR jokies_id = ? ORDER BY created_at DESC').all(id, id);
      const gameAccounts = await db.prepare('SELECT * FROM game_accounts WHERE user_id = ? AND deleted = 0').all(id);
      const transactions = await db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC').all(id);
      const withdrawals = await db.prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(id);

      res.json({
        user,
        orders,
        gameAccounts,
        transactions,
        withdrawals
      });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // ===== SYSTEM CLEARANCE =====
  app.post('/api/admin/clearance', async (req, res) => {
    try {
      const clearanceTx = db.transaction(() => {
        // Reset all non-admin user balances and status fields
        db.prepare(`
          UPDATE users
          SET balance_active = 0, balance_held = 0, wallet_jokies = 0,
              jokies_lock_until = NULL, last_refund_at = NULL, break_until = NULL,
              is_suspended = 0
          WHERE role != 'admin'
        `).run();

        // Clear all operational data
        db.prepare('DELETE FROM sessions').run();
        db.prepare('DELETE FROM transactions').run();
        db.prepare('DELETE FROM withdrawals').run();
        db.prepare('DELETE FROM ratings').run();
        db.prepare(`DELETE FROM traits WHERE user_id IN (SELECT id FROM users WHERE role != 'admin')`).run();
        db.prepare('DELETE FROM holidays').run();
        db.prepare(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE role != 'admin')`).run();
        db.prepare('DELETE FROM chat_sessions').run();
        db.prepare('DELETE FROM kijo_applications').run();
        db.prepare('DELETE FROM otps').run();
        db.prepare('DELETE FROM audit_logs').run();
      });

      clearanceTx();

      const adminId = (req as any).user?.userId;
      if (adminId) {
        logAdminAction(adminId, 'system_clearance', 'system', 0, 'Full system clearance executed: all user data reset, all operational records deleted');
      }

      res.json({ success: true, message: 'System clearance completed successfully.' });
    } catch (error) {
      console.error('[Clearance] Error:', error);
      res.status(500).json({ success: false, message: 'Clearance failed.' });
    }
  });

  // ===== ACTIVE SESSION CHECK (for floating indicator) =====
  app.get('/api/orders/active-session', requireAuth, async (req: any, res: any) => {
    const userId = req.user.userId;
    try {
      const session = await db.prepare(`
        SELECT s.id, s.title, s.status, s.game_title, s.scheduled_at, s.user_id, s.jokies_id,
               CASE WHEN s.user_id = ? THEN 'kijo' ELSE 'jokies' END as my_role
        FROM sessions s
        WHERE (s.user_id = ? OR s.jokies_id = ?)
          AND s.status IN ('ongoing', 'pending_completion')
        ORDER BY s.scheduled_at DESC
        LIMIT 1
      `).get(userId, userId, userId) as any;

      if (!session) return res.json({ hasActive: false });

      // Check for unread messages
      const unread = await db.prepare(`
        SELECT COUNT(*) as count FROM order_chats
        WHERE session_id = ? AND sender_id != ?
          AND created_at > COALESCE(
            (SELECT MAX(created_at) FROM order_chats WHERE session_id = ? AND sender_id = ?),
            '1970-01-01'
          )
      `).get(session.id, userId, session.id, userId) as any;

      res.json({
        hasActive: true,
        session: { ...session, unread_count: unread?.count || 0 }
      });
    } catch (error) {
      console.error('[active-session]', error);
      res.status(500).json({ hasActive: false });
    }
  });

  // ===== PROOF PHOTO UPDATE (Kijo uploads/changes proof photos for ongoing order) =====
  app.post('/api/kijo/update-proof', requireAuth, async (req: any, res: any) => {
    const kijoId = req.user.userId;
    const { orderId, proofBefore, proofAfter } = req.body;
    try {
      const order = await db.prepare('SELECT id, status FROM sessions WHERE id = ? AND user_id = ?').get(orderId, kijoId) as any;
      if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      if (!['ongoing', 'pending_completion'].includes(order.status)) {
        return res.status(400).json({ success: false, message: 'Bukti hanya bisa diupload saat pesanan sedang berjalan' });
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (proofBefore) {
        const url = await uploadBase64ToGCS(GCS_BUCKET_BUKTI, proofBefore, 'screenshots', `session-${orderId}-before`);
        updates.push('screenshot_start = ?');
        params.push(url);
      }
      if (proofAfter) {
        const url = await uploadBase64ToGCS(GCS_BUCKET_BUKTI, proofAfter, 'screenshots', `session-${orderId}-after`);
        updates.push('screenshot_end = ?');
        params.push(url);
      }

      if (updates.length > 0) {
        params.push(orderId);
        await db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      res.json({ success: true, message: 'Bukti pengerjaan berhasil diupdate' });
    } catch (error) {
      console.error('[update-proof]', error);
      res.status(500).json({ success: false });
    }
  });

  // ===== ORDER CHAT API =====

  // GET /api/orders/:sessionId/chat - Get chat messages for an order (paginated)
  app.get('/api/orders/:sessionId/chat', requireAuth, async (req: any, res: any) => {
    const sessionId = parseInt(req.params.sessionId, 10);
    const userId = req.user.userId;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    try {
      // Verify the session exists and user is a participant
      const session = await db.prepare('SELECT id, status, user_id, jokies_id FROM sessions WHERE id = ?').get(sessionId) as any;
      if (!session) {
        return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });
      }

      // Check that user is either kijo (user_id) or jokies (jokies_id)
      if (session.user_id !== userId && session.jokies_id !== userId) {
        return res.status(403).json({ success: false, message: 'Anda bukan peserta sesi ini' });
      }

      // Don't allow chat on pending orders
      if (session.status === 'pending') {
        return res.status(403).json({ success: false, message: 'Chat belum tersedia untuk pesanan pending' });
      }

      // Get total count
      const countRow = await db.prepare('SELECT COUNT(*) as total FROM order_chats WHERE session_id = ?').get(sessionId) as any;
      const total = countRow?.total || 0;
      const totalPages = Math.ceil(total / limit);

      // Fetch messages with sender username, avatar, read receipt — reverse pagination (newest first internally, but return ASC)
      // We offset from the end for page > 1
      const messages = await db.prepare(`
        SELECT oc.id, oc.session_id, oc.sender_id, oc.message, oc.created_at, oc.status as read_status, oc.read_at,
               u.username AS sender_username, u.avatar_url AS sender_avatar
        FROM order_chats oc
        JOIN users u ON u.id = oc.sender_id
        WHERE oc.session_id = ?
        ORDER BY oc.created_at DESC
        LIMIT ? OFFSET ?
      `).all(sessionId, limit, offset) as any[];

      // Reverse so oldest first in the returned array
      messages.reverse();

      // Check if session is locked (not in active statuses)
      const ACTIVE_STATUSES = ['upcoming', 'ongoing', 'pending_completion', 'pending_cancellation'];
      const isLocked = !ACTIVE_STATUSES.includes(session.status);

      // Get partner info
      const partnerId = session.user_id === userId ? session.jokies_id : session.user_id;
      const partner = await db.prepare('SELECT id, username, full_name, avatar_url FROM users WHERE id = ?').get(partnerId) as any;

      res.json({ success: true, messages, page, totalPages, total, isLocked, partner: partner || null });
    } catch (error) {
      console.error('[OrderChat] Error fetching messages:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil pesan chat' });
    }
  });

  // POST /api/orders/:sessionId/chat/read - Mark messages as read
  app.post('/api/orders/:sessionId/chat/read', requireAuth, async (req: any, res: any) => {
    const sessionId = parseInt(req.params.sessionId, 10);
    const userId = req.user.userId;

    try {
      const session = await db.prepare('SELECT id, user_id, jokies_id FROM sessions WHERE id = ?').get(sessionId) as any;
      if (!session) return res.status(404).json({ success: false });
      if (session.user_id !== userId && session.jokies_id !== userId) {
        return res.status(403).json({ success: false });
      }

      // Mark all unread messages from the OTHER user as read
      await db.prepare(`
        UPDATE order_chats SET status = 'read', read_at = CURRENT_TIMESTAMP
        WHERE session_id = ? AND sender_id != ? AND status != 'read'
      `).run(sessionId, userId);

      res.json({ success: true });
    } catch (error) {
      console.error('[OrderChat] Error marking read:', error);
      res.status(500).json({ success: false });
    }
  });

  // GET /api/orders/unread-chats - Get all sessions with unread messages for popup notifications
  app.get('/api/orders/unread-chats', requireAuth, async (req: any, res: any) => {
    const userId = req.user.userId;

    try {
      const unreads = await db.prepare(`
        SELECT oc.session_id, oc.message, oc.created_at,
               u.username AS sender_username, u.avatar_url AS sender_avatar, u.full_name AS sender_fullname,
               s.title AS session_title, s.status AS session_status
        FROM order_chats oc
        JOIN users u ON u.id = oc.sender_id
        JOIN sessions s ON s.id = oc.session_id
        WHERE oc.session_id IN (
          SELECT s2.id FROM sessions s2
          WHERE (s2.user_id = ? OR s2.jokies_id = ?)
            AND s2.status IN ('upcoming', 'ongoing', 'pending_completion')
        )
        AND oc.sender_id != ?
        AND oc.status != 'read'
        ORDER BY oc.created_at DESC
      `).all(userId, userId, userId) as any[];

      // Group by session, keep the latest message per session
      const grouped: Record<number, any> = {};
      for (const row of unreads) {
        if (!grouped[row.session_id]) {
          grouped[row.session_id] = {
            session_id: row.session_id,
            session_title: row.session_title,
            session_status: row.session_status,
            sender_username: row.sender_username,
            sender_avatar: row.sender_avatar,
            sender_fullname: row.sender_fullname,
            latest_message: row.message,
            latest_at: row.created_at,
            unread_count: 0
          };
        }
        grouped[row.session_id].unread_count++;
      }

      res.json({ success: true, chats: Object.values(grouped) });
    } catch (error) {
      console.error('[unread-chats] Error:', error);
      res.status(500).json({ success: false, chats: [] });
    }
  });

  // Catch-all for API routes that don't match (must be registered after all API routes)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.warn(`404 - API Route not found: ${req.method} ${req.url}`);
      return res.status(404).json({
        error: 'API route not found',
        method: req.method,
        url: req.url,
      });
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('[Vite] Failed to start middleware (likely due to port conflict). Frontend dev middleware disabled.');
      console.warn(err);
    }
  } else {
    app.use(express.static('dist'));
  }

  // --- Socket.io + HTTP Server Setup ---
  const httpServer = http.createServer(app);
  const io = new SocketServer(httpServer, { cors: { origin: '*' } });

  // ─────────────────────────────────────────────────────────────────────────
  // CONTENT CENSORSHIP — blocks contact info, off-platform solicitation,
  // hate speech, toxic language, and phishing/scam links.
  // Returns the censored string; caller is responsible for warning the user.
  // ─────────────────────────────────────────────────────────────────────────
  function censorMessage(msg: string): string {
    // Helper: case-insensitive replace with label
    const block = (pattern: RegExp, label: string) => (s: string) => s.replace(pattern, label);

    // Normalise zero-width & lookalike chars attackers use to evade filters
    let c = msg
      .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')          // zero-width chars
      .replace(/[＠]/g, '@').replace(/[．。]/g, '.')         // fullwidth lookalikes
      .replace(/\s*\.\s*/g, '.')                              // "bit . ly" → "bit.ly"
      .replace(/\s*\/\s*/g, '/');                             // "discord . gg / xyz" → linkable

    // ── 1. PHONE NUMBERS (Indonesian + international) ────────────────────
    // Indonesian mobile: 08xx, +628xx, 628xx — with any separator between digit groups
    c = c.replace(/(?:\+?62|0)[\s.\-_]?8[\s.\-_]?\d{2}[\s.\-_]?\d{3,4}[\s.\-_]?\d{3,5}/gi, '[nomor disensor]');
    // Spaced-out digits trick: "0 8 1 2 3 4 5 6 7 8 9"
    c = c.replace(/\b0[\s.\-_]?8[\s.\-_]?\d[\s.\-_]?\d[\s.\-_]?\d[\s.\-_]?\d[\s.\-_]?\d[\s.\-_]?\d[\s.\-_]?\d[\s.\-_]?\d?\b/g, '[nomor disensor]');
    // Generic international / local numbers
    c = c.replace(/(\+?\d{1,4}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,5}/g, '[nomor disensor]');

    // ── 2. WHATSAPP (extra strict — very crucial) ─────────────────────────
    c = c.replace(/\b(w\.?a\.?|w[\s_-]?a[\s_-]?|whatsapp|whatssap|whasap|wasap|watsap|wa\.?me\/?\S*|chat\.whatsapp\S*|api\.whatsapp\S*)\b/gi, '[kontak disensor]');
    c = c.replace(/\b(hubungi\s+(wa|whatsapp)|kirim\s+(wa|pesan)|dm\s+(wa)|ping\s+(wa))\b/gi, '[kontak disensor]');

    // ── 3. INSTAGRAM / TIKTOK ─────────────────────────────────────────────
    // @username mentions
    c = c.replace(/@[\w.]{2,}/g, '[akun disensor]');
    // "IG:", "ig gw", "cek bio", "follow aku", "story", "highlight"
    c = c.replace(/\b(ig|insta(gram)?|tiktok|tik\s*tok)\s*:?\s*[\w.@]*/gi, '[kontak disensor]');
    c = c.replace(/\b(cek\s*bio|follow\s*(aku|gue|gw|me)|link\s*in\s*bio|dm\s*(aku|gue|gw|me)|kirimin\s*dm)\b/gi, '[kontak disensor]');

    // ── 4. DISCORD ────────────────────────────────────────────────────────
    c = c.replace(/discord\.gg\/\S+/gi, '[link disensor]');
    c = c.replace(/\b(discord|dc)\s*(id|:|\s*gw|\s*gue|\s*aku|\.gg)\b/gi, '[kontak disensor]');
    c = c.replace(/\b(add\s*(dc|discord)|id\s*dc|dc\s*id)\b/gi, '[kontak disensor]');
    // Discord tag format: username#1234 or new username format
    c = c.replace(/\b[\w.]{2,}#\d{4}\b/g, '[akun disensor]');

    // ── 5. FACEBOOK / MESSENGER ───────────────────────────────────────────
    c = c.replace(/\b(facebook|fb\.com|m\.me\/\S*|messenger|fb\s*messenger|grup\s*fb|grup\s*facebook|page\s*fb)\b/gi, '[kontak disensor]');
    c = c.replace(/\b(add\s*(fb|facebook)|cari\s*(fb|facebook)|profil\s*fb)\b/gi, '[kontak disensor]');

    // ── 6. GENERIC SOCIAL / CONTACT PLATFORMS ────────────────────────────
    c = c.replace(/\b(telegram|tele|t\.me\/\S*|line\s*id|line\s*:?|bbm\s*:?|signal\s*:?|skype\s*:?|email\s*:?\s*[\w.+]+@[\w.]+)\b/gi, '[kontak disensor]');
    // Email addresses
    c = c.replace(/[\w.+\-]+@[\w\-]+\.[a-z]{2,}/gi, '[kontak disensor]');

    // ── 7. OFF-PLATFORM TRANSACTION SOLICITATION (VERY CRUCIAL) ──────────
    const offplatform = [
      // Direct invitations
      /\b(lewat\s*luar|di\s*luar\s*(platform|app|aplikasi)?|luar\s*platform|luar\s*app)\b/gi,
      /\b(biar\s*(gak|ga|tidak)\s*ada\s*(admin|fee|potongan))\b/gi,
      /\b(tanpa\s*(admin|platform|perantara|fee\s*platform))\b/gi,
      /\b(langsung\s*(transfer|bayar|deal|ke\s*(aku|gue|gw|saya)))\b/gi,
      /\b(direct|japri|dm\s*dulu|chat\s*pribadi|pesan\s*pribadi|kontak\s*pribadi)\b/gi,
      /\b(hubungi\s*(aku|gue|gw|saya)\s*(langsung|dulu|aja))\b/gi,
      // Price baiting
      /\b(harga\s*(diskon\s*luar|luar|murah\s*luar|di\s*luar))\b/gi,
      /\b(potongan\s*(admin|platform|fee)|admin\s*gede|fee\s*mahal|mending\s*langsung)\b/gi,
      /\b(bayar\s*(cash|tunai|langsung)\s*(aja|saja)?)\b/gi,
      // Disguised invitations  
      /\b(kita\s*(deal|transaksi)\s*(di\s*luar|pribadi|sendiri))\b/gi,
      /\b(ga\s*usah\s*pakai\s*(platform|aplikasi|app|admin))\b/gi,
      /\b(ribet\s*(pakai|pake)\s*(platform|app|aplikasi))\b/gi,
    ];
    for (const rx of offplatform) c = c.replace(rx, '[transaksi luar disensor ⚠️]');

    // ── 8. PHISHING & SCAM LINKS ─────────────────────────────────────────
    // URL shorteners / anonymous redirect services
    c = c.replace(/https?:\/\/(bit\.ly|tinyurl\.com|t\.co|ow\.ly|rb\.gy|is\.gd|cutt\.ly|short\.io|tiny\.cc|buff\.ly|adf\.ly|linktr\.ee|lnkd\.in|gg\.gg|v\.gd|clck\.ru|qr\.ae|u\.to|x\.co|shorturl\.at|go2l\.ink|2u\.pw|trib\.al|soo\.gd|mcaf\.ee|su\.pr|ff\.im|chilp\.it|twitthis\.com|u\.nu|urls\.im|forms\.gle|docs\.google\.com\/forms)[^\s]*/gi, '[link disensor]');
    // Any raw URL that is not from acinonyx's own domain
    c = c.replace(/https?:\/\/(?!acinonyx\.id|localhost)[^\s]+/gi, '[link disensor]');
    // bare domain.tld patterns that evade the URL filter
    c = c.replace(/\b(?!acinonyx\.id)\w[\w-]{1,62}\.(com|net|org|xyz|top|gg|io|me|info|biz|co|id|site|online|shop|store|click|link|space|live|fun|pw|cc|tk|ml|ga|cf|gq)\b(?:\/\S*)?/gi, '[link disensor]');
    // Image URLs and data URIs
    c = c.replace(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|bmp|svg)/gi, '[gambar disensor]');
    c = c.replace(/data:image\/[^;]+;base64,[^\s]+/gi, '[gambar disensor]');
    c = c.replace(/https?:\/\/(imgur\.com|postimg|ibb\.co|prnt\.sc)[^\s]*/gi, '[gambar disensor]');

    // ── 9. HATE SPEECH (SARA) ────────────────────────────────────────────
    const sara = [
      /\b(kafir|anjing\s*kafir|bangsat\s*china|cina\s*b+a+n+g+s+a+t|pribumi|aseng|babi\s*(kafir|cina)|go\s*home\s*(chinese|cina)|usir\s*(cina|kafir)|dasar\s*(kafir|cina|bule|negro|hitam))\b/gi,
      /\b(rasis|rasisme|diskriminasi\s*(ras|agama|suku))\b/gi,
    ];
    for (const rx of sara) c = c.replace(rx, '[ujaran kebencian disensor]');

    // ── 10. TOXIC GAMING & PROFANITY (Indonesian) ────────────────────────
    // Swear words — asterisked internally but labelled for the log
    const profanity = [
      // Core profanity
      /\b(a+n+j+i+n+g+|a+n+j+e+n+g+|a+n+j+a+y+|e+n+j+i+n+g+|a+n+g+s+i+n+g+)\b/gi,
      /\b(b+a+n+g+s+a+t+|b+e+n+g+s+e+t+|b+a+n+g+s+e+t+)\b/gi,
      /\b(k+o+n+t+o+l+|m+e+m+e+k+|p+e+l+i+r+|t+o+k+e+l+|t+o+k+i+l+)\b/gi,
      /\b(j+a+n+c+o+k+|j+a+n+c+u+k+|j+a+n+c+i+k+|j+a+n+c+u+k+)\b/gi,
      /\b(g+o+b+l+o+k+|g+o+b+l+o+g+|t+o+l+o+l+|k+o+n+t+o+l+)\b/gi,
      /\b(b+o+d+o+h+|i+d+i+o+t+|s+i+a+l+|c+e+l+a+k+a+)\b/gi,
      /\b(b+a+j+i+n+g+a+n+|p+e+n+j+a+h+a+t+|k+e+p+a+r+a+t+)\b/gi,
      /\b(m+e+m+e+k+|p+u+k+i+m+a+k+|c+o+n+t+o+l+)\b/gi,
      /\b(s+i+a+l+a+n+|k+u+t+u+k+|b+e+r+e+n+g+s+e+k+)\b/gi,
      /\b(a+s+u+|a+s+w+|b+i+a+n+g+k+e+l+a+d+i+)\b/gi,
      // Toxic gaming phrases
      /\b(n+o+o+b+|n+u+b+|b+o+t+\s*l+u+|u+s+e+l+e+s+s+|k+e+l+u+a+r+\s*d+o+n+g+k+o+l+|k+e+l+u+a+r+\s*n+o+o+b+)\b/gi,
      /\b(r+e+p+o+r+t+\s*[\w\s]*n+o+o+b+|m+a+k+i+n+g+\s*t+e+a+m+\s*l+o+s+e+)\b/gi,
      // "kill yourself" equivalents in Indonesian
      /\b(m+a+t+i+\s*(a+j+a+|s+a+j+a+|s+i+k+a+n+)|m+a+t+i+i+n+\s+d+i+r+i+|b+u+n+u+h+\s+d+i+r+i+)\b/gi,
    ];
    for (const rx of profanity) c = c.replace(rx, '[kata kasar disensor]');

    return c;
  }

  io.on('connection', (socket) => {
    socket.on('join-order-chat', (sessionId: string) => {
      socket.join(`order-chat-${sessionId}`);
    });

    socket.on('leave-order-chat', (sessionId: string) => {
      socket.leave(`order-chat-${sessionId}`);
    });

    socket.on('join-admin-room', () => {
      socket.join('admin-room');
    });

    socket.on('leave-admin-room', () => {
      socket.leave('admin-room');
    });

    socket.on('send-order-message', async (data: { sessionId: number; senderId: number; message: string; tempId?: number }) => {
      const emitError = (reason: string) => {
        socket.emit('message-error', { tempId: data.tempId, reason });
      };
      try {
        // Only allow chat on active sessions (whitelist approach)
        const session = await db.prepare('SELECT id, status, user_id, jokies_id FROM sessions WHERE id = ?').get(data.sessionId) as any;
        if (!session) return emitError('Sesi tidak ditemukan');
        const ACTIVE_STATUSES = ['upcoming', 'ongoing', 'pending_completion', 'pending_cancellation'];
        if (!ACTIVE_STATUSES.includes(session.status)) return emitError('Chat tidak tersedia untuk sesi ini');
        // Verify sender is a participant
        if (session.user_id !== data.senderId && session.jokies_id !== data.senderId) return emitError('Anda bukan peserta sesi ini');

        // Censor content
        const censored = censorMessage(data.message);
        // Save to DB — try with status column first, fall back without it (handles missing column)
        let result: any;
        try {
          result = await db.prepare("INSERT INTO order_chats (session_id, sender_id, message, status) VALUES (?, ?, ?, 'sent')").run(data.sessionId, data.senderId, censored);
        } catch (insertErr: any) {
          if (String(insertErr?.message).includes('status')) {
            // status column not yet migrated — insert without it
            result = await db.prepare('INSERT INTO order_chats (session_id, sender_id, message) VALUES (?, ?, ?)').run(data.sessionId, data.senderId, censored);
          } else {
            throw insertErr;
          }
        }
        const msgId: number = result?.insertId || result?.insert_id || result?.lastInsertRowid || 0;
        if (!msgId) { emitError('Gagal menyimpan pesan'); return; }

        // Get sender info for popup notification
        const sender = await db.prepare('SELECT username, avatar_url, full_name FROM users WHERE id = ?').get(data.senderId) as any;

        // Broadcast to room — include tempId so sender can replace optimistic bubble
        io.to(`order-chat-${data.sessionId}`).emit('new-order-message', {
          id: msgId,
          tempId: data.tempId,   // echoed back so sender replaces their optimistic msg
          session_id: data.sessionId,
          sender_id: data.senderId,
          sender_username: sender?.username || '',
          sender_avatar: sender?.avatar_url || null,
          message: censored,
          read_status: 'sent',
          read_at: null,
          created_at: new Date().toISOString()
        });

        // Emit notification event for the OTHER participant (for mobile popup)
        const recipientId = session.user_id === data.senderId ? session.jokies_id : session.user_id;
        io.to(`user-${recipientId}`).emit('chat-notification', {
          session_id: data.sessionId,
          sender_username: sender?.username || '',
          sender_avatar: sender?.avatar_url || null,
          sender_fullname: sender?.full_name || '',
          message: censored,
          created_at: new Date().toISOString(),
          session_title: '' // Client can fill from local state
        });

        // Mark as delivered if recipient is in the room
        const room = io.sockets.adapter.rooms.get(`order-chat-${data.sessionId}`);
        if (room && room.size > 1) {
          await db.prepare("UPDATE order_chats SET status = 'delivered' WHERE id = ?").run(msgId);
          io.to(`order-chat-${data.sessionId}`).emit('message-status-update', {
            message_id: msgId,
            status: 'delivered'
          });
        }
      } catch (err) {
        console.error('[OrderChat] Error sending message:', err);
        socket.emit('message-error', { tempId: data.tempId, reason: 'Gagal mengirim pesan' });
      }
    });

    // Mark messages as read via socket (real-time receipt)
    socket.on('mark-read', async (data: { sessionId: number; userId: number }) => {
      try {
        const updated = await db.prepare(`
          UPDATE order_chats SET status = 'read', read_at = CURRENT_TIMESTAMP
          WHERE session_id = ? AND sender_id != ? AND status != 'read'
        `).run(data.sessionId, data.userId) as any;

        if (updated.changes > 0 || updated.affectedRows > 0) {
          io.to(`order-chat-${data.sessionId}`).emit('messages-read', {
            session_id: data.sessionId,
            reader_id: data.userId
          });
        }
      } catch (err) {
        console.error('[OrderChat] Error marking read:', err);
      }
    });

    // Join personal notification room
    socket.on('join-user-room', (userId: string) => {
      socket.join(`user-${userId}`);
    });

    socket.on('leave-user-room', (userId: string) => {
      socket.leave(`user-${userId}`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKGROUND CRON JOB — runs every 2 minutes
  // Handles auto-start, auto-cancel, auto-complete, and payment reconciliation
  // across ALL sessions globally (not dependent on user page visits)
  // ═══════════════════════════════════════════════════════════════════════════
  let cronRunning = false;
  const CRON_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

  async function runCronTasks() {
    if (cronRunning) return; // Prevent overlapping runs
    cronRunning = true;
    const cronStart = Date.now();

    try {
      const now = new Date();
      const nowIso = now.toISOString();

      // ── 1. Auto-start: upcoming sessions whose scheduled_at has passed ──
      try {
        const toStart = (await db.prepare(
          "SELECT id, user_id, jokies_id FROM sessions WHERE status = 'upcoming' AND scheduled_at <= ?"
        ).all(nowIso)) as any[];
        for (const s of toStart) {
          await db.prepare("UPDATE sessions SET status = 'ongoing', started_at = NOW() WHERE id = ? AND status = 'upcoming'").run(s.id);
        }
        if (toStart.length > 0) console.log(`[Cron] Auto-started ${toStart.length} session(s)`);
      } catch (e) {
        console.error('[Cron] Auto-start error:', e);
      }

      // ── 2. Auto-cancel: upcoming sessions past scheduled_at + duration (never started) ──
      try {
        const upcoming = (await db.prepare(
          "SELECT id, jokies_id, total_price, duration, scheduled_at FROM sessions WHERE status = 'upcoming'"
        ).all()) as any[];
        let cancelCount = 0;
        for (const s of upcoming) {
          const end = new Date(new Date(s.scheduled_at).getTime() + (s.duration || 1) * 60 * 60 * 1000);
          if (now > end) {
            await db.transaction(async () => {
              await db.prepare("UPDATE sessions SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'system', cancellation_reason = 'Otomatis dibatalkan: melewati waktu booking + durasi tanpa dimulai' WHERE id = ? AND status = 'upcoming'").run(s.id);
              if (s.jokies_id && s.total_price) {
                await db.prepare('UPDATE users SET wallet_jokies = wallet_jokies + ? WHERE id = ?').run(s.total_price, s.jokies_id);
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  s.jokies_id, 'order_update', 'Pesanan Dibatalkan Otomatis',
                  `Pesanan #${s.id} dibatalkan otomatis karena melewati waktu booking. Dana Rp ${(s.total_price || 0).toLocaleString()} dikembalikan ke wallet Anda.`
                );
              }
            })();
            cancelCount++;
          }
        }
        if (cancelCount > 0) console.log(`[Cron] Auto-cancelled ${cancelCount} expired upcoming session(s)`);
      } catch (e) {
        console.error('[Cron] Auto-cancel upcoming error:', e);
      }

      // ── 3. Auto-cancel: pending_payment sessions older than 20 min (15 mid + 5 buffer) ──
      try {
        const pending = (await db.prepare(
          "SELECT id, jokies_id, created_at FROM sessions WHERE status = 'pending_payment'"
        ).all()) as any[];
        let expireCount = 0;
        for (const s of pending) {
          const createdAt = new Date(s.created_at).getTime();
          if (now.getTime() - createdAt > PAYMENT_TIMEOUT_MS) {
            await db.transaction(async () => {
              await db.prepare("UPDATE sessions SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'system', cancellation_reason = 'Otomatis dibatalkan: pembayaran tidak diselesaikan dalam waktu yang ditentukan' WHERE id = ? AND status = 'pending_payment'").run(s.id);
              await db.prepare("UPDATE payment_transactions SET payment_status = 'expire', escrow_status = 'none', updated_at = NOW() WHERE session_id = ? AND payment_status = 'pending'").run(s.id);
              if (s.jokies_id) {
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  s.jokies_id, 'order_update', 'Pembayaran Kedaluwarsa',
                  `Pesanan #${s.id} dibatalkan otomatis karena pembayaran tidak diselesaikan dalam waktu yang ditentukan.`
                );
              }
            })();
            expireCount++;
          }
        }
        if (expireCount > 0) console.log(`[Cron] Auto-cancelled ${expireCount} expired pending_payment session(s)`);
      } catch (e) {
        console.error('[Cron] Auto-cancel pending_payment error:', e);
      }

      // ── 4. Auto-complete: ongoing sessions past scheduled_at + duration ──
      try {
        const ongoing = (await db.prepare(
          "SELECT id, user_id, jokies_id, scheduled_at, duration, screenshot_start, screenshot_end, total_price, price, admin_fee, escrow_status, payment_transaction_id FROM sessions WHERE status = 'ongoing'"
        ).all()) as any[];
        let completeCount = 0;
        let pendingCount = 0;
        for (const s of ongoing) {
          const endTime = new Date(new Date(s.scheduled_at).getTime() + (s.duration || 1) * 60 * 60 * 1000);
          if (now > endTime) {
            const hasProofs = !!(s.screenshot_start && s.screenshot_end);
            await db.transaction(async () => {
              if (hasProofs) {
                // Auto-complete with escrow release
                await db.prepare("UPDATE sessions SET status = 'completed', completed_at = NOW(), kijo_finished = 1, jokies_finished = 1, escrow_status = 'released' WHERE id = ? AND status = 'ongoing'").run(s.id);
                const kijoEarnings = s.price || (s.total_price - (s.admin_fee || 0));
                await db.prepare('UPDATE users SET balance_active = balance_active + ? WHERE id = ?').run(kijoEarnings, s.user_id);
                if (s.payment_transaction_id) {
                  await db.prepare("UPDATE payment_transactions SET escrow_status = 'released', released_at = NOW(), updated_at = NOW() WHERE id = ?").run(s.payment_transaction_id);
                }
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  s.user_id, 'order_update', 'Pesanan Selesai Otomatis',
                  `Pesanan #${s.id} telah diselesaikan otomatis. Dana Rp ${(kijoEarnings || 0).toLocaleString()} dicairkan ke Saldo Aktif Anda.`
                );
                if (s.jokies_id) {
                  await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                    s.jokies_id, 'order_update', 'Pesanan Selesai Otomatis',
                    `Pesanan #${s.id} telah diselesaikan otomatis karena durasi sesi telah selesai.`
                  );
                }
                completeCount++;
              } else {
                // No proofs — move to pending_completion
                await db.prepare("UPDATE sessions SET status = 'pending_completion', kijo_finished = 0 WHERE id = ? AND status = 'ongoing'").run(s.id);
                await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                  s.user_id, 'order_update', 'Sesi Selesai — Unggah Bukti',
                  `Durasi pesanan #${s.id} telah berakhir. Silakan unggah bukti pengerjaan (Sebelum & Sesudah) agar dana dapat dicairkan.`
                );
                if (s.jokies_id) {
                  await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                    s.jokies_id, 'order_update', 'Durasi Sesi Berakhir',
                    `Durasi pesanan #${s.id} telah berakhir. Menunggu Partner mengunggah bukti pengerjaan.`
                  );
                }
                pendingCount++;
              }
            })();
          }
        }
        if (completeCount > 0) console.log(`[Cron] Auto-completed ${completeCount} session(s) with proofs`);
        if (pendingCount > 0) console.log(`[Cron] Moved ${pendingCount} session(s) to pending_completion (no proofs)`);
      } catch (e) {
        console.error('[Cron] Auto-complete error:', e);
      }

      // ── 5. Payment reconciliation: verify pending payments with Midtrans API ──
      // Catches stuck pending_payment orders where webhook never arrived
      if (MIDTRANS_SERVER_KEY) {
        try {
          const stuckPayments = (await db.prepare(
            "SELECT pt.id, pt.order_id, pt.session_id, pt.jokies_id, pt.kijo_id, pt.total_amount, pt.payment_type, s.status as session_status, s.created_at FROM payment_transactions pt JOIN sessions s ON pt.session_id = s.id WHERE pt.payment_status = 'pending' AND s.created_at < ?"
          ).all(new Date(now.getTime() - 5 * 60 * 1000).toISOString())) as any[]; // Only check payments older than 5 min

          const authString = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');
          let reconCount = 0;

          for (const p of stuckPayments) {
            try {
              const mtRes = await fetch(`${MIDTRANS_API_URL}/${p.order_id}/status`, {
                headers: { 'Authorization': `Basic ${authString}`, 'Content-Type': 'application/json' },
              });
              if (!mtRes.ok) continue;

              const mtData = await mtRes.json() as any;
              const txnStatus = mtData.transaction_status;

              if (txnStatus === 'settlement' || (txnStatus === 'capture' && mtData.fraud_status === 'accept')) {
                await db.transaction(async () => {
                  await db.prepare("UPDATE payment_transactions SET payment_status = 'settlement', escrow_status = 'held', settled_at = NOW(), payment_type = ?, midtrans_transaction_id = ?, raw_notification = ? WHERE id = ?")
                    .run(mtData.payment_type || 'Midtrans', mtData.transaction_id || null, JSON.stringify(mtData), p.id);

                  const currentSession = await db.prepare('SELECT status FROM sessions WHERE id = ?').get(p.session_id) as any;
                  if (currentSession?.status === 'pending_payment') {
                    await db.prepare("UPDATE sessions SET status = 'upcoming', escrow_status = 'held', payment_method = ? WHERE id = ?")
                      .run(mtData.payment_type || 'Midtrans', p.session_id);
                  } else if (currentSession?.status === 'cancelled') {
                    await db.prepare("UPDATE sessions SET status = 'upcoming', escrow_status = 'held', payment_method = ?, cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL WHERE id = ?")
                      .run(mtData.payment_type || 'Midtrans', p.session_id);
                  }

                  const session = await db.prepare('SELECT title FROM sessions WHERE id = ?').get(p.session_id) as any;
                  await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                    p.kijo_id, 'order_new', 'Pesanan Baru!',
                    `Anda menerima pesanan baru: ${session?.title || 'Pesanan'}. ID Pesanan: #${p.session_id}`
                  );
                  await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
                    p.jokies_id, 'system', 'Pembayaran Berhasil!',
                    `Pembayaran untuk pesanan #${p.session_id} sebesar Rp ${p.total_amount.toLocaleString()} berhasil. Dana ditahan dalam Escrow.`
                  );
                })();
                reconCount++;
                console.log('[Cron] Reconciled payment for session:', p.session_id, 'order:', p.order_id);
              } else if (['deny', 'cancel', 'expire'].includes(txnStatus)) {
                // Midtrans confirmed failed — ensure session is cancelled
                await db.transaction(async () => {
                  await db.prepare('UPDATE payment_transactions SET payment_status = ? WHERE id = ?').run(txnStatus, p.id);
                  await db.prepare("UPDATE sessions SET status = 'cancelled', cancelled_by = 'system', cancellation_reason = ?, cancelled_at = NOW() WHERE id = ? AND status = 'pending_payment'")
                    .run(`Pembayaran ${txnStatus}`, p.session_id);
                })();
              }
            } catch (e) {
              // Skip individual payment errors, continue with others
            }
          }
          if (reconCount > 0) console.log(`[Cron] Reconciled ${reconCount} stuck payment(s)`);
        } catch (e) {
          console.error('[Cron] Payment reconciliation error:', e);
        }
      }

      // ── 6. Rating reminder: completed orders >24h without rating ──
      try {
        const unrated = (await db.prepare(`
          SELECT s.id, s.jokies_id, s.user_id, u.full_name as kijo_name
          FROM sessions s
          LEFT JOIN users u ON s.user_id = u.id
          WHERE s.status = 'completed'
            AND s.completed_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND s.completed_at > DATE_SUB(NOW(), INTERVAL 25 HOUR)
            AND NOT EXISTS (SELECT 1 FROM ratings r WHERE r.session_id = s.id)
            AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = s.jokies_id AND n.title = 'Jangan Lupa Beri Rating!' AND n.message LIKE CONCAT('%#', s.id, '%'))
        `).all()) as any[];
        for (const s of unrated) {
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            s.jokies_id, 'system', 'Jangan Lupa Beri Rating!',
            `Pesanan #${s.id} dengan ${s.kijo_name || 'Partner'} sudah selesai. Beri rating untuk membantu Kijo membangun reputasi!`
          );
        }
        if (unrated.length > 0) console.log(`[Cron] Sent ${unrated.length} rating reminder(s)`);
      } catch (e) {
        console.error('[Cron] Rating reminder error:', e);
      }

      // ── 7. Kijo auto-off: 3+ system-cancelled orders in 30 days → set unavailable ──
      try {
        const badKijos = (await db.prepare(`
          SELECT s.user_id, COUNT(*) as miss_count
          FROM sessions s
          JOIN users u ON s.user_id = u.id AND u.role = 'kijo' AND u.status_ketersediaan != 'tidak_tersedia'
          WHERE s.status = 'cancelled'
            AND s.cancelled_by = 'system'
            AND s.cancelled_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY s.user_id
          HAVING miss_count >= 3
        `).all()) as any[];
        for (const k of badKijos) {
          await db.prepare("UPDATE users SET status_ketersediaan = 'tidak_tersedia' WHERE id = ?").run(k.user_id);
          await db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            k.user_id, 'system', 'Status Dinonaktifkan',
            `Status ketersediaan Anda dinonaktifkan otomatis karena ${k.miss_count} pesanan terlewat dalam 30 hari terakhir. Aktifkan kembali jika sudah siap menerima pesanan.`
          );
        }
        if (badKijos.length > 0) console.log(`[Cron] Auto-disabled ${badKijos.length} Kijo(s) for missed orders`);
      } catch (e) {
        console.error('[Cron] Kijo auto-off error:', e);
      }

    } catch (e) {
      console.error('[Cron] Fatal error in cron tasks:', e);
    } finally {
      cronRunning = false;
      const elapsed = Date.now() - cronStart;
      if (elapsed > 10000) console.warn(`[Cron] Tasks took ${elapsed}ms (>10s) — consider optimization`);
    }
  }

  // Start the cron interval
  setInterval(runCronTasks, CRON_INTERVAL_MS);
  // Run once at startup after a short delay (let server finish init)
  setTimeout(runCronTasks, 5000);
  console.log(`[Cron] Background tasks scheduled every ${CRON_INTERVAL_MS / 1000}s`);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server error:', err);
  // Keep process alive if possible (unhandled errors will still exit), but log for debugging.
});

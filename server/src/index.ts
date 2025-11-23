import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
// simple request logger to help debug 404s
app.use((req, _res, next) => {
  try {
    console.log(`--> ${req.method} ${req.path}`);
  } catch (e) {
    // ignore
  }
  next();
});

// log all incoming requests (method + url) for debugging
app.use((req, _res, next) => {
  try {
    // eslint-disable-next-line no-console
    console.log('[REQ]', req.method, req.originalUrl || req.url);
  } catch (e) {
    // ignore
  }
  next();
});

// ensure uploads folder exists for legacy files served statically
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET || '',
  secure: true,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

async function uploadToCloudinary(file: Express.Multer.File): Promise<UploadApiResponse> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY || process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials are not configured');
  }

  const folder = process.env.CLOUDINARY_FOLDER || 'campusconnect/uploads';
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (error || !result) return reject(error || new Error('No upload result'));
        resolve(result);
      }
    );
    stream.end(file.buffer);
  });
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campusconnect';
const PORT = process.env.PORT || 4000;

// Simple health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Test route
app.get('/api/test/:id', (req, res) => {
  console.log('TEST ROUTE HIT with id:', req.params.id);
  res.json({ id: req.params.id, message: 'Test route works!' });
});

// Schemas
const NoticeSchema = new mongoose.Schema(
  {
    title: String,
    department: String,
    year: String,
    type: String, // Exam, Event, General
    content: String,
    attachmentUrl: String,
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const LostFoundSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    location: String,
    contact: String,
    imageUrl: String,
    status: { type: String, default: 'Active' }, // Active, Claimed
    date: { type: Date, default: Date.now },
    reportedByEmail: String,
  },
  { timestamps: true }
);

const ResourceSchema = new mongoose.Schema(
  {
    title: String,
    department: String,
    subject: String,
    year: String,
    tags: [String],
    url: String, // PDF URL
    popularity: { type: Number, default: 0 },
    school: String,
  },
  { timestamps: true }
);

const EventSchema = new mongoose.Schema(
  {
    title: String,
    date: String,
    location: String,
    organizer: String,
    description: String, // This will be used for "notes"
    imageUrl: String,
    timings: String,
    school: String,
    createdByEmail: String,
  },
  { timestamps: true }
);

// Study Groups
const GroupSchema = new mongoose.Schema(
  {
    name: String,
    subject: String,
    createdByEmail: String,
    createdByDesignation: String,
    school: String,
    status: { type: String, default: 'Approved' }, // 'Pending' | 'Approved'
    members: [String],
    messages: [
      {
        sender: String,
        content: String,
        imageUrl: String,
        fileUrl: String,
        fileName: String,
        fileType: String,
        createdAt: { type: Date, default: Date.now },
      }
    ]
  },
  { timestamps: true }
);

const Notice = mongoose.model('Notice', NoticeSchema);
const LostFound = mongoose.model('LostFound', LostFoundSchema);
const Resource = mongoose.model('Resource', ResourceSchema);
const Event = mongoose.model('Event', EventSchema);
const Group = mongoose.model('Group', GroupSchema);

// Users
const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: { type: String, required: true },
  name: { type: String },
  phone: { type: String },
  designation: { type: String },
  school: { type: String },
  photoUrl: { type: String },
}, { timestamps: true });
const User = mongoose.model('User', UserSchema);

// CRUD endpoints (basic)
app.get('/api/notices', async (req, res) => {
  const { department, year, type, q } = req.query as any;
  const query: any = {};
  if (department) query.department = department;
  if (year) query.year = year;
  if (type) query.type = type;
  if (q) query.$text = { $search: q };
  const items = await Notice.find(query).sort({ createdAt: -1 });
  res.json(items);
});
app.post('/api/notices', async (req, res) => {
  const created = await Notice.create(req.body);
  res.status(201).json(created);
});

app.get('/api/lostfound', async (_req, res) => {
  const items = await LostFound.find().sort({ createdAt: -1 });
  res.json(items);
});
app.post('/api/lostfound', async (req, res) => {
  const created = await LostFound.create(req.body);
  res.status(201).json(created);
});
app.delete('/api/lostfound/:id', async (req, res) => {
  const { reporter } = req.query as any;
  const item = await LostFound.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (reporter && item.reportedByEmail && reporter !== item.reportedByEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await LostFound.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
app.patch('/api/lostfound/:id/claim', async (req, res) => {
  const updated = await LostFound.findByIdAndUpdate(
    req.params.id,
    { status: 'Claimed' },
    { new: true }
  );
  res.json(updated);
});

app.get('/api/resources', async (req, res) => {
  const { q, subject, year, school } = req.query as any;
  const query: any = {};
  if (subject) query.subject = subject;
  if (year) query.year = year;
  if (school) query.school = school;
  if (q) query.$text = { $search: q };
  const items = await Resource.find(query).sort({ createdAt: -1 });
  res.json(items);
});
app.post('/api/resources', async (req, res) => {
  const created = await Resource.create(req.body);
  res.status(201).json(created);
});

// Simple auth endpoints (signup/login) for demo purposes
app.post('/api/signup', async (req, res) => {
  const { email, password, name, phone, designation, school, photoUrl } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  if (!name || !phone || !designation || !school) return res.status(400).json({ error: 'Missing required fields' });
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: 'Exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash: hash, name, phone, designation, school, photoUrl });
  res.status(201).json({ email: user.email, name: user.name, phone: user.phone, designation: user.designation, school: user.school, photoUrl: user.photoUrl });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing' });
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid' });
  res.json({ email: user.email, name: user.name, phone: user.phone, designation: user.designation, school: user.school, photoUrl: user.photoUrl });
});

// User profile endpoints
app.get('/api/user/profile', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ email: user.email, name: user.name, phone: user.phone, designation: user.designation, school: user.school, photoUrl: user.photoUrl });
});

app.patch('/api/user/profile', async (req, res) => {
  const { email, name, phone, designation, school, photoUrl } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (designation !== undefined) user.designation = designation;
  if (school !== undefined) user.school = school;
  if (photoUrl !== undefined) user.photoUrl = photoUrl;
  await user.save();
  res.json({ email: user.email, name: user.name, phone: user.phone, designation: user.designation, school: user.school, photoUrl: user.photoUrl });
});

app.post('/api/user/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  if (!email || !currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Incorrect current password' });

  const hash = await bcrypt.hash(newPassword, 10);
  user.passwordHash = hash;
  await user.save();

  res.json({ ok: true });
});

// upload endpoint: accepts multipart/form-data 'file' and returns { url }
app.post('/api/upload', upload.single('file'), async (req, res) => {
  console.log('Upload request received');
  console.log('Headers:', req.headers);
  const file = (req as Request & { file?: Express.Multer.File }).file;
  console.log('File:', file ? { filename: file.originalname, mimetype: file.mimetype, size: file.size } : 'NO FILE');
  if (!file) return res.status(400).json({ error: 'No file provided' });
  try {
    console.log('Attempting Cloudinary upload...');
    const result = await uploadToCloudinary(file);
    console.log('Upload successful:', result.secure_url);
    return res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) {
    console.error('Cloudinary upload failed', error);
    return res.status(500).json({ error: 'Upload failed', details: error instanceof Error ? error.message : String(error) });
  }
});

// Study Groups API
app.get('/api/groups/:id', async (req, res) => {
  console.log('GET /api/groups/:id hit with id:', req.params.id);
  const g = await Group.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  res.json(g);
});

app.get('/api/groups', async (req, res) => {
  const { status, school, createdByEmail } = req.query as any;
  const query: any = {};
  if (status) query.status = status;
  if (school) query.school = school;
  if (createdByEmail) query.createdByEmail = createdByEmail;

  const items = await Group.find(query).sort({ createdAt: -1 });
  res.json(items);
});

app.post('/api/groups', async (req, res) => {
  const { name, subject, createdByEmail, createdByDesignation, school } = req.body;

  // If student creates, status is Pending. If teacher, Approved.
  const status = createdByDesignation === 'Teacher' ? 'Approved' : 'Pending';

  const created = await Group.create({
    name,
    subject,
    createdByEmail,
    createdByDesignation,
    school,
    status,
    members: [createdByEmail],
    messages: []
  });
  res.status(201).json(created);
});

app.patch('/api/groups/:id/approve', async (req, res) => {
  const { action } = req.body; // 'approve' | 'reject'

  if (action === 'reject') {
    await Group.findByIdAndDelete(req.params.id);
    return res.json({ ok: true, action: 'rejected' });
  }

  const g = await Group.findByIdAndUpdate(
    req.params.id,
    { status: 'Approved' },
    { new: true }
  );
  res.json(g);
});

app.post('/api/groups/:id/join', async (req, res) => {
  const { email } = req.body;
  const g = await Group.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { members: email } },
    { new: true }
  );
  res.json(g);
});

app.post('/api/groups/:id/leave', async (req, res) => {
  const { email } = req.body;
  const g = await Group.findByIdAndUpdate(
    req.params.id,
    { $pull: { members: email } },
    { new: true }
  );
  res.json(g);
});

app.post('/api/groups/:id/messages', async (req, res) => {
  const { sender, content, imageUrl, fileUrl, fileName, fileType } = req.body;
  if (!sender || (!content && !imageUrl && !fileUrl)) return res.status(400).json({ error: 'Missing sender or content/image/file' });

  const g = await Group.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        messages: { sender, content, imageUrl, fileUrl, fileName, fileType, createdAt: new Date() }
      }
    },
    { new: true }
  );
  res.json(g);
});

app.delete('/api/groups/:id', async (req, res) => {
  const { requester } = req.query as any;
  const g = await Group.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  if (requester && g.createdByEmail && requester !== g.createdByEmail) return res.status(403).json({ error: 'Forbidden' });
  await Group.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.get('/api/events', async (req, res) => {
  const { school } = req.query as any;
  const query: any = {};
  if (school) query.school = school;

  const items = await Event.find(query).sort({ date: 1 });
  res.json(items);
});

app.post('/api/events', async (req, res) => {
  const { title, date, location, organizer, description, imageUrl, timings, school, createdByEmail } = req.body;

  const created = await Event.create({
    title,
    date,
    location,
    organizer,
    description,
    imageUrl,
    timings,
    school,
    createdByEmail
  });
  res.status(201).json(created);
});

async function start() {
  await mongoose.connect(MONGO_URI);
  // print registered routes for debugging
  try {
    // some Express builds keep router on app._router
    // collect route informations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const routes: Array<{ path: string; methods: string[] }> = [];
    // @ts-ignore
    const stack = app._router && app._router.stack ? app._router.stack : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stack.forEach((layer: any) => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods || {});
        routes.push({ path: layer.route.path, methods });
      }
    });
    console.log('Registered routes:', JSON.stringify(routes, null, 2));
  } catch (e) {
    console.warn('Could not enumerate routes', e);
  }

  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});

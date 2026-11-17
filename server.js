import { createServer } from 'node:http';
import { createReadStream, mkdirSync, unlinkSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Automatically load .env if present
function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn('Warning: Could not parse .env file:', err.message);
  }
}
loadEnv();

const STATIC_DIR = resolve(ROOT, 'public');
const DATA_DIR = resolve(process.env.DATA_DIR || join(ROOT, 'data'));
const UPLOAD_DIR = join(DATA_DIR, 'uploads');
const DB_FILE = resolve(process.env.DATABASE_FILE || join(DATA_DIR, 'learnotech.sqlite'));
const PORT = Number(process.env.PORT || 8080);
const ADMIN_USER = process.env.LEARNOTECH_ADMIN_USERNAME || 'Kevin';
const ADMIN_PASSWORD = process.env.LEARNOTECH_ADMIN_PASSWORD || '12345678';
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_REQUEST = MAX_IMAGE + 256 * 1024;
const sessions = new Map();

// Supabase configuration
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'learnotech-media';
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

// Always ensure local directories exist as fallback
mkdirSync(UPLOAD_DIR, { recursive: true });
mkdirSync(dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS accessories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL,
    price REAL, currency TEXT NOT NULL DEFAULT 'USD', is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS adverts (
    id TEXT PRIMARY KEY, tag TEXT NOT NULL DEFAULT 'What''s new', title TEXT NOT NULL,
    body TEXT NOT NULL, image_url TEXT, button_label TEXT, button_url TEXT,
    published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

for (const col of ['old_price REAL','rating REAL','reviews INTEGER']) { try { db.exec('ALTER TABLE accessories ADD COLUMN ' + col); } catch {} }

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json'
};

const json = (res, status, value, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(value));
};
const fail = (res, status, message) => json(res, status, { detail: message });
const cleanText = (value, max = 600) => String(value ?? '').trim().slice(0, max);
const asBool = (value, fallback = false) => value == null ? fallback : ['true', '1', 'on', 'yes'].includes(String(value).toLowerCase());

function passwordMatches(candidate) {
  const supplied = Buffer.from(String(candidate ?? ''), 'utf8');
  const expected = Buffer.from(ADMIN_PASSWORD, 'utf8');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function cookieValue(req, key) {
  const cookie = req.headers.cookie || '';
  const found = cookie.split(';').map(v => v.trim()).find(v => v.startsWith(`${key}=`));
  return found ? decodeURIComponent(found.slice(key.length + 1)) : '';
}
function isAdmin(req) {
  const token = cookieValue(req, 'learnotech_session');
  const expiry = sessions.get(token);
  if (!token || !expiry) return false;
  if (expiry < Date.now()) { sessions.delete(token); return false; }
  return true;
}
function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  fail(res, 401, 'Sign in to the Admin page first.');
  return false;
}
async function readBody(req, limit = MAX_REQUEST) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('The upload is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function readJson(req) {
  try { return JSON.parse((await readBody(req, 128 * 1024)).toString('utf8') || '{}'); }
  catch (error) { if (error.status) throw error; throw Object.assign(new Error('Invalid request data.'), { status: 400 }); }
}
function parseMultipart(buffer, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.slice(1).find(Boolean)?.trim();
  if (!boundary) throw Object.assign(new Error('Invalid upload form.'), { status: 400 });
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = Object.create(null);
  let file = null;
  let cursor = 0;
  while (true) {
    const start = buffer.indexOf(delimiter, cursor);
    if (start < 0) break;
    let partStart = start + delimiter.length;
    if (buffer.subarray(partStart, partStart + 2).equals(Buffer.from('--'))) break;
    if (buffer.subarray(partStart, partStart + 2).equals(Buffer.from('\r\n'))) partStart += 2;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), partStart);
    if (headerEnd < 0) break;
    const headers = buffer.subarray(partStart, headerEnd).toString('utf8');
    const dataStart = headerEnd + 4;
    const next = buffer.indexOf(delimiter, dataStart);
    if (next < 0) break;
    let dataEnd = next;
    if (buffer.subarray(dataEnd - 2, dataEnd).equals(Buffer.from('\r\n'))) dataEnd -= 2;
    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(headers)?.[1] || '';
    const name = /name="([^"]+)"/i.exec(disposition)?.[1];
    const filename = /filename="([^"]*)"/i.exec(disposition)?.[1];
    if (name && filename !== undefined && filename !== '') {
      if (file) throw Object.assign(new Error('Only one photo can be uploaded at a time.'), { status: 400 });
      file = { name, filename, type: /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim().toLowerCase() || '', data: buffer.subarray(dataStart, dataEnd) };
    } else if (name) fields[name] = buffer.subarray(dataStart, dataEnd).toString('utf8');
    cursor = next;
  }
  return { fields, file };
}

// Local image handling
function saveLocalImage(file) {
  if (!file || !file.data.length) throw Object.assign(new Error('Choose a photo first.'), { status: 400 });
  if (file.data.length > MAX_IMAGE) throw Object.assign(new Error('Photos must be 5 MB or smaller.'), { status: 413 });
  const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  const extension = extensions[file.type];
  if (!extension) throw Object.assign(new Error('Use a JPG, PNG or WebP photo.'), { status: 400 });
  const filename = `${randomUUID()}${extension}`;
  const target = join(UPLOAD_DIR, filename);
  writeFileSync(target, file.data, { flag: 'wx' });
  return `/uploads/${filename}`;
}
function deleteLocalImage(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const filename = url.slice('/uploads/'.length);
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) return;
  const target = join(UPLOAD_DIR, filename);
  if (existsSync(target)) unlinkSync(target);
}

// Supabase REST client
async function supabaseRest(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation',
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let msg = '';
    try {
      const errJson = await response.json();
      msg = errJson.message || errJson.error || errJson.hint || JSON.stringify(errJson);
    } catch {
      msg = await response.text();
    }
    const err = new Error(`Supabase (${response.status}): ${msg || response.statusText}`);
    err.status = response.status >= 500 ? 502 : response.status;
    throw err;
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return await response.json();
  return await response.text();
}

// Supabase Storage handling
async function saveSupabaseImage(file) {
  if (!file || !file.data.length) throw Object.assign(new Error('Choose a photo first.'), { status: 400 });
  if (file.data.length > MAX_IMAGE) throw Object.assign(new Error('Photos must be 5 MB or smaller.'), { status: 413 });
  const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  const extension = extensions[file.type];
  if (!extension) throw Object.assign(new Error('Use a JPG, PNG or WebP photo.'), { status: 400 });
  const filename = `${randomUUID()}${extension}`;

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${filename}`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: file.data
  });

  if (!response.ok) {
    let msg = '';
    try {
      const errJson = await response.json();
      msg = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch {
      msg = await response.text();
    }
    throw Object.assign(new Error(`Supabase Storage upload failed: ${msg || response.statusText}`), { status: 502 });
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${filename}`;
}

async function deleteSupabaseImage(url) {
  if (!url) return;
  const publicPrefix = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/`;
  if (!url.startsWith(publicPrefix)) return;
  const filename = url.slice(publicPrefix.length);
  if (!filename) return;
  try {
    const deleteUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}`;
    await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prefixes: [filename] })
    });
  } catch (err) {
    console.warn('Could not delete image from Supabase storage:', err.message);
  }
}

async function saveMedia(file) {
  if (USE_SUPABASE) return await saveSupabaseImage(file);
  return saveLocalImage(file);
}

async function removeMedia(url) {
  if (USE_SUPABASE) return await deleteSupabaseImage(url);
  return deleteLocalImage(url);
}

// Database helper functions (unified Supabase + SQLite)
function localRows(sql) { return db.prepare(sql).all(); }
function localRow(sql, ...params) { return db.prepare(sql).get(...params); }

async function fetchAdverts(publishedOnly = false) {
  if (USE_SUPABASE) {
    const query = publishedOnly ? '?published=eq.1&order=created_at.desc' : '?order=created_at.desc';
    return await supabaseRest(`/rest/v1/adverts${query}`);
  }
  return localRows(publishedOnly ? 'SELECT * FROM adverts WHERE published=1 ORDER BY created_at DESC' : 'SELECT * FROM adverts ORDER BY created_at DESC');
}

async function fetchAccessories(activeOnly = false) {
  if (USE_SUPABASE) {
    const query = activeOnly ? '?is_active=eq.1&order=sort_order.asc,created_at.desc' : '?order=sort_order.asc,created_at.desc';
    return await supabaseRest(`/rest/v1/accessories${query}`);
  }
  return localRows(activeOnly ? 'SELECT * FROM accessories WHERE is_active=1 ORDER BY sort_order ASC, created_at DESC' : 'SELECT * FROM accessories ORDER BY sort_order ASC, created_at DESC');
}

async function fetchSingleItem(table, id) {
  if (USE_SUPABASE) {
    const list = await supabaseRest(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`);
    return list && list.length ? list[0] : null;
  }
  return localRow(`SELECT * FROM ${table} WHERE id=?`, id);
}

function priceValue(value) {
  if (value == null || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw Object.assign(new Error('Enter a valid non-negative price.'), { status: 400 });
  return parsed;
}
function parseForm(req, buffer) { return parseMultipart(buffer, req.headers['content-type'] || ''); }

async function handle(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (req.method === 'GET' && pathname === '/api/admin/session') {
      return json(res, 200, { authenticated: isAdmin(req) });
    }
    if (req.method === 'GET' && pathname === '/api/admin/system-status') {
      return json(res, 200, {
        database: USE_SUPABASE ? 'supabase' : 'sqlite',
        storage: USE_SUPABASE ? 'supabase' : 'local',
        supabaseConfigured: USE_SUPABASE,
        supabaseBucket: SUPABASE_BUCKET,
        supabaseUrl: SUPABASE_URL ? SUPABASE_URL.replace(/:\/\/.*@/, '://') : null
      });
    }
    if (req.method === 'POST' && pathname === '/api/admin/login') {
      const input = await readJson(req);
      if (String(input.username ?? '') !== ADMIN_USER || !passwordMatches(input.password)) {
        return fail(res, 401, 'Admin username or password is incorrect.');
      }
      const token = randomBytes(32).toString('hex');
      sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      return json(res, 200, { authenticated: true }, { 'Set-Cookie': `learnotech_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure}` });
    }
    if (req.method === 'POST' && pathname === '/api/admin/logout') {
      const token = cookieValue(req, 'learnotech_session');
      sessions.delete(token);
      return json(res, 200, { authenticated: false }, { 'Set-Cookie': 'learnotech_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
    }
    if (req.method === 'GET' && pathname === '/api/adverts') {
      return json(res, 200, await fetchAdverts(true));
    }
    if (req.method === 'GET' && pathname === '/api/accessories') {
      return json(res, 200, await fetchAccessories(true));
    }
    if (pathname.startsWith('/api/admin/')) {
      if (!requireAdmin(req, res)) return;
      if (req.method === 'GET' && pathname === '/api/admin/adverts') {
        return json(res, 200, await fetchAdverts(false));
      }
      if (req.method === 'GET' && pathname === '/api/admin/accessories') {
        return json(res, 200, await fetchAccessories(false));
      }
      const match = /^\/api\/admin\/(adverts|accessories)(?:\/([^/]+))?$/.exec(pathname);
      if (match) return await handleAdminItems(req, res, match[1], match[2]);
      return fail(res, 404, 'Admin API route was not found.');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 404, 'Page not found.');
    if (pathname.startsWith('/uploads/')) return serveUpload(pathname, req, res);
    const routePages = { '/': 'index.html', '/home': 'index.html', '/about': 'about.html', '/about/': 'about.html', '/accessories': 'accessories.html', '/accessories/': 'accessories.html', '/repairs': 'repairs.html', '/repairs/': 'repairs.html', '/admin': 'admin.html', '/admin/': 'admin.html' };
    const relative = routePages[pathname] || pathname.replace(/^\/+/, '');
    const file = resolve(STATIC_DIR, normalize(relative));
    if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + sep)) return fail(res, 403, 'Forbidden.');
    return serveFile(file, req, res);
  } catch (error) {
    console.error(error);
    return fail(res, error.status || 500, error.status ? error.message : 'The server could not complete the request.');
  }
}

async function handleAdminItems(req, res, kind, id) {
  const adverts = kind === 'adverts';
  const table = kind;
  const route = adverts ? 'advert' : 'accessory';
  if ((!id && req.method === 'POST') || (id && req.method === 'PUT')) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) return fail(res, 415, 'Submit the item using the upload form.');
    const parsed = parseForm(req, await readBody(req));
    const f = parsed.fields;
    const old = id ? await fetchSingleItem(table, id) : null;
    if (id && !old) return fail(res, 404, `${route === 'advert' ? 'Advert' : 'Item'} was not found.`);

    let imageUrl = null;
    if (parsed.file) {
      imageUrl = await saveMedia(parsed.file);
    } else {
      imageUrl = old?.image_url || null;
    }

    const now = new Date().toISOString();
    let savedItem = null;

    if (adverts) {
      const title = cleanText(f.title, 120);
      const body = cleanText(f.body, 600);
      if (!title || !body) {
        if (parsed.file) await removeMedia(imageUrl);
        return fail(res, 400, 'Enter an advert title and description.');
      }
      const tag = cleanText(f.tag || "What's new", 40);
      const btnLabel = cleanText(f.buttonLabel, 40) || null;
      const btnUrl = cleanText(f.buttonUrl, 1000) || null;
      const published = asBool(f.published, true) ? 1 : 0;

      if (USE_SUPABASE) {
        if (id) {
          const result = await supabaseRest(`/rest/v1/adverts?id=eq.${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ tag, title, body, image_url: imageUrl, button_label: btnLabel, button_url: btnUrl, published, updated_at: now })
          });
          savedItem = Array.isArray(result) ? result[0] : result;
        } else {
          id = randomUUID();
          const result = await supabaseRest('/rest/v1/adverts', {
            method: 'POST',
            body: JSON.stringify({ id, tag, title, body, image_url: imageUrl, button_label: btnLabel, button_url: btnUrl, published, created_at: now, updated_at: now })
          });
          savedItem = Array.isArray(result) ? result[0] : result;
        }
      } else {
        const values = [tag, title, body, imageUrl, btnLabel, btnUrl, published, now];
        if (id) {
          db.prepare('UPDATE adverts SET tag=?,title=?,body=?,image_url=?,button_label=?,button_url=?,published=?,updated_at=? WHERE id=?').run(...values, id);
        } else {
          id = randomUUID();
          db.prepare('INSERT INTO adverts(id,tag,title,body,image_url,button_label,button_url,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, ...values.slice(0, 7), now, now);
        }
        savedItem = localRow('SELECT * FROM adverts WHERE id=?', id);
      }
    } else {
      const name = cleanText(f.name, 120);
      const category = cleanText(f.category, 120);
      if (!name || !category) {
        if (parsed.file) await removeMedia(imageUrl);
        return fail(res, 400, 'Enter the item name and choose a category.');
      }
      if (!imageUrl) return fail(res, 400, 'Choose a photo for this item.');
      let price;
      try {
        price = priceValue(f.price);
      } catch (error) {
        if (parsed.file) await removeMedia(imageUrl);
        throw error;
      }
      const sort = Math.max(0, Number.parseInt(f.sortOrder || '0', 10) || 0);
      const desc = cleanText(f.description, 600);
      const currency = cleanText(f.currency || 'USD', 8);
      const numOrNull = (v) => { const s = String(v ?? '').trim(); const n = Number(s); return s !== '' && Number.isFinite(n) && n >= 0 ? n : null; };
      const oldPrice = numOrNull(f.oldPrice);
      let rating = numOrNull(f.rating); if (rating !== null) rating = Math.min(5, rating);
      let reviews = numOrNull(f.reviews); if (reviews !== null) reviews = Math.round(reviews);
      const isActive = asBool(f.isActive, true) ? 1 : 0;

      if (USE_SUPABASE) {
        if (id) {
          const result = await supabaseRest(`/rest/v1/accessories?id=eq.${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ name, category, description: desc, image_url: imageUrl, price, currency, old_price: oldPrice, rating, reviews, is_active: isActive, sort_order: sort, updated_at: now })
          });
          savedItem = Array.isArray(result) ? result[0] : result;
        } else {
          id = randomUUID();
          const result = await supabaseRest('/rest/v1/accessories', {
            method: 'POST',
            body: JSON.stringify({ id, name, category, description: desc, image_url: imageUrl, price, currency, old_price: oldPrice, rating, reviews, is_active: isActive, sort_order: sort, created_at: now, updated_at: now })
          });
          savedItem = Array.isArray(result) ? result[0] : result;
        }
      } else {
        const values = [name, category, desc, imageUrl, price, currency, isActive, sort, now];
        if (id) {
          db.prepare('UPDATE accessories SET name=?,category=?,description=?,image_url=?,price=?,currency=?,is_active=?,sort_order=?,updated_at=? WHERE id=?').run(...values, id);
        } else {
          id = randomUUID();
          db.prepare('INSERT INTO accessories(id,name,category,description,image_url,price,currency,is_active,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id, ...values.slice(0, 8), now, now);
        }
        db.prepare('UPDATE accessories SET old_price=?,rating=?,reviews=? WHERE id=?').run(oldPrice, rating, reviews, id);
        savedItem = localRow('SELECT * FROM accessories WHERE id=?', id);
      }
    }

    if (old?.image_url && old.image_url !== imageUrl) {
      await removeMedia(old.image_url);
    }
    return json(res, 200, savedItem);
  }

  if (id && req.method === 'DELETE') {
    const old = await fetchSingleItem(table, id);
    if (!old) return fail(res, 404, `${route === 'advert' ? 'Advert' : 'Item'} was not found.`);
    if (USE_SUPABASE) {
      await supabaseRest(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    } else {
      db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
    }
    await removeMedia(old.image_url);
    return json(res, 200, { deleted: true });
  }

  return fail(res, 405, 'Method not allowed.');
}

function serveUpload(pathname, req, res) {
  const filename = pathname.slice('/uploads/'.length);
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) return fail(res, 404, 'Photo not found.');
  return serveFile(join(UPLOAD_DIR, filename), req, res);
}
function serveFile(file, req, res) {
  if (!existsSync(file)) return fail(res, 404, 'Page or file not found.');
  const type = mimeTypes[extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': /\.(html|js|css)$/.test(file) ? 'no-cache' : 'public, max-age=3600' });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

createServer(handle).listen(PORT, '0.0.0.0', () => {
  console.log(`Learnotech website is running on port ${PORT}.`);
  console.log(`Database provider: ${USE_SUPABASE ? 'Supabase (' + SUPABASE_URL + ')' : 'Local SQLite (' + DB_FILE + ')'}`);
  console.log(`Storage provider: ${USE_SUPABASE ? 'Supabase Bucket (' + SUPABASE_BUCKET + ')' : 'Local (' + UPLOAD_DIR + ')'}`);
  console.log(`Admin sign-in: http://localhost:${PORT}/admin`);
});

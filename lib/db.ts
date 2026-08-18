import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  isAdmin?: boolean;
  createdAt: string;
}

export interface UserSession {
  token: string;
  userId: string;
  createdAt: number;
}

export interface DownloadHistoryRecord {
  id: string;
  userId: string;
  title: string;
  artist: string;
  thumbnail?: string;
  format: string;
  bitrate: string;
  url: string;
  date: string;
  timestamp: number;
}

export interface InviteCode {
  id: string;
  code: string;
  createdById: string;
  isUsed: boolean;
  usedByUsername?: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const INVITES_FILE = path.join(DATA_DIR, "invites.json");

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(INVITES_FILE)) {
    fs.writeFileSync(INVITES_FILE, JSON.stringify([]));
  }

  // Seed default admin account if not exists
  seedAdminUser();
}

function readJson<T>(filePath: string): T {
  ensureDataFiles();
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch {
    return [] as unknown as T;
  }
}

function writeJson<T>(filePath: string, data: T): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// Password hashing
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const verifyHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verifyHash, "hex"));
}

function seedAdminUser() {
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")) as User[];
    const adminExists = users.some((u) => u.username.toLowerCase() === "admin" || u.isAdmin);

    if (!adminExists) {
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync("SkibidiAdmin2026!", salt, 64).toString("hex");

      const adminUser: User = {
        id: "usr_admin_001",
        username: "admin",
        email: "admin@skibidi-mp3.sebastien-gratade.fr",
        passwordHash: hash,
        salt,
        isAdmin: true,
        createdAt: new Date().toISOString(),
      };

      users.unshift(adminUser);
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
    }
  } catch {}
}

// Users API
export function createUser(username: string, email: string, password: string): User {
  const users = readJson<User[]>(USERS_FILE);
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.trim();

  if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    throw new Error("Un compte avec cet e-mail existe déjà.");
  }
  if (users.some((u) => u.username.toLowerCase() === normalizedUsername.toLowerCase())) {
    throw new Error("Ce nom d'utilisateur est déjà pris.");
  }

  const { hash, salt } = hashPassword(password);
  const newUser: User = {
    id: "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    username: normalizedUsername,
    email: normalizedEmail,
    passwordHash: hash,
    salt,
    isAdmin: false,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeJson(USERS_FILE, users);
  return newUser;
}

export function authenticateUser(usernameOrEmail: string, password: string): User {
  const users = readJson<User[]>(USERS_FILE);
  const term = usernameOrEmail.toLowerCase().trim();

  const user = users.find(
    (u) => u.email.toLowerCase() === term || u.username.toLowerCase() === term
  );

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    throw new Error("Nom d'utilisateur/Email ou mot de passe incorrect.");
  }

  return user;
}

// Sessions
export function createSession(userId: string): string {
  const sessions = readJson<UserSession[]>(SESSIONS_FILE);
  const token = "skibidi_token_" + crypto.randomBytes(32).toString("hex");

  sessions.push({
    token,
    userId,
    createdAt: Date.now(),
  });

  writeJson(SESSIONS_FILE, sessions);
  return token;
}

export function getUserByToken(token: string): User | null {
  if (!token) return null;
  const sessions = readJson<UserSession[]>(SESSIONS_FILE);
  const session = sessions.find((s) => s.token === token);
  if (!session) return null;

  const users = readJson<User[]>(USERS_FILE);
  return users.find((u) => u.id === session.userId) || null;
}

export function deleteSession(token: string): void {
  const sessions = readJson<UserSession[]>(SESSIONS_FILE);
  const updated = sessions.filter((s) => s.token !== token);
  writeJson(SESSIONS_FILE, updated);
}

// Download History
export function addDownloadHistory(userId: string, record: Omit<DownloadHistoryRecord, "id" | "userId" | "timestamp">): DownloadHistoryRecord {
  const history = readJson<DownloadHistoryRecord[]>(HISTORY_FILE);
  
  const newRecord: DownloadHistoryRecord = {
    id: "hist_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    userId,
    ...record,
    timestamp: Date.now(),
  };

  const filtered = history.filter(h => !(h.userId === userId && h.url === record.url));
  filtered.unshift(newRecord);
  
  writeJson(HISTORY_FILE, filtered);
  return newRecord;
}

export function getUserDownloadHistory(userId: string): DownloadHistoryRecord[] {
  const history = readJson<DownloadHistoryRecord[]>(HISTORY_FILE);
  return history
    .filter((h) => h.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

// Invite Codes API
export function generateInviteCode(adminUserId: string): InviteCode {
  const invites = readJson<InviteCode[]>(INVITES_FILE);
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const codeStr = `SKIBIDI-${randomSuffix}`;

  const newInvite: InviteCode = {
    id: "inv_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    code: codeStr,
    createdById: adminUserId,
    isUsed: false,
    createdAt: new Date().toISOString(),
  };

  invites.unshift(newInvite);
  writeJson(INVITES_FILE, invites);
  return newInvite;
}

export function validateAndUseInviteCode(code: string, username: string): boolean {
  const invites = readJson<InviteCode[]>(INVITES_FILE);
  const cleanCode = code.trim().toUpperCase();

  const inviteIndex = invites.findIndex((inv) => inv.code.toUpperCase() === cleanCode && !inv.isUsed);
  if (inviteIndex === -1) {
    return false;
  }

  invites[inviteIndex].isUsed = true;
  invites[inviteIndex].usedByUsername = username;
  writeJson(INVITES_FILE, invites);
  return true;
}

export function getInviteCodes(): InviteCode[] {
  return readJson<InviteCode[]>(INVITES_FILE);
}

export function deleteInviteCode(codeId: string): void {
  const invites = readJson<InviteCode[]>(INVITES_FILE);
  const updated = invites.filter((i) => i.id !== codeId);
  writeJson(INVITES_FILE, updated);
}

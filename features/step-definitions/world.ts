import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const BASE = process.env.API_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || '1platform-dev-secret';

export function makeToken(userId: number, email: string, role: string, expiresIn = 3600): string {
  return jwt.sign({ sub: userId, email, role }, JWT_SECRET, { expiresIn });
}

export class OnePlatformWorld extends World {
  token = '';
  lastResponse: Response | null = null;
  lastBody: any = null;
  userId = 0;
  accountId = '';
  destAccountId = '';
  patientRowId = 0;
  cartId = '';
  orderId = '';
  productId = '';
  appointmentId = '';

  constructor(options: IWorldOptions) {
    super(options);
  }

  async api(path: string, options: RequestInit = {}): Promise<{ status: number; body: any }> {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...((options.headers as Record<string, string>) || {}),
      },
      ...options,
    });
    const body = await res.json().catch(() => ({}));
    this.lastBody = body;
    return { status: res.status, body };
  }

  async loginAs(email: string, password: string) {
    const { body } = await this.api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.token = body.token;
    this.userId = body.user?.id;
    return body;
  }
}

setWorldConstructor(OnePlatformWorld);

export { uuidv4, bcrypt, BASE };

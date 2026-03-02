import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { generateToken } from '../middleware/auth';

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password, role = 'user' } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const allowed = ['user', 'patient', 'banker', 'shopper'];
  const userRole = allowed.includes(role) ? role : 'user';

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (email, passwordHash, role) VALUES (?, ?, ?)'
    ).run(email, passwordHash, userRole);

    const user = { id: result.lastInsertRowid as number, email, role: userRole };
    const token = generateToken(user);
    return res.status(201).json({ token, user: { id: user.id, email, role: userRole } });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw err;
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = generateToken({ id: user.id, email: user.email, role: user.role });
  return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

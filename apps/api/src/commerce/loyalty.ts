import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

function getTier(totalEarned: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (totalEarned >= 10000) return 'platinum';
  if (totalEarned >= 5000) return 'gold';
  if (totalEarned >= 1000) return 'silver';
  return 'bronze';
}

function getTierBenefits(tier: string) {
  const benefits: Record<string, string[]> = {
    bronze: ['1 point per $1 spent', 'Birthday bonus points'],
    silver: ['2 points per $1 spent', 'Free standard delivery', 'Priority customer service'],
    gold: ['3 points per $1 spent', 'Free express delivery', 'Exclusive sale access', '10% birthday discount'],
    platinum: ['5 points per $1 spent', 'Free next-day delivery', 'Dedicated account manager', '20% birthday discount', 'Early product access'],
  };
  return benefits[tier] || benefits.bronze;
}

export function getLoyalty(req: AuthRequest, res: Response) {
  const loyalty = db.prepare('SELECT * FROM com_loyalty WHERE userId = ?').get(req.user!.id) as any;
  const transactions = db.prepare('SELECT * FROM com_loyalty_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 20').all(req.user!.id);
  if (!loyalty) {
    return res.json({ points: 0, tier: 'bronze', totalEarned: 0, transactions, tierBenefits: getTierBenefits('bronze') });
  }
  return res.json({ ...loyalty, transactions, tierBenefits: getTierBenefits(loyalty.tier) });
}

export function redeemPoints(req: AuthRequest, res: Response) {
  const { points } = req.body;
  if (!points || points < 100) return res.status(400).json({ error: 'Minimum redemption is 100 points' });
  const loyalty = db.prepare('SELECT * FROM com_loyalty WHERE userId = ?').get(req.user!.id) as any;
  if (!loyalty || loyalty.points < points) return res.status(422).json({ error: 'INSUFFICIENT_POINTS', message: 'Not enough points to redeem' });

  db.prepare('UPDATE com_loyalty SET points = points - ? WHERE userId = ?').run(points, req.user!.id);
  db.prepare('INSERT INTO com_loyalty_transactions (id, userId, type, points, description) VALUES (?,?,?,?,?)')
    .run(uuidv4(), req.user!.id, 'redeem', -points, `Redeemed ${points} points for $${(points / 100).toFixed(2)} discount`);

  const discount = points / 100; // 1p per point
  return res.json({ success: true, pointsRedeemed: points, discountValue: discount, message: `$${discount.toFixed(2)} discount applied to your next order` });
}

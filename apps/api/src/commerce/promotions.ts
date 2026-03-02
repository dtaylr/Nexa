import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function validatePromotion(req: AuthRequest, res: Response) {
  const { cartId, code } = req.body;

  if (!cartId || !code) {
    return res.status(400).json({ error: 'cartId and code are required' });
  }

  const cart = db.prepare("SELECT * FROM com_carts WHERE id = ? AND status = 'active'").get(cartId) as any;
  if (!cart) return res.status(404).json({ error: 'Cart not found' });

  if (cart.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

  const promotion = db.prepare('SELECT * FROM com_promotions WHERE code = ?').get(code) as any;
  if (!promotion) return res.status(404).json({ error: 'Invalid promotion code' });

  if (promotion.maxUses !== null && promotion.currentUses >= promotion.maxUses) {
    return res.status(409).json({ error: 'PROMOTION_EXPIRED' });
  }

  // BUG COM-001: no check for whether this promotion code is already applied to this cart.
  // The same code can be applied multiple times, stacking discounts to 100% or beyond.
  db.prepare('INSERT INTO com_cart_promotions (id, cartId, promotionId) VALUES (?, ?, ?)').run(
    uuidv4(), cartId, promotion.id
  );
  db.prepare('UPDATE com_promotions SET currentUses = currentUses + 1 WHERE id = ?').run(promotion.id);

  const items = db.prepare(`
    SELECT ci.quantity, p.price FROM com_cart_items ci
    JOIN com_products p ON p.id = ci.productId WHERE ci.cartId = ?
  `).all(cartId) as any[];

  const subtotal = items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);
  const discount = promotion.discountType === 'percentage'
    ? subtotal * (promotion.discountValue / 100)
    : promotion.discountValue;

  return res.json({
    code,
    discountApplied: Math.min(discount, subtotal),
    subtotal,
    total: Math.max(0, subtotal - discount),
  });
}

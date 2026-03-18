import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getWishlist(req: AuthRequest, res: Response) {
  const items = db.prepare(`
    SELECT w.id, w.addedAt, p.id as productId, p.name, p.price, p.imageUrl, p.inventory, p.description
    FROM com_wishlist w
    JOIN com_products p ON p.id = w.productId
    WHERE w.userId = ?
    ORDER BY w.addedAt DESC
  `).all(req.user!.id) as any[];
  return res.json({ wishlist: items });
}

export function addToWishlist(req: AuthRequest, res: Response) {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId is required' });
  const product = db.prepare('SELECT id FROM com_products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const existing = db.prepare('SELECT id FROM com_wishlist WHERE userId = ? AND productId = ?').get(req.user!.id, productId);
  if (existing) return res.status(409).json({ error: 'Already in wishlist' });
  const id = uuidv4();
  db.prepare('INSERT INTO com_wishlist (id, userId, productId) VALUES (?,?,?)').run(id, req.user!.id, productId);
  return res.status(201).json({ id, productId, message: 'Added to wishlist' });
}

export function removeFromWishlist(req: AuthRequest, res: Response) {
  const { productId } = req.params;
  const item = db.prepare('SELECT id FROM com_wishlist WHERE userId = ? AND productId = ?').get(req.user!.id, productId);
  if (!item) return res.status(404).json({ error: 'Item not in wishlist' });
  db.prepare('DELETE FROM com_wishlist WHERE userId = ? AND productId = ?').run(req.user!.id, productId);
  return res.json({ removed: true });
}

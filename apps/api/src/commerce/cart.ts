import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function createCart(req: AuthRequest, res: Response) {
  const id = uuidv4();
  db.prepare("INSERT INTO com_carts (id, userId, status) VALUES (?, ?, 'active')").run(id, req.user!.id);
  return res.status(201).json({ id, userId: req.user!.id, items: [] });
}

export function addToCart(req: AuthRequest, res: Response) {
  const { id: cartId } = req.params;
  const { productId, quantity = 1 } = req.body;

  const cart = db.prepare("SELECT * FROM com_carts WHERE id = ? AND status = 'active'").get(cartId) as any;
  if (!cart) return res.status(404).json({ error: 'Cart not found' });

  if (cart.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

  const product = db.prepare('SELECT * FROM com_products WHERE id = ?').get(productId) as any;
  if (!product) return res.status(404).json({ error: 'Product not found' });

  if (product.inventory < quantity) {
    return res.status(409).json({ error: 'OUT_OF_STOCK', available: product.inventory });
  }

  const existing = db.prepare(
    'SELECT * FROM com_cart_items WHERE cartId = ? AND productId = ?'
  ).get(cartId, productId) as any;

  if (existing) {
    db.prepare('UPDATE com_cart_items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
  } else {
    db.prepare('INSERT INTO com_cart_items (id, cartId, productId, quantity) VALUES (?, ?, ?, ?)').run(
      uuidv4(), cartId, productId, quantity
    );
  }

  const items = db.prepare(`
    SELECT ci.id, ci.productId, ci.quantity, p.name, p.price
    FROM com_cart_items ci JOIN com_products p ON p.id = ci.productId
    WHERE ci.cartId = ?
  `).all(cartId);

  return res.json({ cartId, items });
}

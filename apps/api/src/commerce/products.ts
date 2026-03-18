import { Request, Response } from 'express';
import { db } from '../db';

export function getProducts(_req: Request, res: Response) {
  const products = db.prepare(`
    SELECT id, name, description, price, inventory, imageUrl, category
    FROM com_products
    WHERE inventory > 0
    ORDER BY name ASC
  `).all() as any[];

  // BUG PRICE_FLOAT_PRECISION: price is a REAL (float) from SQLite and returned without rounding.
  // Products seeded with prices like 19.99 can come back as 19.999999999999996.
  return res.json({ products });
}

export function getProduct(req: Request, res: Response) {
  const { id } = req.params;
  const product = db.prepare(
    'SELECT id, name, description, price, inventory, imageUrl, category FROM com_products WHERE id = ?'
  ).get(id) as any;

  if (!product) return res.status(404).json({ error: 'Product not found' });

  return res.json(product);
}

import { Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getOrders(req: AuthRequest, res: Response) {
  const { status, limit = '20', offset = '0' } = req.query as { status?: string; limit?: string; offset?: string };

  let query = `SELECT o.*, GROUP_CONCAT(oi.productId || ':' || oi.quantity || ':' || oi.price || ':' || COALESCE(p.name, 'Unknown'), '|') as itemsRaw
    FROM com_orders o
    LEFT JOIN com_order_items oi ON oi.orderId = o.id
    LEFT JOIN com_products p ON p.id = oi.productId
    WHERE o.userId = ?`;
  const params: any[] = [req.user!.id];

  if (status) { query += ' AND o.status = ?'; params.push(status); }
  query += ' GROUP BY o.id ORDER BY o.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const orders = (db.prepare(query).all(...params) as any[]).map(o => ({
    ...o,
    items: o.itemsRaw ? o.itemsRaw.split('|').map((s: string) => {
      const parts = s.split(':');
      return { productId: parts[0], quantity: +parts[1], price: +parts[2], name: parts.slice(3).join(':') };
    }) : [],
    itemsRaw: undefined,
  }));

  return res.json({ orders, total: (db.prepare('SELECT COUNT(*) as n FROM com_orders WHERE userId = ?').get(req.user!.id) as any).n });
}

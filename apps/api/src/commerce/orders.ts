import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function createOrder(req: AuthRequest, res: Response) {
  const { cartId } = req.body;

  const cart = db.prepare("SELECT * FROM com_carts WHERE id = ? AND status = 'active'").get(cartId) as any;
  if (!cart) return res.status(404).json({ error: 'Cart not found or already checked out' });

  if (cart.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

  const items = db.prepare(`
    SELECT ci.productId, ci.quantity, p.price, p.inventory, p.name
    FROM com_cart_items ci JOIN com_products p ON p.id = ci.productId
    WHERE ci.cartId = ?
  `).all(cartId) as any[];

  if (!items.length) return res.status(400).json({ error: 'Cart is empty' });

  for (const item of items) {
    // BUG INVENTORY_OVERSELL_RACE: inventory check and deduction are not atomic.
    // Two concurrent orders for the last item will both pass this check.
    if (item.inventory < item.quantity) {
      return res.status(409).json({ error: 'OUT_OF_STOCK', productId: item.productId });
    }
  }

  const orderId = uuidv4();
  const total = items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);

  db.prepare("UPDATE com_carts SET status = 'checked_out' WHERE id = ?").run(cartId);
  db.prepare(`
    INSERT INTO com_orders (id, userId, cartId, status, total) VALUES (?, ?, ?, 'pending', ?)
  `).run(orderId, req.user!.id, cartId, total);

  for (const item of items) {
    db.prepare('INSERT INTO com_order_items (id, orderId, productId, quantity, price) VALUES (?, ?, ?, ?, ?)').run(
      uuidv4(), orderId, item.productId, item.quantity, item.price
    );
    db.prepare('UPDATE com_products SET inventory = inventory - ? WHERE id = ?').run(item.quantity, item.productId);
  }

  // BUG EMAIL_BEFORE_PAYMENT: confirmation email is marked as sent at order creation, before payment is taken.
  db.prepare('UPDATE com_orders SET emailSent = 1 WHERE id = ?').run(orderId);

  return res.status(201).json({
    orderId,
    status: 'pending',
    total,
    emailQueued: true,
    items: items.map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity, price: i.price })),
  });
}

export function processPayment(req: AuthRequest, res: Response) {
  const { id: orderId } = req.params;
  const { method, amount, currency = 'USD' } = req.body;

  if (!method || !amount) {
    return res.status(400).json({ error: 'method and amount are required' });
  }

  const order = db.prepare("SELECT * FROM com_orders WHERE id = ? AND status = 'pending'").get(orderId) as any;
  if (!order) return res.status(404).json({ error: 'Order not found or already paid' });

  if (order.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

  const paymentId = uuidv4();
  db.prepare("UPDATE com_orders SET status = 'paid' WHERE id = ?").run(orderId);

  return res.json({
    orderId,
    paymentId,
    status: 'CAPTURED',
    amountCharged: amount,
    currency,
    receiptUrl: `/receipts/${paymentId}`,
    emailQueued: order.emailSent === 1,
  });
}

export function getOrder(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM com_orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

  const items = db.prepare(`
    SELECT oi.productId, oi.quantity, oi.price, p.name
    FROM com_order_items oi JOIN com_products p ON p.id = oi.productId
    WHERE oi.orderId = ?
  `).all(id);

  return res.json({ ...order, items });
}

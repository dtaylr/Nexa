import { Router } from 'express';
import { getProducts, getProduct } from './products';
import { createCart, addToCart } from './cart';
import { createOrder, getOrder, processPayment } from './orders';
import { validatePromotion } from './promotions';
import { authenticate } from '../middleware/auth';

export const commerceRouter = Router();

commerceRouter.get('/products', getProducts);
commerceRouter.get('/products/:id', getProduct);

commerceRouter.use(authenticate);

commerceRouter.post('/cart', createCart);
commerceRouter.put('/cart/:id/items', addToCart);
commerceRouter.post('/orders', createOrder);
commerceRouter.get('/orders/:id', getOrder);
commerceRouter.post('/orders/:id/payment', processPayment);
commerceRouter.post('/promotions/validate', validatePromotion);

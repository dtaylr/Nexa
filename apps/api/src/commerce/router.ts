import { Router } from 'express';
import { getProducts, getProduct } from './products';
import { createCart, addToCart } from './cart';
import { createOrder, getOrder, processPayment } from './orders';
import { validatePromotion } from './promotions';
import { getWishlist, addToWishlist, removeFromWishlist } from './wishlist';
import { getOrders } from './order-history';
import { requestReturn, getReturns } from './returns';
import { getLoyalty, redeemPoints } from './loyalty';
import { authenticate } from '../middleware/auth';

export const commerceRouter = Router();

commerceRouter.get('/products', getProducts);
commerceRouter.get('/products/:id', getProduct);

commerceRouter.use(authenticate);

commerceRouter.post('/cart', createCart);
commerceRouter.put('/cart/:id/items', addToCart);
commerceRouter.post('/orders', createOrder);
commerceRouter.get('/orders', getOrders);
commerceRouter.get('/orders/:id', getOrder);
commerceRouter.post('/orders/:id/payment', processPayment);
commerceRouter.post('/orders/:orderId/returns', requestReturn);
commerceRouter.get('/returns', getReturns);
commerceRouter.post('/promotions/validate', validatePromotion);
commerceRouter.get('/wishlist', getWishlist);
commerceRouter.post('/wishlist', addToWishlist);
commerceRouter.delete('/wishlist/:productId', removeFromWishlist);
commerceRouter.get('/loyalty', getLoyalty);
commerceRouter.post('/loyalty/redeem', redeemPoints);

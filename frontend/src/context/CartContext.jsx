import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { getErrorMessage } from '../api/client';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], itemCount: 0, subtotal: 0 });
  const [cartLoading, setCartLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!user) {
      setCart({ items: [], itemCount: 0, subtotal: 0 });
      return;
    }
    setCartLoading(true);
    try {
      const res = await api.get('/cart');
      setCart(res.data.data);
    } catch {
      setCart({ items: [], itemCount: 0, subtotal: 0 });
    } finally {
      setCartLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const setCartItem = async (vegetableId, quantity, unit) => {
    const safeQty = Math.max(0, Number(quantity));
    const res = await api.put('/cart', {
      vegetableId,
      quantity: safeQty,
      unit,
    });
    setCart(res.data.data);
    return res.data.data;
  };

  const removeCartItem = async (vegetableId) => {
    const res = await api.delete(`/cart/${vegetableId}`);
    setCart(res.data.data);
    return res.data.data;
  };

  const clearCart = async () => {
    try {
      const res = await api.delete('/cart');
      setCart(res.data.data);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const getItemInCart = (vegetableId) =>
    cart.items.find((i) => String(i.vegetable_id) === String(vegetableId));

  return (
    <CartContext.Provider
      value={{
        cart,
        cartLoading,
        fetchCart,
        setCartItem,
        removeCartItem,
        clearCart,
        getItemInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

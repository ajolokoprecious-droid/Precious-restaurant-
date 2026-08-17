import React, { useState, useEffect } from 'react';
import { MenuItem, CartItem, OrderType, OrderRecord, ReservationRecord } from './types';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { StoryHighlights } from './components/StoryHighlights';
import { FeaturedDishes } from './components/FeaturedDishes';
import { MenuSection } from './components/MenuSection';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { ReservationSection } from './components/ReservationSection';
import { GallerySection } from './components/GallerySection';
import { ReviewsSection } from './components/ReviewsSection';
import { ContactSection } from './components/ContactSection';
import { OrderTrackerModal } from './components/OrderTrackerModal';
import { Footer } from './components/Footer';
import { FloatingMobileBar } from './components/FloatingMobileBar';

export default function App() {
  // Cart State (Strictly client-side active session state; cleared upon successful checkout)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('delivery');

  // Modal / Drawer Toggles
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [trackerInitialCode, setTrackerInitialCode] = useState('');

  // Total quantity of items in cart
  const cartItemCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);

  // Cart Operations
  const handleAddToCart = (
    item: MenuItem,
    quantity: number = 1,
    specialInstructions?: string
  ) => {
    setCartItems((prevItems) => {
      // Find if exact same item with same special instructions exists
      const existingIndex = prevItems.findIndex(
        (ci) => ci.item.id === item.id && ci.specialInstructions === specialInstructions
      );

      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      } else {
        return [...prevItems, { item, quantity, specialInstructions }];
      }
    });
  };

  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
    } else {
      setCartItems((prev) =>
        prev.map((ci) => (ci.item.id === itemId ? { ...ci, quantity: newQty } : ci))
      );
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // When order completes successfully, CLEAR cart immediately to guarantee isolation!
  const handleOrderSuccess = (order: OrderRecord) => {
    setCartItems([]);
  };

  const handleOpenTrackerWithCode = (code: string) => {
    setTrackerInitialCode(code);
    setIsTrackerOpen(true);
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5] flex flex-col selection:bg-[#C5A059] selection:text-black">
      
      {/* Top Fixed Navigation */}
      <Navbar
        cartItemCount={cartItemCount}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenReservation={() => scrollToSection('reservation')}
        onOpenTracker={() => {
          setTrackerInitialCode('');
          setIsTrackerOpen(true);
        }}
      />

      {/* Main Page Layout */}
      <main className="flex-1 pb-16 sm:pb-0">
        
        {/* 1. Hero Section */}
        <HeroSection
          onOrderClick={() => scrollToSection('menu')}
          onReserveClick={() => scrollToSection('reservation')}
        />

        {/* 2. Restaurant Highlights / Story */}
        <StoryHighlights />

        {/* 3. Chef Featured Showstoppers */}
        <FeaturedDishes
          onAddToCart={(item) => handleAddToCart(item, 1)}
          onViewAllMenu={() => scrollToSection('menu')}
        />

        {/* 4. Complete Interactive Categorized Menu */}
        <MenuSection
          onAddToCart={handleAddToCart}
        />

        {/* 5. Table Reservation Booking Engine */}
        <ReservationSection />

        {/* 6. Culinary & Atmosphere Gallery */}
        <GallerySection />

        {/* 7. Guest Testimonials */}
        <ReviewsSection />

        {/* 8. Contact, Location & Opening Hours */}
        <ContactSection />

      </main>

      {/* Global Footer */}
      <Footer />

      {/* Mobile Floating Action Controls */}
      <FloatingMobileBar
        cartItemCount={cartItemCount}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenReservation={() => scrollToSection('reservation')}
      />

      {/* Slide-over Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        orderType={orderType}
        onOrderTypeChange={setOrderType}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* Complete Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        orderType={orderType}
        onOrderSuccess={handleOrderSuccess}
        onOpenTrackerWithCode={handleOpenTrackerWithCode}
      />

      {/* Live Order & Reservation Tracker Modal */}
      <OrderTrackerModal
        isOpen={isTrackerOpen}
        onClose={() => setIsTrackerOpen(false)}
        initialCode={trackerInitialCode}
      />

    </div>
  );
}

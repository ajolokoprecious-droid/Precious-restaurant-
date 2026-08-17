export type MenuCategory =
  | 'Starters'
  | 'Main Courses'
  | 'Rice & Specialties'
  | 'Chicken'
  | 'Seafood'
  | 'Sides'
  | 'Desserts'
  | 'Drinks';

export type DietaryTag = 'Chef Special' | 'Spicy' | 'Halal' | 'Vegetarian' | 'Gluten-Free' | 'Popular';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  description: string;
  price: number; // in NGN (e.g., 4500)
  image: string;
  dietaryTags?: DietaryTag[];
  prepTime?: string;
  calories?: number;
  popular?: boolean;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

export type OrderType = 'delivery' | 'pickup';

export type OrderStatus = 'Received' | 'Kitchen Preparing' | 'Ready for Pickup' | 'Out for Delivery' | 'Delivered' | 'Completed';

export interface CustomerOrderInfo {
  fullName: string;
  phone: string;
  email: string;
  deliveryAddress?: string;
  orderType: OrderType;
  specialInstructions?: string;
}

export interface OrderItemSummary {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  itemTotal: number;
  specialInstructions?: string;
}

export interface OrderRecord {
  orderCode: string; // e.g. PRECIOUS-20260817-A7F3
  createdAt: string; // ISO date string
  dateFormatted: string;
  timeFormatted: string;
  customer: CustomerOrderInfo;
  items: OrderItemSummary[];
  subtotal: number;
  deliveryFee: number;
  finalTotal: number;
  status: OrderStatus;
  notificationSentTo: string;
}

export interface OrderSubmissionPayload {
  items: {
    id: string;
    quantity: number;
    specialInstructions?: string;
  }[];
  customer: CustomerOrderInfo;
  idempotencyKey?: string;
}

export type ReservationStatus = 'Request Received' | 'Confirmed by Restaurant' | 'Cancelled';

export interface ReservationRecord {
  reservationCode: string; // e.g. PRECIOUS-RES-20260817-B82K
  createdAt: string;
  dateFormatted: string;
  timeFormatted: string;
  fullName: string;
  phone: string;
  email: string;
  guests: number;
  reservationDate: string;
  reservationTime: string;
  seatingPreference?: string;
  specialRequests?: string;
  status: ReservationStatus;
  notificationSentTo: string;
}

export interface ReservationSubmissionPayload {
  fullName: string;
  phone: string;
  email: string;
  guests: number;
  reservationDate: string;
  reservationTime: string;
  seatingPreference?: string;
  specialRequests?: string;
  idempotencyKey?: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: 'Cuisine' | 'Ambiance' | 'Events' | 'Chefs';
  image: string;
  caption: string;
}

export interface ReviewItem {
  id: string;
  name: string;
  rating: number;
  date: string;
  comment: string;
  favoriteDish?: string;
  verified?: boolean;
}

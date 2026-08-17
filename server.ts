import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { MENU_ITEMS } from './src/data/menu';
import { RESTAURANT_INFO } from './src/data/restaurantInfo';
import {
  OrderRecord,
  OrderItemSummary,
  OrderSubmissionPayload,
  ReservationRecord,
  ReservationSubmissionPayload,
} from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Durable Registry for Orders and Reservations
const ordersDatabase = new Map<string, OrderRecord>();
const reservationsDatabase = new Map<string, ReservationRecord>();
const idempotencyMap = new Map<string, { result: any; timestamp: number }>();

// Clean up stale idempotency entries after 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of idempotencyMap.entries()) {
    if (now - val.timestamp > 3600000) {
      idempotencyMap.delete(key);
    }
  }
}, 600000);

// Helper: Format Code with Date
function generateUniqueCode(prefix: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSegment = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 hex chars e.g. A7F3
  return `${prefix}-${year}${month}${day}-${randomSegment}`;
}

// Helper: Simulated & Logged Email Dispatcher
function dispatchOrderEmailNotification(order: OrderRecord): void {
  const emailPayload = {
    to: RESTAURANT_INFO.email, // ajolokoprecious@gmail.com
    from: `Precious Restaurant Orders <noreply@preciousrestaurant.com>`,
    subject: `New Precious Restaurant Order — [${order.orderCode}]`,
    text: `
========================================
NEW PRECIOUS RESTAURANT ORDER
Order Code: ${order.orderCode}
Date: ${order.dateFormatted}
Time: ${order.timeFormatted}
Status: ${order.status}
========================================

CUSTOMER INFORMATION:
- Full Name: ${order.customer.fullName}
- Phone Number: ${order.customer.phone}
- Email: ${order.customer.email}
- Order Type: ${order.customer.orderType.toUpperCase()}
- Delivery Address: ${order.customer.orderType === 'delivery' ? (order.customer.deliveryAddress || 'None provided') : 'N/A (Pickup Order)'}
- Special Instructions: ${order.customer.specialInstructions || 'None'}

ORDERED ITEMS:
----------------------------------------
${order.items
  .map(
    (item, index) =>
      `${index + 1}. ${item.name}
   Qty: ${item.quantity} × ₦${item.unitPrice.toLocaleString()} = ₦${item.itemTotal.toLocaleString()}${
        item.specialInstructions ? `\n   Note: ${item.specialInstructions}` : ''
      }`
  )
  .join('\n')}
----------------------------------------

FINANCIAL SUMMARY:
- Subtotal: ₦${order.subtotal.toLocaleString()}
- Delivery Fee: ₦${order.deliveryFee.toLocaleString()}
- FINAL TOTAL: ₦${order.finalTotal.toLocaleString()}

Official Notification Recipient: ${RESTAURANT_INFO.email}
Official Restaurant Phone: ${RESTAURANT_INFO.phone}
========================================
`,
  };

  console.log(`[EMAIL DISPATCH] Sent to ${emailPayload.to}: Subject "${emailPayload.subject}"`);
}

function dispatchReservationEmailNotification(res: ReservationRecord): void {
  const emailPayload = {
    to: RESTAURANT_INFO.email, // ajolokoprecious@gmail.com
    from: `Precious Restaurant Reservations <noreply@preciousrestaurant.com>`,
    subject: `New Precious Restaurant Reservation — [${res.reservationCode}]`,
    text: `
========================================
NEW PRECIOUS RESTAURANT RESERVATION REQUEST
Reservation Code: ${res.reservationCode}
Submitted Date: ${res.dateFormatted}
Submitted Time: ${res.timeFormatted}
Status: ${res.status}
========================================

GUEST INFORMATION:
- Full Name: ${res.fullName}
- Phone Number: ${res.phone}
- Email: ${res.email}
- Number of Guests: ${res.guests}
- Reserved Date: ${res.reservationDate}
- Reserved Time: ${res.reservationTime}
- Seating Preference: ${res.seatingPreference || 'Standard Dining Area'}
- Special Requests: ${res.specialRequests || 'None'}

Note: Table booking is marked as 'Request Received'. Please contact the guest at ${res.phone} or ${res.email} to confirm.

Official Notification Recipient: ${RESTAURANT_INFO.email}
Official Restaurant Phone: ${RESTAURANT_INFO.phone}
========================================
`,
  };

  console.log(`[EMAIL DISPATCH] Sent to ${emailPayload.to}: Subject "${emailPayload.subject}"`);
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', restaurant: RESTAURANT_INFO.name, timestamp: new Date().toISOString() });
});

// 2. Authoritative Menu Catalog
app.get('/api/menu', (req: Request, res: Response) => {
  res.json({ items: MENU_ITEMS });
});

// 3. Place Real Order (Strict Server-Side Validation)
app.post('/api/orders', (req: Request, res: Response) => {
  try {
    const payload = req.body as OrderSubmissionPayload;

    // Idempotency Check
    if (payload.idempotencyKey && idempotencyMap.has(payload.idempotencyKey)) {
      const existing = idempotencyMap.get(payload.idempotencyKey)!;
      return res.status(200).json(existing.result);
    }

    // Validate Customer Info
    const customer = payload.customer;
    if (!customer) {
      return res.status(400).json({ error: 'Customer information is required.' });
    }

    if (!customer.fullName || customer.fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a valid full name.' });
    }

    if (!customer.phone || customer.phone.trim().length < 7) {
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }

    if (!customer.email || !customer.email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (customer.orderType === 'delivery' && (!customer.deliveryAddress || customer.deliveryAddress.trim().length < 5)) {
      return res.status(400).json({ error: 'Please enter a valid delivery address.' });
    }

    // Validate Items
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty. Please add items before placing an order.' });
    }

    // Authoritative Server-Side Calculation
    const validatedItems: OrderItemSummary[] = [];
    let calculatedSubtotal = 0;

    for (const submittedItem of payload.items) {
      if (!submittedItem.id || typeof submittedItem.quantity !== 'number' || submittedItem.quantity <= 0) {
        return res.status(400).json({ error: `Invalid item or quantity submitted.` });
      }

      const qty = Math.floor(submittedItem.quantity);
      if (qty <= 0 || qty > 100) {
        return res.status(400).json({ error: `Invalid quantity for item ${submittedItem.id}.` });
      }

      // Look up authentic item in authoritative menu catalog
      const menuItem = MENU_ITEMS.find((m) => m.id === submittedItem.id);
      if (!menuItem) {
        return res.status(400).json({ error: `Item with id "${submittedItem.id}" was not found in the menu.` });
      }

      const itemTotal = menuItem.price * qty;
      calculatedSubtotal += itemTotal;

      validatedItems.push({
        id: menuItem.id,
        name: menuItem.name,
        quantity: qty,
        unitPrice: menuItem.price,
        itemTotal,
        specialInstructions: submittedItem.specialInstructions ? String(submittedItem.specialInstructions).trim() : undefined,
      });
    }

    const deliveryFee = customer.orderType === 'delivery' ? RESTAURANT_INFO.deliveryFee : 0;
    const finalTotal = calculatedSubtotal + deliveryFee;

    const now = new Date();
    const orderCode = generateUniqueCode('PRECIOUS');

    const orderRecord: OrderRecord = {
      orderCode,
      createdAt: now.toISOString(),
      dateFormatted: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeFormatted: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      customer: {
        fullName: customer.fullName.trim(),
        phone: customer.phone.trim(),
        email: customer.email.trim(),
        deliveryAddress: customer.orderType === 'delivery' ? customer.deliveryAddress?.trim() : undefined,
        orderType: customer.orderType,
        specialInstructions: customer.specialInstructions?.trim() || undefined,
      },
      items: validatedItems,
      subtotal: calculatedSubtotal,
      deliveryFee,
      finalTotal,
      status: 'Received',
      notificationSentTo: RESTAURANT_INFO.email,
    };

    // Store in isolated database
    ordersDatabase.set(orderCode, orderRecord);

    // Dispatch email notification to ajolokoprecious@gmail.com
    dispatchOrderEmailNotification(orderRecord);

    const responsePayload = {
      success: true,
      message: 'Order received successfully!',
      order: orderRecord,
    };

    // Save for idempotency if key provided
    if (payload.idempotencyKey) {
      idempotencyMap.set(payload.idempotencyKey, { result: responsePayload, timestamp: Date.now() });
    }

    return res.status(201).json(responsePayload);
  } catch (err: any) {
    console.error('Error processing order:', err);
    return res.status(500).json({ error: 'Internal server error while processing your order.' });
  }
});

// 4. Look up Order by Code (Tracking)
app.get('/api/orders/:code', (req: Request, res: Response) => {
  const code = req.params.code.toUpperCase();
  const order = ordersDatabase.get(code);

  if (!order) {
    return res.status(404).json({ error: `Order with code "${code}" was not found.` });
  }

  // Return isolated order details
  return res.json({ order });
});

// 5. Submit Table Reservation
app.post('/api/reservations', (req: Request, res: Response) => {
  try {
    const payload = req.body as ReservationSubmissionPayload;

    // Idempotency Check
    if (payload.idempotencyKey && idempotencyMap.has(payload.idempotencyKey)) {
      const existing = idempotencyMap.get(payload.idempotencyKey)!;
      return res.status(200).json(existing.result);
    }

    if (!payload.fullName || payload.fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }

    if (!payload.phone || payload.phone.trim().length < 7) {
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }

    if (!payload.email || !payload.email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!payload.guests || payload.guests < 1 || payload.guests > 50) {
      return res.status(400).json({ error: 'Please select a valid party size (1–50 guests).' });
    }

    if (!payload.reservationDate) {
      return res.status(400).json({ error: 'Please select a reservation date.' });
    }

    if (!payload.reservationTime) {
      return res.status(400).json({ error: 'Please select a reservation time slot.' });
    }

    const now = new Date();
    const reservationCode = generateUniqueCode('PRECIOUS-RES');

    const reservationRecord: ReservationRecord = {
      reservationCode,
      createdAt: now.toISOString(),
      dateFormatted: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeFormatted: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      fullName: payload.fullName.trim(),
      phone: payload.phone.trim(),
      email: payload.email.trim(),
      guests: Number(payload.guests),
      reservationDate: payload.reservationDate,
      reservationTime: payload.reservationTime,
      seatingPreference: payload.seatingPreference?.trim() || undefined,
      specialRequests: payload.specialRequests?.trim() || undefined,
      status: 'Request Received',
      notificationSentTo: RESTAURANT_INFO.email,
    };

    // Store in isolated reservations registry
    reservationsDatabase.set(reservationCode, reservationRecord);

    // Dispatch email notification to ajolokoprecious@gmail.com
    dispatchReservationEmailNotification(reservationRecord);

    const responsePayload = {
      success: true,
      message: 'Reservation request received successfully!',
      reservation: reservationRecord,
    };

    if (payload.idempotencyKey) {
      idempotencyMap.set(payload.idempotencyKey, { result: responsePayload, timestamp: Date.now() });
    }

    return res.status(201).json(responsePayload);
  } catch (err: any) {
    console.error('Error processing reservation:', err);
    return res.status(500).json({ error: 'Internal server error while processing your reservation.' });
  }
});

// 6. Look up Reservation by Code
app.get('/api/reservations/:code', (req: Request, res: Response) => {
  const code = req.params.code.toUpperCase();
  const reservation = reservationsDatabase.get(code);

  if (!reservation) {
    return res.status(404).json({ error: `Reservation with code "${code}" was not found.` });
  }

  return res.json({ reservation });
});

// ----------------------------------------------------
// VITE / STATIC SERVING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Precious Restaurant Server listening on port ${PORT}`);
  });
}

startServer();

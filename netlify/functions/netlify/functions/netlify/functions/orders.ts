import type { Handler } from '@netlify/functions';
import { MENU_ITEMS } from '../../src/data/menu';
import { RESTAURANT_INFO } from '../../src/data/restaurantInfo';
import { sendEmail, generateUniqueCode } from './_email';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const customer = payload.customer;

    if (!customer) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Customer information is required.' }) };
    }
    if (!customer.fullName || String(customer.fullName).trim().length < 2) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Please enter a valid full name.' }) };
    }
    if (!customer.phone || String(customer.phone).trim().length < 7) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Please enter a valid phone number.' }) };
    }
    if (!customer.email || !String(customer.email).includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Please enter a valid email address.' }) };
    }
    if (customer.orderType === 'delivery' && (!customer.deliveryAddress || String(customer.deliveryAddress).trim().length < 5)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Please enter a valid delivery address.' }) };
    }
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Your cart is empty. Please add items before placing an order.' }) };
    }

    const validatedItems: any[] = [];
    let calculatedSubtotal = 0;

    for (const submittedItem of payload.items) {
      if (!submittedItem.id || typeof submittedItem.quantity !== 'number' || submittedItem.quantity <= 0) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid item or quantity submitted.' }) };
      }

      const qty = Math.floor(submittedItem.quantity);
      if (qty <= 0 || qty > 100) {
        return { statusCode: 400, body: JSON.stringify({ error: `Invalid quantity for item ${submittedItem.id}.` }) };
      }

      const menuItem = MENU_ITEMS.find((m) => m.id === submittedItem.id);
      if (!menuItem) {
        return { statusCode: 400, body: JSON.stringify({ error: `Item with id "${submittedItem.id}" was not found in the menu.` }) };
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

    const orderRecord = {
      orderCode,
      createdAt: now.toISOString(),
      dateFormatted: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeFormatted: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      customer: {
        fullName: String(customer.fullName).trim(),
        phone: String(customer.phone).trim(),
        email: String(customer.email).trim(),
        deliveryAddress: customer.orderType === 'delivery' ? String(customer.deliveryAddress || '').trim() : undefined,
        orderType: customer.orderType,
        specialInstructions: customer.specialInstructions ? String(customer.specialInstructions).trim() : undefined,
      },
      items: validatedItems,
      subtotal: calculatedSubtotal,
      deliveryFee,
      finalTotal,
      status: 'Received',
      notificationSentTo: RESTAURANT_INFO.email,
    };

    const emailText = `
========================================
NEW PRECIOUS RESTAURANT ORDER
Order Code: ${orderRecord.orderCode}
Date: ${orderRecord.dateFormatted}
Time: ${orderRecord.timeFormatted}
Status: ${orderRecord.status}
========================================

CUSTOMER INFORMATION:
- Full Name: ${orderRecord.customer.fullName}
- Phone Number: ${orderRecord.customer.phone}
- Email: ${orderRecord.customer.email}
- Order Type: ${orderRecord.customer.orderType.toUpperCase()}
- Delivery Address: ${orderRecord.customer.orderType === 'delivery' ? (orderRecord.customer.deliveryAddress || 'None provided') : 'N/A (Pickup Order)'}
- Special Instructions: ${orderRecord.customer.specialInstructions || 'None'}

ORDERED ITEMS:
----------------------------------------
${orderRecord.items
  .map(
    (item, index) =>
      `${index + 1}. ${item.name}\n   Qty: ${item.quantity} x NGN${item.unitPrice.toLocaleString()} = NGN${item.itemTotal.toLocaleString()}${
        item.specialInstructions ? `\n   Note: ${item.specialInstructions}` : ''
      }`
  )
  .join('\n')}
----------------------------------------

FINANCIAL SUMMARY:
- Subtotal: NGN${orderRecord.subtotal.toLocaleString()}
- Delivery Fee: NGN${orderRecord.deliveryFee.toLocaleString()}
- FINAL TOTAL: NGN${orderRecord.finalTotal.toLocaleString()}
========================================
`;

    await sendEmail(RESTAURANT_INFO.email, `New Precious Restaurant Order — [${orderRecord.orderCode}]`, emailText);

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: 'Order received successfully!',
        order: orderRecord,
      }),
    };
  } catch (err) {
    console.error('Error processing order:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error while processing your order.' }) };
  }
};

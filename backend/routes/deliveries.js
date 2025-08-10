import express from 'express';
import PDFDocument from 'pdfkit';
import path from 'path';
import {
  getAllDeliveries,
  getDeliveryById,
  addDelivery,
  updateDelivery,
  deleteDelivery,
  getCustomerById,
  getProductById,
  updateProductStock
} from '../firestoreService.js';

const router = express.Router();

// GET /api/deliveries?product=productId
router.get('/', async (req, res) => {
  try {
    const productId = req.query.product || null;
    const deliveries = await getAllDeliveries(productId);
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deliveries/:id
router.get('/:id', async (req, res) => {
  try {
    const delivery = await getDeliveryById(req.params.id);
    res.json(delivery);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/deliveries
router.post('/', async (req, res) => {
  try {
    const { customer, customerName, deliveredTo, items, signature, date } = req.body;
    if (!customer || !customerName || !deliveredTo || !items || items.length === 0 || !signature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. בדיקת מלאי עבור כל מוצר
    for (const item of items) {
      const prod = await getProductById(item.product);
      if (!prod) return res.status(400).json({ error: `מוצר לא נמצא: ${item.product}` });
      if ((prod.stock ?? 0) < item.quantity)
        return res.status(400).json({ error: `אין מספיק מלאי עבור "${prod.name}". במלאי: ${prod.stock}, ביקשת: ${item.quantity}` });
    }

    // 2. עדכון מלאי בפועל לכל מוצר
    for (const item of items) {
      await updateProductStock(item.product, -item.quantity);
    }

    // 3. שמירת ניפוק
    const deliveryData = {
      customer,
      customerName, // השם של הלקוח
      deliveredTo,
      items,
      signature,
      date: date ? new Date(date) : new Date(),
    };
    const newDelivery = await addDelivery(deliveryData);
    res.status(201).json(newDelivery);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF RECEIPT - POST /api/deliveries/:id/receipt
router.post('/:id/receipt', async (req, res) => {
  try {
    // NEW: אם לא נשלחה חתימה, נשתמש בזו השמורה במסמך
    let signature = req.body.signature;
    const delivery = await getDeliveryById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'לא נמצא ניפוק' });

    if (!signature) {
      signature = delivery.signature;
    }

    // שליפת שם הלקוח
    let customerName = '';
    try {
      const customer = await getCustomerById(delivery.customer);
      customerName = customer ? customer.name : '';
    } catch { customerName = ''; }

    // שליפת פרטי מוצרים
    let products = [];
    try {
      products = await Promise.all(
        (delivery.items || []).map(async (item) => {
          let prod = {};
          try {
            prod = await getProductById(item.product);
          } catch { prod = {}; }
          return {
            name: prod.name || 'מוצר לא ידוע',
            quantity: item.quantity
          };
        })
      );
    } catch { products = []; }

    // ---- פונט עברי בשם noto.ttf ----
    const fontPath = path.join(process.cwd(), 'fonts', 'noto.ttf');
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.registerFont('hebrew', fontPath);
    doc.font('hebrew');

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=receipt.pdf');
      res.send(pdfData);
    });

    // RTL MARK לכל שורה
    const rtl = '\u200F';

    // ----- קבלה מסודרת בעברית -----
    doc.fontSize(22).text(`${rtl}קבלה על ניפוק מלאי`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(16).text(`${rtl}לקוח: ${customerName}`, { align: 'right' });
    doc.text(`${rtl}נופק למי: ${delivery.deliveredTo}`, { align: 'right' });

    // תאריך עברי תקני
    let dateText = '';
    try {
      const d = new Date(delivery.date);
      if (!isNaN(d)) {
        dateText = d.toLocaleDateString('he-IL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        dateText = '';
      }
    } catch { dateText = ''; }
    doc.text(`${rtl}תאריך: ${dateText}`, { align: 'right' });

    doc.moveDown();
    doc.fontSize(18).text(`${rtl}מוצרים שנופקו:`, { align: 'right' });

    if (products.length === 0) {
      doc.fontSize(14).text(`${rtl}לא נבחרו מוצרים`, { align: 'right' });
    } else {
      products.forEach((p, i) => {
        doc.fontSize(15).text(`${rtl}${i + 1}. ${p.name}   |   כמות: ${p.quantity}`, { align: 'right' });
      });
    }

    doc.moveDown();
    doc.fontSize(15).text(`${rtl}חתימה:`, { align: 'right' });

    if (signature && typeof signature === 'string' && signature.startsWith('data:image')) {
      const signatureData = signature.replace(/^data:image\/png;base64,/, '');
      const sigBuffer = Buffer.from(signatureData, 'base64');
      doc.image(sigBuffer, doc.page.width - 200, doc.y, { width: 150, align: 'right' });
    } else {
      doc.text(`${rtl}__________________`, { align: 'right' });
    }

    doc.end();
  } catch (err) {
    console.error("Error generating PDF receipt:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/deliveries/:id
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body;
    const updatedDelivery = await updateDelivery(req.params.id, updates);
    res.json(updatedDelivery);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/deliveries/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteDelivery(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;


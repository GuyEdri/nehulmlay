import express from 'express';
import cors from 'cors';

// ייבוא ראוטרים שהגדרת (מותאמים ל-Firebase Firestore)
import customersRouter from './routes/customers.js';
import productsRouter from './routes/products.js';
import deliveriesRouter from './routes/deliveries.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// שימוש בראוטרים (המסלולים של ה-API)
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/deliveries', deliveriesRouter);

// הפעלת השרת על פורט 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


import { Router } from 'express';
import { process } from '../controllers/payment.controller.js';

const router = Router();

router.get('/mercadopago', async (req, res) => {
    try {
        const products = [ { title: 'Producto1', quantity: 1, unit_price: 1600 } ];
        const buyer = { email: 'correo@electronico.comprador' };
        const processInit = await process(products, buyer);
        res.redirect(processInit.sandbox_init_point);
    } catch (err) {
        res.status(500).send({ status: -1, payload: 'Error al gestionar el pago' });
    }
});

router.get('/success', (req, res) => {
    res.status(200).send({ status: 1, payload: 'El pago ha sido procesado, muchas gracias por su compra!' });
});

router.get('/failure', (req, res) => {
    res.status(200).send({ status: -1, payload: 'Hubo un error al procesar el pago, por favor reintente o pónganse en contacto con nosotros' });
});

router.get('/pending', (req, res) => {
    res.status(200).send({ status: -1, payload: 'El pago ha sido procesado pero aún está pendiente de confirmación' });
});

export default router;

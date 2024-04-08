import { MercadoPagoConfig, Preference } from 'mercadopago';
import config from '../config.js';

const client = new MercadoPagoConfig({ accessToken: config.MP_ACCESS_TOKEN });
const preference = new Preference(client);

export const process = async (products, buyer) => {
    try {
        const process = await preference.create({
            body: {
                items: products,
                payer: buyer,
                back_urls: {
                    success: `http://localhost:${config.APP_PORT}/${config.API_PAYMENTS_PREFIX}/success`,
                    failure: `http://localhost:${config.APP_PORT}/${config.API_PAYMENTS_PREFIX}/failure`,
                    pending: `http://localhost:${config.APP_PORT}/${config.API_PAYMENTS_PREFIX}/pending`,
                },
            }
        })

        return process;
    } catch (err) {
        return err.message;
    }
};

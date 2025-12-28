import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
    // Server Configuration
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),

    // Database Configuration
    DATABASE_URL: Joi.string().required(),

    // Email Service Configuration
    SENDGRID_API_KEY: Joi.string().required(),
    SENDGRID_FROM_EMAIL: Joi.string().email().required(),
    SENDGRID_FROM_NAME: Joi.string().default('LoamTech Solutions'),

    // Firebase Admin SDK
    FIREBASE_SERVICE_ACCOUNT: Joi.string().required(),
});

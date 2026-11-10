/** Configuración desde variables de entorno (nunca valores secretos en el código). */
const req = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Falta la variable de entorno ${k}`);
  return v;
};

export const config = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: req('DATABASE_URL'),
  jwtSecret: (() => {
    const s = req('JWT_SECRET');
    if (s.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
    return s;
  })(),
  publicUrl: req('PUBLIC_URL').replace(/\/+$/, ''),
  filesDir: process.env.FILES_DIR ?? '/data/receipts',
  accessTtlSeconds: 60 * 60, // 1 h
  refreshTtlDays: 60,
  signupAllowlist: (process.env.SIGNUP_ALLOWLIST ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  smtp: process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
      }
    : null,
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || null,
  maxUploadBytes: 15 * 1024 * 1024,
};

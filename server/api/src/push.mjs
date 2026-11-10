import pg from 'pg';
import { config } from './config.mjs';
import { pool } from './db.mjs';

/**
 * Escucha `optogether_push` (NOTIFY desde la base) y envía cada notificación a Expo Push.
 * Si Expo indica DeviceNotRegistered, elimina el token.
 */
export function startPushWorker(log) {
  let client = null;
  const connect = async () => {
    try {
      client = new pg.Client({ connectionString: config.databaseUrl });
      client.on('error', (e) => {
        log.warn(e, 'Conexión de push perdida; reintentando');
        setTimeout(connect, 5000);
      });
      await client.connect();
      await client.query('listen optogether_push');
      client.on('notification', (msg) => send(msg.payload).catch((e) => log.error(e, 'Error enviando push')));
      log.info('Worker de push escuchando');
    } catch (e) {
      log.warn(e, 'No se pudo iniciar el worker de push; reintentando');
      setTimeout(connect, 5000);
    }
  };

  async function send(notificationId) {
    const { rows } = await pool.query(
      `select n.id, n.title, n.body, n.data, t.token
         from public.notifications n join public.push_tokens t on t.user_id = n.user_id
        where n.id = $1`,
      [notificationId],
    );
    if (!rows.length) return;
    const messages = rows.map((r) => ({
      to: r.token, title: r.title, body: r.body, sound: 'default', channelId: 'reminders', priority: 'high',
      data: { ...(r.data ?? {}), notification_id: r.id },
    }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', Accept: 'application/json',
        ...(config.expoAccessToken ? { Authorization: `Bearer ${config.expoAccessToken}` } : {}),
      },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => ({}));
    const tickets = Array.isArray(json?.data) ? json.data : [];
    for (let i = 0; i < tickets.length; i++) {
      if (tickets[i]?.details?.error === 'DeviceNotRegistered') {
        await pool.query('delete from public.push_tokens where token = $1', [messages[i].to]);
      }
    }
  }

  connect();
  return () => client?.end().catch(() => {});
}

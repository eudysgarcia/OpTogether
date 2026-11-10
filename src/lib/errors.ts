/** Traduce errores del backend a mensajes claros en español. */
const MESSAGES: Record<string, string> = {
  FONDO_INSUFICIENTE: 'El fondo no tiene saldo suficiente. Repón el fondo o registra el gasto sin fondo.',
  AHORRO_INSUFICIENTE: 'La meta no tiene ese saldo disponible para retirar.',
  SOBREPAGO_DEUDA: 'El abono supera el saldo pendiente. Si es correcto, confirma el sobrepago.',
  MOTIVO_REQUERIDO: 'Indica un motivo (mínimo 3 caracteres).',
  MOVIMIENTO_ANULADO: 'Este movimiento ya está anulado y no puede modificarse.',
  USA_ANULACION: 'Para anular un movimiento usa la opción "Anular".',
  USA_ANULACION_AJUSTE: 'Este movimiento proviene de un ajuste de presupuesto; anúlalo desde el presupuesto.',
  CAMPO_INMUTABLE: 'Ese dato no se puede cambiar. Anula el registro y crea uno nuevo.',
  AMBITO_INCOMPATIBLE: 'No se pueden mezclar finanzas personales con las del hogar.',
  REFERENCIA_INACTIVA: 'El elemento seleccionado está archivado o cancelado.',
  REFERENCIA_INEXISTENTE: 'El elemento seleccionado ya no existe.',
  DISTRIBUCION_INVALIDA: 'La distribución debe sumar exactamente 100%.',
  SOBRANTE_INSUFICIENTE: 'Solo puedes mover el dinero disponible de la categoría.',
  SIN_PERIODO_ANTERIOR: 'No hay un mes anterior para copiar.',
  YA_TIENES_HOGAR: 'Tu usuario ya pertenece a un hogar.',
  INVITACION_INVALIDA: 'El código no existe, expiró o ya fue usado.',
  SOLO_ADMIN: 'Solo el administrador del hogar puede hacer esto.',
  SIN_AUTORIZACION: 'No tienes autorización para esta acción.',
  SIN_ACCESO: 'No tienes acceso a este registro.',
  SIN_SESION: 'Tu sesión expiró. Inicia sesión de nuevo.',
  MIEMBRO_INVALIDO: 'El miembro seleccionado no es válido.',
  MONTO_INVALIDO: 'Introduce un monto válido mayor que cero.',
  BACKEND_NO_CONFIGURADO: 'La app aún no está conectada al servidor.',
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
  'Network request failed': 'Sin conexión. Revisa tu internet e inténtalo de nuevo.',
  'Failed to fetch': 'Sin conexión. Revisa tu internet e inténtalo de nuevo.',
  'duplicate key': 'Esta operación ya fue registrada.',
  'row-level security': 'No tienes permiso para esta operación.',
  'Password should be': 'La contraseña debe tener al menos 8 caracteres.',
};

export function errorMessage(err: unknown): string {
  const e = err as { message?: string; hint?: string; code?: string } | null;
  const raw = `${e?.message ?? ''} ${e?.code ?? ''}`;
  for (const [k, v] of Object.entries(MESSAGES)) {
    if (raw.includes(k)) return v;
  }
  if (e?.hint && /^[A-ZÁÉÍÓÚ]/.test(e.hint) && !e.hint.includes('GRANT')) return e.hint;
  return 'Algo salió mal. Inténtalo de nuevo.';
}

export const isNetworkError = (err: unknown) => /Network request failed|Failed to fetch|fetch failed/i.test(String((err as Error)?.message ?? err));

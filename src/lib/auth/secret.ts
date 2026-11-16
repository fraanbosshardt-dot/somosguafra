// Nunca firmar con una clave vacía o conocida cuando falta configuración.
export function requireAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Falta configurar un AUTH_SECRET seguro (mínimo 32 caracteres).");
  return secret;
}

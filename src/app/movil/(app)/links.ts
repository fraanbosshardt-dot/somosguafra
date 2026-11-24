// Pasa un enlace de la web (/app/…) a su pantalla en la app (/movil/…).
export function toMovil(href: string) {
  if (!href.startsWith("/app")) return href;
  const rest = href.slice(4);
  if (rest === "" || rest.startsWith("?")) return `/movil${rest}`;
  if (/^\/(movimientos|proximos|cargar)(\/|\?|$)/.test(rest)) return `/movil${rest}`;
  if (rest.startsWith("/calendario")) return "/movil/proximos";
  return `/movil/explorar${rest}`;
}

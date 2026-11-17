export const SUPPORT_TIMEZONE = "America/Argentina/Buenos_Aires";
export const supportWhen = (d: Date) => new Intl.DateTimeFormat("es-AR", {
  timeZone: SUPPORT_TIMEZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(d);

// Eight staffed hours, Monday-Friday 09:00-17:00. Iterates UTC instants;
// display and business hours are evaluated in the named timezone, never host time.
export function supportDeadline(start: Date, hours = 8) {
  let remaining = hours * 3600_000;
  const cursor = new Date(start);
  const clock = new Intl.DateTimeFormat("en-US", {timeZone: SUPPORT_TIMEZONE, weekday:"short", hour:"2-digit", hourCycle:"h23"});
  for (let i = 0; remaining > 0 && i < 60 * 24 * 14; i++) {
    const parts = clock.formatToParts(cursor);
    const day = parts.find(p=>p.type==="weekday")?.value;
    const hour = Number(parts.find(p=>p.type==="hour")?.value);
    const step=Math.min(60_000-(cursor.getTime()%60_000),remaining);
    if (day !== "Sat" && day !== "Sun" && hour >= 9 && hour < 17) remaining-=step;
    cursor.setTime(cursor.getTime()+step);
  }
  return cursor;
}

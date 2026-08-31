type LogLevel = 'info' | 'warn' | 'error';
type Context = Record<string, unknown>;

function emit(level: LogLevel, event: string, context: Context = {}): void {
  const payload = JSON.stringify({
    level,
    event,
    context,
    at: new Date().toISOString(),
    surface: 'shiftproof-mobile',
  });
  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else console.info(payload);
}

export const logger = {
  info: (event: string, context?: Context) => emit('info', event, context),
  warn: (event: string, context?: Context) => emit('warn', event, context),
  error: (event: string, context?: Context) => emit('error', event, context),
};

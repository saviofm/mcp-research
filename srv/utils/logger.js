/**
 * Logger estruturado.
 * Em produção usa formato JSON (configurado em package.json cds.log).
 * Em desenvolvimento usa saída legível.
 */

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? 2;

function shouldLog(level) {
  return (LOG_LEVELS[level] ?? 2) <= currentLevel;
}

function formatMessage(level, context, msgOrObj, msg) {
  const ts = new Date().toISOString();
  let obj, message;

  if (typeof msgOrObj === 'object' && msgOrObj !== null) {
    obj = msgOrObj;
    message = msg;
  } else {
    obj = {};
    message = msgOrObj;
  }

  // JSON estruturado (produção / Cloud Foundry)
  if (process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json') {
    return JSON.stringify({ level, time: ts, context, msg: message, ...obj });
  }

  // Formato legível (desenvolvimento)
  const extra = Object.keys(obj).length ? ' ' + JSON.stringify(obj) : '';
  return `[${ts}] ${level.toUpperCase().padEnd(5)} [${context}] ${message}${extra}`;
}

export function createLogger(context) {
  return {
    error: (objOrMsg, msg) => {
      if (shouldLog('error')) console.error(formatMessage('error', context, objOrMsg, msg));
    },
    warn: (objOrMsg, msg) => {
      if (shouldLog('warn')) console.warn(formatMessage('warn', context, objOrMsg, msg));
    },
    info: (objOrMsg, msg) => {
      if (shouldLog('info')) console.log(formatMessage('info', context, objOrMsg, msg));
    },
    debug: (objOrMsg, msg) => {
      if (shouldLog('debug')) console.log(formatMessage('debug', context, objOrMsg, msg));
    }
  };
}

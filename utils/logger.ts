const isDevelopment = import.meta.env.DEV;

export const devLog = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
};

export const logger = isDevelopment
  ? devLog
  : {
      log: () => {},
      error: () => {},
      warn: () => {},
    };

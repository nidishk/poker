export default class Logger {

  constructor(sentry, serverName, serviceName) {
    this.sentry = sentry;
    this.serverName = serverName || serviceName;

    if (process.env.SERVICE_NAME !== serviceName) {
      this.log(`${serviceName} is deployed on ${serverName}, but expected ${process.env.SERVICE_NAME}`, {
        level: 'error',
      });
    }
  }

  log(message, context) {
    return new Promise((fulfill, reject) => {
      const now = Math.floor(Date.now() / 1000);
      this.sentry.captureMessage(
        `${now} - ${message}`,
        {
          level: 'info',
          ...context,
          server_name: this.serverName,
        },
        (error, eventId) => {
          if (error) {
            reject(error);
            return;
          }
          fulfill(eventId);
        },
      );
    });
  }

  exception(e) {
    return new Promise((resolve) => {
      this.sentry.captureException(e, {
        server_name: this.serverName,
      }, (sendErr) => {
        if (sendErr) {
          console.log(JSON.stringify(sendErr)); // eslint-disable-line no-console
          return resolve(sendErr);
        }
        return resolve(e);
      });
    });
  }

}

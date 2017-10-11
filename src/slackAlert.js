import httpinvoke from 'httpinvoke';

export default class SlackAlert {

  constructor(slackAlertUrl, slackChannel, env) {
    this.slackAlertUrl = slackAlertUrl;
    this.slackChannel = slackChannel;
    this.env = env;
  }

  sendAlert(text) {
    if (!this.slackAlertUrl || !this.slackChannel) return Promise.reject('is not configured');

    const alertText = `${text}\n\nEnvironment: *${this.env}*`;

    return new Promise((fulfill, reject) => {
      const options = {
        input: JSON.stringify({
          channel: this.slackChannel,
          username: 'ops-bot',
          text: alertText,
          icon_emoji: ':robot_face:',
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };
      return httpinvoke(this.slackAlertUrl, 'POST', options).then(res => fulfill(res), err => reject(JSON.stringify(err)));
    });
  }
}

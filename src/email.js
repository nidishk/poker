
function Email(ses) {
  this.ses = ses;
  this.from = 'noreply@acebusters.com';
  this.subject = 'Acebusters Email Verification Request';
  this.welcome = 'Dear customer, \n\nWe have received a request to authorize this email address for Acebusters.com. If you requested this verification, please click the following link: \n\n';
  this.goodbye = '\n\nSincerely, \n\nThe Acebusters Team';
}

Email.prototype.sendVerification = function sendVerification(email, fulfillment, origin) {
  return new Promise((fulfill, reject) => {
    this.ses.sendEmail({
      Source: this.from,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: this.subject,
        },
        Body: { Text: {
          Data: `${this.welcome + origin}/confirm/${fulfillment}${this.goodbye}`,
        } } },
    }, (err, data) => {
      if (err) {
        reject(`Error: ${err}`);
        return;
      }
      fulfill(data);
    });
  });
};

module.exports = Email;

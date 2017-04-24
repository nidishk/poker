const fromEmail = 'noreply@acebusters.com';
const subject = 'Acebusters Email Verification Request';
const resetSubject = 'Acebusters Password Recovery Request';
const welcome = 'Dear customer, \n\nWe have received a request to authorize this email address for Acebusters.com. If you requested this verification, please click the following link:';
const reset = 'Dear customer, \n\nWe have received a request to reset the password linked to this email for Acebusters.com. If you requested this reset, please click the following link:';
const goodbye = 'Sincerely, \n\nThe Acebusters Team';

function sendVerification(ses, email, subject, msg) {
  return new Promise((fulfill, reject) => {
    ses.sendEmail({
      Source: fromEmail,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: subject,
        },
        Body: { Text: {
          Data: msg,
        } } },
    }, (err, data) => {
      if (err) {
        return reject(`Error: ${err}`);
      }
      return fulfill(data);
    });
  });
}

function Email(ses) {
  this.ses = ses;
}

Email.prototype.sendConfirm = function sendConfirm(email, fulfillment, origin) {
  const code = encodeURIComponent(fulfillment);
  const msg = `${welcome} \n\n${origin}/confirm/${code} \n\n${goodbye}`;
  return sendVerification(this.ses, email, subject, msg);
};

Email.prototype.sendReset = function sendReset(email, fulfillment, origin) {
  const code = encodeURIComponent(fulfillment);
  const msg = `${reset} \n\n${origin}/confirm/${code} \n\n${goodbye}`;
  return sendVerification(this.ses, email, resetSubject, msg);
};

module.exports = Email;

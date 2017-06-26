const subject = 'Acebusters Email Verification Request';
const resetSubject = 'Acebusters Password Recovery Request';
const welcome = 'Dear customer, \n\nWe have received a request to authorize this email address for Acebusters.com. If you requested this verification, please click the following link:';
const reset = 'Dear customer, \n\nWe have received a request to reset the password linked to this email for Acebusters.com. If you requested this reset, please click the following link:';
const goodbye = 'Sincerely, \n\nThe Acebusters Team';

function sendVerification(ses, fromEmail, email, subjectData, msg) {
  return new Promise((fulfill, reject) => {
    ses.sendEmail({
      Source: fromEmail,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: subjectData,
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

function Email(ses, fromEmail) {
  this.ses = ses;
  this.fromEmail = (fromEmail) || 'noreply@acebusters.com';
}

Email.prototype.sendConfirm = function sendConfirm(email, fulfillment, origin) {
  const code = encodeURIComponent(fulfillment);
  const msg = `${welcome} \n\n${origin}/confirm/${code} \n\n${goodbye}`;
  return sendVerification(this.ses, this.fromEmail, email, subject, msg);
};

Email.prototype.sendReset = function sendReset(email, fulfillment, origin) {
  const code = encodeURIComponent(fulfillment);
  const msg = `${reset} \n\n${origin}/confirm/${code} \n\n${goodbye}`;
  return sendVerification(this.ses, this.fromEmail, email, resetSubject, msg);
};

module.exports = Email;

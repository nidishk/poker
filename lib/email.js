
function Email (ses) {
  this.ses = ses;
  this.from = 'noreply@acebusters.com';
  this.subject = 'Acebusters Email Verification Request';
  this.welcome = 'Dear customer, \n\nWe have received a request to authorize this email address for Acebusters.com. If you requested this verification, please click the following link: \n\n';
  this.goodbye = '\n\nSincerely, \n\nThe Acebusters Team';
}

Email.prototype.sendVerification = function(email, fulfillment) {
  var self = this;
  return new Promise(function (fulfill, reject) {
    self.ses.sendEmail( {
      Source: self.from, 
      Destination: { ToAddresses: [ email ] },
      Message: {
        Subject: {
          Data: self.subject
        },
        Body: { Text: {
          Data: self.welcome + fulfillment + self.goodbye
      }}}
    }, function(err, data) {
      if(err)
      reject('Error: ' + err);
      else
        fulfill(data)
    });
  });
}

module.exports = Email;




function Unauthorized(message) {
  this.name = 'Unauthorized';
  this.message = `${this.name}: ${message}`;
  this.stack = (new Error()).stack;
}
Unauthorized.prototype = new Error();

function Forbidden(message) {
  this.name = 'Forbidden';
  this.message = `${this.name}: ${message}`;
  this.stack = (new Error()).stack;
}
Forbidden.prototype = new Error();

function BadRequest(message) {
  this.name = 'BadRequest';
  this.message = `Bad Request: ${message}`;
  this.stack = (new Error()).stack;
}
BadRequest.prototype = new Error();

function NotFound(message) {
  this.name = 'NotFound';
  this.message = `Not Found: ${message}`;
  this.stack = (new Error()).stack;
}
NotFound.prototype = new Error();

function Conflict(message) {
  this.name = 'Conflict';
  this.message = `${this.name}: ${message}`;
  this.stack = (new Error()).stack;
}
Conflict.prototype = new Error();

export { Unauthorized, NotFound, BadRequest, Forbidden, Conflict };

class ApiError extends Error {
  constructor(statusCode, message, details, code) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, details, 'BAD_REQUEST');
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, undefined, code);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, undefined, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, undefined, 'NOT_FOUND');
  }

  static conflict(message = 'Conflict', details) {
    return new ApiError(409, message, details, 'CONFLICT');
  }

  static unprocessable(message, details) {
    return new ApiError(422, message, details, 'UNPROCESSABLE');
  }
}

module.exports = ApiError;

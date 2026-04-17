function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'production') {
    return res.status(status).json({
      success: false,
      message,
      stack: err.stack
    });
  }

  return res.status(status).json({
    success: false,
    message
  });
}

module.exports = errorHandler;

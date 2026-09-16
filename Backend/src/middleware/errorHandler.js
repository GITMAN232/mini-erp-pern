function errorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]:', err);

  // Common PostgreSQL errors handling
  if (err.code === '23505') { // unique_violation
    return res.status(409).json({ message: 'A record with this unique value already exists' });
  }
  if (err.code === '23503') { // foreign_key_violation
    return res.status(400).json({ message: 'Referenced record does not exist' });
  }
  if (err.code === '23514') { // check_violation
    return res.status(400).json({ message: 'Data violates check constraints' });
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal server error'
  });
}

module.exports = { errorHandler };

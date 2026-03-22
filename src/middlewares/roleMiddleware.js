/**
 * Factory that creates a middleware allowing only specified roles
 * Usage: roleMiddleware('admin') or roleMiddleware('admin', 'creator')
 */
function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }

    next();
  };
}

module.exports = roleMiddleware;

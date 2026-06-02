/**
 * Middleware de autenticação XSUAA para o endpoint /mcp.
 *
 * Quando MCP_REQUIRE_AUTH=true (produção), valida o Bearer Token JWT
 * contra o XSUAA e verifica se o usuário possui o scope ResearchUser.
 *
 * Quando MCP_REQUIRE_AUTH=false (desenvolvimento local), bypassa a autenticação.
 *
 * Usa @sap/xssec v4 API: createSecurityContext(new XsuaaService(creds), { jwt })
 */
import { createLogger } from '../utils/logger.js';

const log = createLogger('auth');

function requireAuthEnabled() {
  return process.env.MCP_REQUIRE_AUTH !== 'false';
}

export async function requireAuth(req, res, next) {
  if (!requireAuthEnabled()) {
    log.debug('Auth disabled (MCP_REQUIRE_AUTH=false) - bypassing token validation');
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log.warn({ path: req.path, method: req.method }, 'Missing Bearer token');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Bearer token required.'
    });
  }

  const token = authHeader.substring(7);

  try {
    const xsuaaCredentials = getXsuaaCredentials();
    if (!xsuaaCredentials) {
      log.error('XSUAA credentials not found. Cannot validate token.');
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Authentication service not configured.'
      });
    }

    const { createSecurityContext, XsuaaService } = await import('@sap/xssec');
    const xsuaaService = new XsuaaService(xsuaaCredentials);

    const secCtx = await createSecurityContext(xsuaaService, { jwt: token });

    // checkLocalScope prepends xsappname automatically
    if (!secCtx.checkLocalScope('ResearchUser')) {
      log.warn({ path: req.path }, 'Insufficient scope - ResearchUser required');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions. ResearchUser scope required.'
      });
    }

    req.user = {
      id: secCtx.getLogonName() || secCtx.getEmail() || 'unknown',
      scopes: ['ResearchUser']
    };

    return next();
  } catch (err) {
    const status = err.statusCode || err.status || 401;
    log.warn({ status, path: req.path, err: err.message }, 'Token validation failed');
    return res.status(status).json({
      error: status === 403 ? 'Forbidden' : 'Unauthorized',
      message: status === 403
        ? 'Insufficient permissions. ResearchUser scope required.'
        : 'Invalid or expired token.'
    });
  }
}

function getXsuaaCredentials() {
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES);
      const xsuaaServices = vcap['xsuaa'] || [];
      if (Array.isArray(xsuaaServices) && xsuaaServices.length > 0) {
        return xsuaaServices[0]?.credentials;
      }
    } catch {
      // ignore parse error
    }
  }
  return null;
}

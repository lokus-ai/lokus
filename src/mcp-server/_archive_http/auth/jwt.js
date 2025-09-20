/**
 * Production-Ready JWT Authentication Manager
 * 
 * Provides secure JWT token generation, validation, and management with
 * support for access/refresh tokens, token rotation, and comprehensive security features.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export class JWTManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Security configuration
    this.accessTokenSecret = options.accessTokenSecret || this.generateSecret();
    this.refreshTokenSecret = options.refreshTokenSecret || this.generateSecret();
    this.accessTokenExpiry = options.accessTokenExpiry || '15m';
    this.refreshTokenExpiry = options.refreshTokenExpiry || '7d';
    this.issuer = options.issuer || 'lokus-mcp-server';
    this.audience = options.audience || 'lokus-client';
    this.algorithm = options.algorithm || 'HS256';
    
    // Token storage for blacklisting and tracking
    this.blacklistedTokens = new Set();
    this.refreshTokenStore = new Map(); // refreshToken -> { userId, clientId, issuedAt, expiresAt }
    this.activeTokens = new Map(); // tokenId -> { userId, type, issuedAt, expiresAt }
    
    // Cleanup intervals
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    this.maxStoredTokens = options.maxStoredTokens || 10000;
    
    // Security settings
    this.enableTokenRotation = options.enableTokenRotation !== false;
    this.enableAuditing = options.enableAuditing !== false;
    this.requireAudience = options.requireAudience !== false;
    this.enableJTI = options.enableJTI !== false; // JSON Token Identifier for tracking
    
    // Start cleanup process
    this.startCleanup();
    
    this.emit('initialized', { 
      issuer: this.issuer, 
      audience: this.audience,
      algorithm: this.algorithm 
    });
  }

  /**
   * Generate cryptographically secure secret
   */
  generateSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate secure token ID
   */
  generateTokenId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload, options = {}) {
    try {
      const tokenId = this.enableJTI ? this.generateTokenId() : undefined;
      const now = Math.floor(Date.now() / 1000);
      
      const tokenPayload = {
        ...payload,
        iss: this.issuer,
        aud: this.requireAudience ? this.audience : undefined,
        iat: now,
        jti: tokenId,
        type: 'access',
        scope: payload.scope || ['read'],
        permissions: payload.permissions || {},
        clientId: payload.clientId || 'unknown'
      };

      const token = jwt.sign(tokenPayload, this.accessTokenSecret, {
        expiresIn: options.expiresIn || this.accessTokenExpiry,
        algorithm: this.algorithm,
        issuer: this.issuer,
        audience: this.requireAudience ? this.audience : undefined,
        jwtid: tokenId
      });

      // Store token for tracking
      if (tokenId) {
        const expiresAt = now + this.parseExpiryToSeconds(options.expiresIn || this.accessTokenExpiry);
        this.activeTokens.set(tokenId, {
          userId: payload.sub || payload.userId,
          type: 'access',
          issuedAt: now,
          expiresAt,
          clientId: payload.clientId
        });
      }

      if (this.enableAuditing) {
        this.emit('tokenGenerated', { 
          type: 'access', 
          userId: payload.sub || payload.userId,
          tokenId,
          clientId: payload.clientId,
          scope: tokenPayload.scope,
          expiresIn: options.expiresIn || this.accessTokenExpiry
        });
      }

      return { token, tokenId };
    } catch (error) {
      this.emit('tokenError', { 
        type: 'generation', 
        operation: 'access_token',
        error: error.message 
      });
      throw new Error(`Failed to generate access token: ${error.message}`);
    }
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload, options = {}) {
    try {
      const tokenId = this.generateTokenId();
      const now = Math.floor(Date.now() / 1000);
      
      const tokenPayload = {
        sub: payload.sub || payload.userId,
        iss: this.issuer,
        aud: this.requireAudience ? this.audience : undefined,
        iat: now,
        jti: tokenId,
        type: 'refresh',
        clientId: payload.clientId || 'unknown'
      };

      const token = jwt.sign(tokenPayload, this.refreshTokenSecret, {
        expiresIn: options.expiresIn || this.refreshTokenExpiry,
        algorithm: this.algorithm,
        issuer: this.issuer,
        audience: this.requireAudience ? this.audience : undefined,
        jwtid: tokenId
      });

      // Store refresh token with metadata
      const expiresAt = now + this.parseExpiryToSeconds(options.expiresIn || this.refreshTokenExpiry);
      this.refreshTokenStore.set(tokenId, {
        userId: payload.sub || payload.userId,
        clientId: payload.clientId || 'unknown',
        issuedAt: now,
        expiresAt,
        rotationCount: 0
      });

      if (this.enableAuditing) {
        this.emit('tokenGenerated', { 
          type: 'refresh', 
          userId: payload.sub || payload.userId,
          tokenId,
          clientId: payload.clientId,
          expiresIn: options.expiresIn || this.refreshTokenExpiry
        });
      }

      return { token, tokenId };
    } catch (error) {
      this.emit('tokenError', { 
        type: 'generation', 
        operation: 'refresh_token',
        error: error.message 
      });
      throw new Error(`Failed to generate refresh token: ${error.message}`);
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(payload, options = {}) {
    const accessToken = this.generateAccessToken(payload, {
      expiresIn: options.accessTokenExpiry || this.accessTokenExpiry
    });
    
    const refreshToken = this.generateRefreshToken(payload, {
      expiresIn: options.refreshTokenExpiry || this.refreshTokenExpiry
    });

    return {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      accessTokenId: accessToken.tokenId,
      refreshTokenId: refreshToken.tokenId,
      expiresIn: this.parseExpiryToSeconds(options.accessTokenExpiry || this.accessTokenExpiry),
      tokenType: 'Bearer'
    };
  }

  /**
   * Validate access token
   */
  validateAccessToken(token, options = {}) {
    try {
      // Check if token is blacklisted
      if (this.blacklistedTokens.has(token)) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, this.accessTokenSecret, {
        algorithms: [this.algorithm],
        issuer: this.issuer,
        audience: this.requireAudience ? this.audience : undefined,
        clockTolerance: options.clockTolerance || 30
      });

      // Verify token type
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Check if token exists in active tokens
      if (this.enableJTI && decoded.jti) {
        const tokenInfo = this.activeTokens.get(decoded.jti);
        if (!tokenInfo) {
          throw new Error('Token not found in active tokens');
        }
        
        // Check expiration in our store (additional security layer)
        if (Date.now() / 1000 > tokenInfo.expiresAt) {
          this.activeTokens.delete(decoded.jti);
          throw new Error('Token expired');
        }
      }

      if (this.enableAuditing) {
        this.emit('tokenValidated', { 
          type: 'access', 
          userId: decoded.sub,
          tokenId: decoded.jti,
          clientId: decoded.clientId,
          scope: decoded.scope
        });
      }

      return {
        valid: true,
        payload: decoded,
        userId: decoded.sub,
        clientId: decoded.clientId,
        scope: decoded.scope || ['read'],
        permissions: decoded.permissions || {},
        issuedAt: decoded.iat,
        expiresAt: decoded.exp
      };
    } catch (error) {
      if (this.enableAuditing) {
        this.emit('tokenError', { 
          type: 'validation', 
          operation: 'access_token',
          error: error.message,
          token: token.substring(0, 20) + '...' // Partial token for debugging
        });
      }
      
      return {
        valid: false,
        error: error.message,
        expired: error.name === 'TokenExpiredError',
        invalid: error.name === 'JsonWebTokenError'
      };
    }
  }

  /**
   * Validate refresh token
   */
  validateRefreshToken(token, options = {}) {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        algorithms: [this.algorithm],
        issuer: this.issuer,
        audience: this.requireAudience ? this.audience : undefined,
        clockTolerance: options.clockTolerance || 30
      });

      // Verify token type
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists in store
      const tokenInfo = this.refreshTokenStore.get(decoded.jti);
      if (!tokenInfo) {
        throw new Error('Refresh token not found or revoked');
      }

      // Check expiration in our store
      if (Date.now() / 1000 > tokenInfo.expiresAt) {
        this.refreshTokenStore.delete(decoded.jti);
        throw new Error('Refresh token expired');
      }

      if (this.enableAuditing) {
        this.emit('tokenValidated', { 
          type: 'refresh', 
          userId: decoded.sub,
          tokenId: decoded.jti,
          clientId: decoded.clientId
        });
      }

      return {
        valid: true,
        payload: decoded,
        userId: decoded.sub,
        clientId: decoded.clientId,
        tokenInfo
      };
    } catch (error) {
      if (this.enableAuditing) {
        this.emit('tokenError', { 
          type: 'validation', 
          operation: 'refresh_token',
          error: error.message,
          token: token.substring(0, 20) + '...'
        });
      }
      
      return {
        valid: false,
        error: error.message,
        expired: error.name === 'TokenExpiredError',
        invalid: error.name === 'JsonWebTokenError'
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(refreshToken, newPayload = {}) {
    const validation = this.validateRefreshToken(refreshToken);
    
    if (!validation.valid) {
      throw new Error(`Invalid refresh token: ${validation.error}`);
    }

    const { payload, tokenInfo } = validation;
    
    // Generate new access token
    const newAccessToken = this.generateAccessToken({
      sub: payload.sub,
      clientId: payload.clientId,
      ...newPayload
    });

    // Optionally rotate refresh token
    let newRefreshToken = null;
    if (this.enableTokenRotation) {
      // Revoke old refresh token
      this.refreshTokenStore.delete(payload.jti);
      
      // Generate new refresh token
      newRefreshToken = this.generateRefreshToken({
        sub: payload.sub,
        clientId: payload.clientId
      });
      
      // Update rotation count
      const newTokenInfo = this.refreshTokenStore.get(newRefreshToken.tokenId);
      if (newTokenInfo) {
        newTokenInfo.rotationCount = (tokenInfo.rotationCount || 0) + 1;
      }
    }

    if (this.enableAuditing) {
      this.emit('tokenRefreshed', { 
        userId: payload.sub,
        clientId: payload.clientId,
        oldRefreshTokenId: payload.jti,
        newRefreshTokenId: newRefreshToken?.tokenId,
        rotated: this.enableTokenRotation
      });
    }

    return {
      accessToken: newAccessToken.token,
      refreshToken: newRefreshToken?.token || refreshToken,
      accessTokenId: newAccessToken.tokenId,
      refreshTokenId: newRefreshToken?.tokenId || payload.jti,
      expiresIn: this.parseExpiryToSeconds(this.accessTokenExpiry),
      tokenType: 'Bearer'
    };
  }

  /**
   * Revoke token (add to blacklist)
   */
  revokeToken(token, tokenType = 'access') {
    try {
      if (tokenType === 'access') {
        // Add to blacklist
        this.blacklistedTokens.add(token);
        
        // Try to decode to get token ID for removal from active tokens
        try {
          const decoded = jwt.decode(token);
          if (decoded?.jti) {
            this.activeTokens.delete(decoded.jti);
          }
        } catch {
          // Ignore decode errors for revocation
        }
      } else if (tokenType === 'refresh') {
        // Remove from refresh token store
        try {
          const decoded = jwt.decode(token);
          if (decoded?.jti) {
            this.refreshTokenStore.delete(decoded.jti);
          }
        } catch {
          // Ignore decode errors for revocation
        }
      }

      if (this.enableAuditing) {
        this.emit('tokenRevoked', { 
          type: tokenType,
          token: token.substring(0, 20) + '...',
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      this.emit('tokenError', { 
        type: 'revocation', 
        operation: `${tokenType}_token`,
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Revoke all tokens for a user
   */
  revokeAllUserTokens(userId) {
    let revokedCount = 0;

    // Revoke refresh tokens
    for (const [tokenId, tokenInfo] of this.refreshTokenStore) {
      if (tokenInfo.userId === userId) {
        this.refreshTokenStore.delete(tokenId);
        revokedCount++;
      }
    }

    // Revoke active access tokens
    for (const [tokenId, tokenInfo] of this.activeTokens) {
      if (tokenInfo.userId === userId) {
        this.activeTokens.delete(tokenId);
        revokedCount++;
      }
    }

    if (this.enableAuditing) {
      this.emit('userTokensRevoked', { 
        userId,
        revokedCount,
        timestamp: Date.now()
      });
    }

    return revokedCount;
  }

  /**
   * Get token statistics
   */
  getTokenStats() {
    const now = Date.now() / 1000;
    
    return {
      activeAccessTokens: this.activeTokens.size,
      activeRefreshTokens: this.refreshTokenStore.size,
      blacklistedTokens: this.blacklistedTokens.size,
      expiredAccessTokens: Array.from(this.activeTokens.values())
        .filter(token => token.expiresAt < now).length,
      expiredRefreshTokens: Array.from(this.refreshTokenStore.values())
        .filter(token => token.expiresAt < now).length
    };
  }

  /**
   * Parse expiry string to seconds
   */
  parseExpiryToSeconds(expiry) {
    if (typeof expiry === 'number') return expiry;
    
    const matches = expiry.match(/^(\d+)([smhd])$/);
    if (!matches) return 900; // Default 15 minutes
    
    const value = parseInt(matches[1]);
    const unit = matches[2];
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }

  /**
   * Start cleanup process for expired tokens
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredTokens();
    }, this.cleanupInterval);
  }

  /**
   * Cleanup expired tokens
   */
  cleanupExpiredTokens() {
    const now = Date.now() / 1000;
    let cleanedCount = 0;

    // Clean expired access tokens
    for (const [tokenId, tokenInfo] of this.activeTokens) {
      if (tokenInfo.expiresAt < now) {
        this.activeTokens.delete(tokenId);
        cleanedCount++;
      }
    }

    // Clean expired refresh tokens
    for (const [tokenId, tokenInfo] of this.refreshTokenStore) {
      if (tokenInfo.expiresAt < now) {
        this.refreshTokenStore.delete(tokenId);
        cleanedCount++;
      }
    }

    // Limit blacklist size
    if (this.blacklistedTokens.size > this.maxStoredTokens) {
      const tokensArray = Array.from(this.blacklistedTokens);
      const toKeep = tokensArray.slice(-this.maxStoredTokens / 2);
      this.blacklistedTokens.clear();
      toKeep.forEach(token => this.blacklistedTokens.add(token));
    }

    if (cleanedCount > 0 && this.enableAuditing) {
      this.emit('tokensCleanedUp', { 
        cleanedCount,
        activeAccessTokens: this.activeTokens.size,
        activeRefreshTokens: this.refreshTokenStore.size,
        blacklistedTokens: this.blacklistedTokens.size
      });
    }
  }

  /**
   * Shutdown and cleanup
   */
  shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.blacklistedTokens.clear();
    this.refreshTokenStore.clear();
    this.activeTokens.clear();
    this.removeAllListeners();
  }
}

export default JWTManager;
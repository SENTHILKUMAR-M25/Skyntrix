import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const generateAccessToken = (adminId, role) =>
  jwt.sign({ sub: adminId, role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

export const generateRefreshToken = (adminId) =>
  jwt.sign({ sub: adminId, type: "refresh" }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });

export const verifyAccessToken = (token) => jwt.verify(token, env.jwt.secret);

export const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);

// Cookie options for production-security
export const accessCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: "lax",
  maxAge: ms(env.jwt.expiresIn),
  path: "/",
});

export const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: "lax",
  maxAge: ms(env.jwt.refreshExpiresIn),
  path: "/api/auth",
});

// Convert '15m', '7d', '7d' → ms
function ms(str) {
  const s = String(str);
  const match = s.match(/^(\d+)\s*(m|h|d|s)?$/i);
  if (!match) return 15 * 60 * 1000;
  const val = Number(match[1]);
  const unit = (match[2] || "m").toLowerCase();
  const multiplier = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 }[unit];
  return val * multiplier;
}
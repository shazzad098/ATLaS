/**
 * Load the shared root .env before any module reads process.env, and relax the
 * login budget so the auth e2e suite can sign in repeatedly without tripping
 * the brute-force throttle (which is covered by its own unit test).
 */
import "../src/config/env";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.AUTH_LOGIN_MAX_ATTEMPTS = "10000";

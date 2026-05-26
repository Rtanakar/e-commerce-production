// ============================================================================
// auth.controller.ts - HTTP layer (function-based)
// ============================================================================
// Thin controllers:
//   - Request se data nikalo
//   - Service function call
//   - Response shape return
//
// NO business logic - sirf HTTP <-> Service translation
//
// Industry pattern (Express): named async function exports
// req.user assertions - requireAuth middleware ne already validate kar diya
// ============================================================================

import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import { UnauthorizedError } from "../../utils/errors.js";
import type { RegisterDto, LoginDto, RefreshDto, ChangePasswordDto } from "./auth.validator.js";

// ============================================================================
// POST /register
// ============================================================================
export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body as RegisterDto);
  res.status(HttpStatus.CREATED).json({
    ...ApiResponseBuilder.success(result),
    requestId: req.id,
  });
}

// ============================================================================
// POST /login
// ============================================================================
export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body as LoginDto);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(result),
    requestId: req.id,
  });
}

// ============================================================================
// POST /refresh
// ============================================================================
export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as RefreshDto;
  const result = await authService.refreshTokens(refreshToken);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(result),
    requestId: req.id,
  });
}

// ============================================================================
// POST /logout - protected
// ============================================================================
export async function logout(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  await authService.logout(req.user.sub, req.user.sid);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ message: "Logout successful" }),
    requestId: req.id,
  });
}

// ============================================================================
// POST /logout-all - protected (all devices)
// ============================================================================
export async function logoutAll(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  await authService.logoutAllDevices(req.user.sub);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ message: "Logged out from all devices" }),
    requestId: req.id,
  });
}

// ============================================================================
// GET /me - protected
// ============================================================================
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const user = await authService.getMe(req.user.sub);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(user),
    requestId: req.id,
  });
}

// ============================================================================
// POST /change-password - protected
// ============================================================================
export async function changePassword(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  await authService.changePassword(req.user.sub, req.body as ChangePasswordDto);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      message: "Password changed successfully, all sessions revoked",
    }),
    requestId: req.id,
  });
}

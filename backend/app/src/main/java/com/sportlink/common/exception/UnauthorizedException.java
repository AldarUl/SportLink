package com.sportlink.common.exception;

/**
 * Ошибка авторизации/аутентификации.
 * Используем вместо RuntimeException, чтобы не падать в /error и не получать 403 от Spring Security.
 */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}

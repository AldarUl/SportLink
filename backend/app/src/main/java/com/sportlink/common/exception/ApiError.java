package com.sportlink.common.exception;

import java.time.Instant;

public record ApiError(String message, String code, Instant timestamp, String path) {
    public static ApiError of(String msg, String code, String path) {
        return new ApiError(msg, code, Instant.now(), path);
    }
}

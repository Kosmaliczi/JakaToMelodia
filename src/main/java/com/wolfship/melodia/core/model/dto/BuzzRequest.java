package com.wolfship.melodia.core.model.dto;

/**
 * playerId opcjonalny: dla single-device hosta wysyłany w body,
 * dla graczy z JWT brany z tokenu (pole ignorowane).
 */
public record BuzzRequest(String playerId) {}

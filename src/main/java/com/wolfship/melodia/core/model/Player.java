package com.wolfship.melodia.core.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Player {
    private String id;
    private String name;
    private String hotkey;
    private int score;
    private boolean lockedOut;
    /**
     * Identyfikator urządzenia gracza (hash JWT). Faza 2: na razie nieużywane.
     */
    private String deviceToken;
    /**
     * Status gotowości w lobby (status WAITING). True dla wszystkich graczy
     * po starcie gry — pole ma znaczenie tylko podczas WAITING.
     */
    private boolean ready;

    public Player(String id, String name, String hotkey, int score, boolean lockedOut) {
        this(id, name, hotkey, score, lockedOut, null, false);
    }
}

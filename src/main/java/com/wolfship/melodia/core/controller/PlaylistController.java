package com.wolfship.melodia.core.controller;

import com.wolfship.melodia.external.spotify.SpotifyService;
import com.wolfship.melodia.external.spotify.model.PlaylistDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/playlists")
@RequiredArgsConstructor
public class PlaylistController {

    private final SpotifyService spotifyService;

    @GetMapping
    public List<PlaylistDto> myPlaylists() {
        return spotifyService.getCurrentUserPlaylists();
    }
}

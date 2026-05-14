package com.wolfship.melodia.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * SPA fallback — bezpośrednie wejście na /join, /player/xxx, /game itd.
 * powinno zwrócić index.html, żeby React Router obsłużył routing po stronie klienta.
 * Dodane w 0.2 (Faza 1).
 */
@Configuration
public class SpaFallbackConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/join").setViewName("forward:/index.html");
        registry.addViewController("/game").setViewName("forward:/index.html");
        registry.addViewController("/player/{id:[a-z0-9-]+}").setViewName("forward:/index.html");
    }
}

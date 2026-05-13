package com.wolfship.melodia;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MelodiaApplication {

    public static void main(String[] args) {
        SpringApplication.run(MelodiaApplication.class, args);
    }
}

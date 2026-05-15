package com.wolfship.melodia.core.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

/**
 * Endpoint dla widoku hosta — zwraca adresy LAN pod którymi serwer jest dostępny.
 * Frontend używa tego do wygenerowania QR code'u dla graczy.
 *
 * Priorytety źródeł (od najwyższego):
 *   1. melodia.host-lan-ip (z env var MELODIA_HOST_LAN_IP) — JAWNIE skonfigurowany IP hosta.
 *      W Dockerze TRZEBA użyć tej opcji, bo container widzi tylko swoje bridge IP.
 *      Wartość może być wieloma IP rozdzielonymi przecinkiem/spacją/średnikiem.
 *   2. Host header z bieżącego żądania — gdy host wszedł przez LAN IP.
 *   3. Enumeracja interfejsów sieciowych (działa tylko poza Dockerem / bare-metal).
 */
@Slf4j
@RestController
@RequestMapping("/api/network")
public class NetworkController {

    private final List<String> configuredHostIps;

    public NetworkController(@Value("${melodia.host-lan-ip:}") String configured) {
        this.configuredHostIps = parseIpList(configured);
        if (!configuredHostIps.isEmpty()) {
            log.info("MELODIA_HOST_LAN_IP skonfigurowane: {}", configuredHostIps);
        }
    }

    @GetMapping("/lan-addresses")
    public Response lanAddresses(HttpServletRequest request) {
        // 1. Jawna konfiguracja z env (wymagane w Docker)
        if (!configuredHostIps.isEmpty()) {
            return new Response(configuredHostIps);
        }

        // 2. Host header — gdy host otworzył przeglądarkę pod LAN IP
        String serverName = request.getServerName();
        if (isSiteLocalIp(serverName)) {
            return new Response(List.of(serverName));
        }

        // 3. Enumeracja interfejsów (poza Dockerem)
        return new Response(enumerateLocalInterfaces());
    }

    private static List<String> parseIpList(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split("[,;\\s]+"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();
    }

    private static boolean isSiteLocalIp(String host) {
        if (host == null || host.isBlank()) return false;
        try {
            InetAddress addr = InetAddress.getByName(host);
            return addr instanceof Inet4Address && addr.isSiteLocalAddress();
        } catch (UnknownHostException e) {
            return false;
        }
    }

    private static List<String> enumerateLocalInterfaces() {
        List<String> addresses = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> nics = NetworkInterface.getNetworkInterfaces();
            while (nics.hasMoreElements()) {
                NetworkInterface ni = nics.nextElement();
                if (!ni.isUp() || ni.isLoopback() || ni.isVirtual()) continue;
                Enumeration<InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress addr = addrs.nextElement();
                    if (!(addr instanceof Inet4Address)) continue;
                    if (addr.isLoopbackAddress()) continue;
                    if (!addr.isSiteLocalAddress()) continue;
                    String ip = addr.getHostAddress();
                    if (!addresses.contains(ip)) addresses.add(ip);
                }
            }
        } catch (SocketException e) {
            log.warn("Nie udało się pobrać interfejsów sieciowych: {}", e.getMessage());
        }
        Collections.sort(addresses, (a, b) -> {
            int pa = priority(a);
            int pb = priority(b);
            if (pa != pb) return Integer.compare(pa, pb);
            return a.compareTo(b);
        });
        return addresses;
    }

    private static int priority(String ip) {
        if (ip.startsWith("192.168.")) return 0;
        if (ip.startsWith("10.")) return 1;
        if (ip.startsWith("172.")) return 2;
        return 3;
    }

    public record Response(List<String> addresses) {}
}

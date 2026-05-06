import { Controller, Get } from "@nestjs/common";
import { LanDiscoveryService, type LanDiscoveryStatus } from "./lan-discovery.service";

@Controller("lan")
export class LanController {
  constructor(private readonly lan: LanDiscoveryService) {}

  /**
   * Estado LAN + internet (vista servidor). Público allowlist (sin JWT) para diagnóstico y UI de conectividad.
   * Dispara un DISCOVER multicast breve para refrescar respuestas de otros equipos.
   */
  @Get("discovery")
  discovery(): LanDiscoveryStatus {
    this.lan.triggerDiscoveryProbe();
    return this.lan.getStatus();
  }
}

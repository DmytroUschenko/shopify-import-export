import { Body, Controller, Get, Param, Put } from '@nestjs/common';

import { ConfigurationService } from './configuration.service';

@Controller('api/configuration')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  /** GET /api/configuration/:shopDomain — all configs, grouped */
  @Get(':shopDomain')
  async getGroupedConfig(@Param('shopDomain') shopDomain: string) {
    return this.configurationService.getGroupedConfig(shopDomain);
  }

  /** PUT /api/configuration/:shopDomain — batch upsert { [path]: value } */
  @Put(':shopDomain')
  async upsertConfigs(
    @Param('shopDomain') shopDomain: string,
    @Body() updates: Record<string, string | null>
  ) {
    await this.configurationService.upsertConfigs(shopDomain, updates);
    return this.configurationService.getGroupedConfig(shopDomain);
  }

  /** GET /api/configuration/:shopDomain/:configPath — single path */
  @Get(':shopDomain/*configPath')
  async getOne(
    @Param('shopDomain') shopDomain: string,
    @Param('configPath') configPath: string
  ) {
    return this.configurationService.getOne(shopDomain, configPath);
  }

  /** PUT /api/configuration/:shopDomain/:configPath — single path upsert { value } */
  @Put(':shopDomain/*configPath')
  async upsertOne(
    @Param('shopDomain') shopDomain: string,
    @Param('configPath') configPath: string,
    @Body() body: { value: string | null }
  ) {
    return this.configurationService.upsertOne(shopDomain, configPath, body.value);
  }
}

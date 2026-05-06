import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import { CreateTransportContractDto } from "./dto/create-transport-contract.dto";
import { CreateTransportContractVersionDto } from "./dto/create-transport-contract-version.dto";
import { CreateTransportTariffItemDto } from "./dto/create-transport-tariff-item.dto";
import { CreateTransportTariffOverrideDto } from "./dto/create-transport-tariff-override.dto";
import { UpdateTransportContractDto } from "./dto/update-transport-contract.dto";
import { UpdateTransportContractVersionDto } from "./dto/update-transport-contract-version.dto";
import { UpdateTransportTariffItemDto } from "./dto/update-transport-tariff-item.dto";
import { UpdateTransportTariffOverrideDto } from "./dto/update-transport-tariff-override.dto";
import { TransportContractsService } from "./transport-contracts.service";

@Controller("inventory/transport-contracts")
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TransportContractsController {
  constructor(private readonly transportContractsService: TransportContractsService) {}

  @Get()
  list(
    @Query("projectId") projectId?: string,
    @Query("supplierId") supplierId?: string,
    @Query("activeOnly") activeOnly?: string,
  ) {
    let active: boolean | undefined = true;
    if (activeOnly === "false" || activeOnly === "0") active = undefined;
    else if (activeOnly === "true" || activeOnly === "1") active = true;
    return this.transportContractsService.listContracts({
      projectId: projectId?.trim() || null,
      supplierId: supplierId?.trim() || null,
      active,
    });
  }

  /** Selector: versiones publicadas filtradas por proyecto y/o transportista. */
  @Get("published-versions")
  publishedForContext(
    @Query("projectId") projectId?: string,
    @Query("supplierId") supplierId?: string,
  ) {
    return this.transportContractsService.listPublishedVersionsForContext({
      projectId: projectId?.trim() || null,
      supplierId: supplierId?.trim() || null,
    });
  }

  @Get(":id")
  one(@Param("id") id: string) {
    return this.transportContractsService.getContract(id.trim());
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  create(@Body() body: CreateTransportContractDto) {
    return this.transportContractsService.createContract(body);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  update(@Param("id") id: string, @Body() body: UpdateTransportContractDto) {
    return this.transportContractsService.updateContract(id.trim(), body);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  remove(@Param("id") id: string) {
    return this.transportContractsService.deleteContract(id.trim());
  }

  @Post(":contractId/versions")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  createVersion(@Param("contractId") contractId: string, @Body() body: CreateTransportContractVersionDto) {
    return this.transportContractsService.createVersion(contractId.trim(), body);
  }

  @Get(":contractId/versions/:versionId")
  oneVersion(@Param("contractId") contractId: string, @Param("versionId") versionId: string) {
    return this.transportContractsService.getContractVersion(contractId.trim(), versionId.trim());
  }

  @Patch(":contractId/versions/:versionId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  updateVersion(
    @Param("contractId") contractId: string,
    @Param("versionId") versionId: string,
    @Body() body: UpdateTransportContractVersionDto,
  ) {
    return this.transportContractsService.updateVersion(contractId.trim(), versionId.trim(), body);
  }

  @Post(":contractId/versions/:versionId/publish")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  publish(@Param("contractId") contractId: string, @Param("versionId") versionId: string) {
    return this.transportContractsService.publishVersion(contractId.trim(), versionId.trim());
  }

  @Post(":contractId/versions/:versionId/items")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  createItem(
    @Param("contractId") contractId: string,
    @Param("versionId") versionId: string,
    @Body() body: CreateTransportTariffItemDto,
  ) {
    return this.transportContractsService.createTariffItem(contractId.trim(), versionId.trim(), body);
  }

  @Patch(":contractId/versions/:versionId/items/:itemId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  updateItem(
    @Param("contractId") contractId: string,
    @Param("versionId") versionId: string,
    @Param("itemId") itemId: string,
    @Body() body: UpdateTransportTariffItemDto,
  ) {
    return this.transportContractsService.updateTariffItem(
      contractId.trim(),
      versionId.trim(),
      itemId.trim(),
      body,
    );
  }

  @Delete(":contractId/versions/:versionId/items/:itemId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  deleteItem(
    @Param("contractId") contractId: string,
    @Param("versionId") versionId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.transportContractsService.deleteTariffItem(
      contractId.trim(),
      versionId.trim(),
      itemId.trim(),
    );
  }

  @Post(":contractId/versions/:versionId/overrides")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  createOverride(
    @Param("contractId") contractId: string,
    @Param("versionId") versionId: string,
    @Body() body: CreateTransportTariffOverrideDto,
  ) {
    return this.transportContractsService.createTariffOverride(contractId.trim(), versionId.trim(), body);
  }

  @Patch(":contractId/versions/:versionId/overrides/:overrideId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  updateOverride(
    @Param("contractId") contractId: string,
    @Param("versionId") versionId: string,
    @Param("overrideId") overrideId: string,
    @Body() body: UpdateTransportTariffOverrideDto,
  ) {
    return this.transportContractsService.updateTariffOverride(
      contractId.trim(),
      versionId.trim(),
      overrideId.trim(),
      body,
    );
  }

  @Delete(":contractId/versions/:versionId/overrides/:overrideId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  deleteOverride(
    @Param("contractId") contractId: string,
    @Param("versionId") versionId: string,
    @Param("overrideId") overrideId: string,
  ) {
    return this.transportContractsService.deleteTariffOverride(
      contractId.trim(),
      versionId.trim(),
      overrideId.trim(),
    );
  }
}

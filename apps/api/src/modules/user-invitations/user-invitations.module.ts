import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { UserInvitationsController } from "./user-invitations.controller";
import { UserInvitationsService } from "./user-invitations.service";

@Module({
  imports: [AuditLogModule],
  controllers: [UserInvitationsController],
  providers: [UserInvitationsService],
})
export class UserInvitationsModule {}


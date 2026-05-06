import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { ProjectsModule } from "../projects/projects.module";
import { QuotesModule } from "../quotes/quotes.module";
import { TasksModule } from "../tasks/tasks.module";
import { UsersModule } from "../users/users.module";
import { SuiteAgentController } from "./suite-agent.controller";
import { SuiteAgentService } from "./suite-agent.service";

@Module({
  imports: [TasksModule, ProjectsModule, UsersModule, QuotesModule, ClientsModule],
  controllers: [SuiteAgentController],
  providers: [SuiteAgentService],
})
export class SuiteAgentModule {}

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { buildRequestContextFromUser, runWithRequestContext } from "./request-context";

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    const ctx = buildRequestContextFromUser(user);
    if (!ctx) return next.handle();
    // Mantener el contexto durante toda la request (RxJS).
    return new Observable((subscriber) => {
      runWithRequestContext(ctx, () => {
        const sub = next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
        return () => sub.unsubscribe();
      });
    });
  }
}


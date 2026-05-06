/** Contador de modales abiertos: evita quitar overflow del body si otro modal sigue activo. */
let bodyScrollLockCount = 0;

export function lockBodyScroll(): void {
  bodyScrollLockCount += 1;
  if (bodyScrollLockCount === 1) {
    document.body.style.overflow = "hidden";
  }
}

export function unlockBodyScroll(): void {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = "";
  }
}

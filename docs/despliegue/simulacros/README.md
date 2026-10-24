# Registro de simulacros de restauración

Cada ejecución de `npm run restore:test` (`scripts/backup/restore-test.sh`) escribe aquí un archivo `AAAA-MM-DD.md` con el resultado, la duración de la restauración (el RTO medido) y las verificaciones (esquema, conteos de tablas, muestra de fotos). Vea [`../vm.md`](../vm.md).

Sin registros todavía: el primer simulacro requiere Docker y la VM (tarea 7.1 del change `despliegue-vm-y-respaldos`).
